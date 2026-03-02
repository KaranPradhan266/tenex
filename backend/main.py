from datetime import datetime
from uuid import UUID, uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.models import IpSignalsResponse, ProcessingSectionReport, UploadSummary
from app.processors.ip_signals import compute_ip_signals
from app.processors.log_ingestion import process_uploaded_log, validate_filename
from app.services.supabase import SupabaseService

app = FastAPI(title="tenex-backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hello")
async def hello() -> dict[str, str]:
    return {"message": "Hello from Python backend"}


@app.get("/api/logs/ip-signals", response_model=IpSignalsResponse)
async def get_ip_signals(
    user_id: UUID = Query(...),
    src_ip: str = Query(...),
    job_id: UUID | None = Query(default=None),
) -> IpSignalsResponse:
    supabase = SupabaseService.from_settings()

    if job_id is not None:
        ingestion_job = supabase.get_ingestion_job(job_id, user_id)
        if not ingestion_job or ingestion_job.get("status") != "completed":
            raise HTTPException(status_code=404, detail="Completed ingestion job not found")
    else:
        ingestion_job = supabase.get_latest_completed_ingestion_job(user_id)
        if not ingestion_job:
            raise HTTPException(status_code=404, detail="No completed ingestion jobs found")

    storage_path = ingestion_job.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="No storage path found for ingestion job")

    content = supabase.download_file(storage_path)
    return compute_ip_signals(content, src_ip, UUID(str(ingestion_job["id"])))


@app.post("/api/logs/upload", response_model=UploadSummary)
async def upload_logs(
    user_id: UUID = Form(...),
    file: UploadFile = File(...),
) -> UploadSummary:
    filename = validate_filename(file.filename)
    supabase = SupabaseService.from_settings()

    job_id = uuid4()
    storage_path = f"{user_id}/{job_id}/{filename}"
    supabase.insert_ingestion_job(job_id, user_id, filename)

    content = await file.read()

    try:
        supabase.upload_file(storage_path, content, file.content_type or "text/plain")
    except HTTPException as exc:
        supabase.update_ingestion_job(
            job_id,
            {
                "status": "failed",
                "error_message": exc.detail,
            },
        )
        raise

    try:
        supabase.update_ingestion_job(
            job_id,
            {
                "storage_path": storage_path,
                "status": "processing",
                "error_message": None,
            },
        )
    except HTTPException:
        supabase.delete_file(storage_path)
        raise

    try:
        processed = process_uploaded_log(content)
    except HTTPException as exc:
        supabase.update_ingestion_job(
            job_id,
            {
                "status": "failed",
                "error_message": exc.detail,
            },
        )
        raise

    processing_report: list[ProcessingSectionReport] = []

    def run_summary_step(
        name: str,
        *,
        clear_table: str,
        insert_fn: callable,
    ) -> None:
        try:
            supabase.delete_chart_rows(clear_table, job_id)
            insert_fn()
            supabase.delete_other_chart_rows_for_user(clear_table, user_id, job_id)
            processing_report.append(
                ProcessingSectionReport(name=name, status="completed")
            )
        except HTTPException as exc:
            supabase.delete_chart_rows(clear_table, job_id)
            processing_report.append(
                ProcessingSectionReport(
                    name=name,
                    status="failed",
                    message=exc.detail,
                )
            )

    run_summary_step(
        "user_agents",
        clear_table="chart_user_agents",
        insert_fn=lambda: supabase.insert_chart_user_agents(
            job_id, user_id, processed.user_agent_aggregates
        ),
    )
    run_summary_step(
        "traffic_sankey",
        clear_table="chart_traffic_sankey",
        insert_fn=lambda: supabase.insert_chart_traffic_sankey(
            job_id, user_id, processed.sankey_aggregates
        ),
    )
    run_summary_step(
        "ip_minute_traffic",
        clear_table="ip_minute_traffic",
        insert_fn=lambda: supabase.insert_ip_minute_traffic(
            job_id, user_id, processed.ip_minute_traffic_aggregates
        ),
    )
    run_summary_step(
        "ip_service_summary",
        clear_table="ip_service_summary",
        insert_fn=lambda: supabase.insert_ip_service_summary(
            job_id, user_id, processed.ip_service_aggregates
        ),
    )
    run_summary_step(
        "ip_path_summary",
        clear_table="ip_path_summary",
        insert_fn=lambda: supabase.insert_ip_path_summary(
            job_id, user_id, processed.ip_path_aggregates
        ),
    )
    run_summary_step(
        "ip_outcome_summary",
        clear_table="ip_outcome_summary",
        insert_fn=lambda: supabase.insert_ip_outcome_summary(
            job_id, user_id, processed.ip_outcome_aggregates
        ),
    )
    run_summary_step(
        "ip_status_summary",
        clear_table="ip_status_summary",
        insert_fn=lambda: supabase.insert_ip_status_summary(
            job_id, user_id, processed.ip_status_aggregates
        ),
    )
    run_summary_step(
        "ip_volume_summary",
        clear_table="ip_volume_summary",
        insert_fn=lambda: supabase.insert_ip_volume_summary(
            job_id, user_id, processed.ip_volume_aggregates
        ),
    )

    failed_sections = [section for section in processing_report if section.status == "failed"]
    error_message = (
        "; ".join(
            f"{section.name}: {section.message}" for section in failed_sections if section.message
        )
        if failed_sections
        else None
    )

    try:
        supabase.update_ingestion_job(
            job_id,
            {
                "status": "completed",
                "total_lines": processed.total_lines,
                "parsed_lines": processed.parsed_lines,
                "rejected_lines": processed.rejected_lines,
                "error_message": error_message,
                "completed_at": datetime.now().isoformat(),
            },
        )
    except HTTPException as exc:
        supabase.delete_file(storage_path)
        supabase.update_ingestion_job(
            job_id,
            {
                "status": "failed",
                "error_message": f"Failed finalizing ingestion job: {exc.detail}",
            },
        )
        raise

    return UploadSummary(
        job_id=job_id,
        filename=filename,
        storage_path=storage_path,
        total_lines=processed.total_lines,
        parsed_lines=processed.parsed_lines,
        rejected_lines=processed.rejected_lines,
        sample_errors=processed.sample_errors,
        sample_events=processed.sample_events,
        processing_report=processing_report,
    )
