from datetime import datetime
from uuid import UUID, uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.models import UploadSummary
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

    try:
        supabase.update_ingestion_job(
            job_id,
            {
                "status": "completed",
                "total_lines": processed.total_lines,
                "parsed_lines": processed.parsed_lines,
                "rejected_lines": processed.rejected_lines,
                "error_message": None,
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
    )
