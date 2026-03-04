# Tenex.AI

Tenex.AI is a SOC-focused investigation workspace for structured log analysis.

The application is designed to help an analyst move from uploaded raw logs to:
- prioritized suspicious IPs
- traffic flow analysis
- user-agent profiling
- per-IP drill-down
- time-based request activity
- enrichment and AI-assisted context

The core workflow is:
1. upload a structured log file
2. parse it once in the backend
3. generate multiple security-oriented summaries
4. expose those summaries across investigative views

## Main Views

- `Overview`
  - explains the intended analyst workflow and what each tab is for
- `Upload Logs`
  - ingests `.log` / `.txt` files and generates the summary tables used by the app
- `Dashboard`
  - presents a triage snapshot with priority IPs, suspicious outcomes, and service pressure
- `Traffic Breakdown`
  - Sankey graph for `Method -> Service -> Status Class -> Outcome -> Action`
- `IP Drill Down`
  - focused investigation page for a single source IP
- `User-Agent Analysis`
  - categorizes traffic into browsers, libraries, automation, crawlers, suspicious signatures, and related groups
- `Summarized Timeline`
  - plots request activity over time for a selected IP
- `Incident Reports`
  - ranks source IPs by predicted severity for triage

## Architecture Summary

- `frontend/`
  - Next.js application
  - Supabase auth
  - ECharts-based investigative pages
- `backend/`
  - FastAPI application
  - handles uploads, parsing, aggregation, enrichment, AI calls, and model scoring
- Supabase
  - Auth
  - Postgres summary tables
  - Storage for raw log files

The backend follows a `one ingestion job, one parse pass, many aggregate outputs` design.

That means each uploaded log is parsed once, then used to generate:
- traffic Sankey data
- user-agent summary data
- per-IP summaries
- incident-ranking features

## Log Format

The current ingest path expects:
- `.log` or `.txt`
- UTF-8 text
- one JSON object per non-empty line

Example:

```json
{"ts":"2026-03-02T18:22:43Z","src_ip":"10.0.12.34","service":"api-gateway","method":"GET","path":"/v1/reports/export","status":403,"user_agent":"Mozilla/5.0","action":"blocked","outcome":"policy_violation"}
```

Common optional fields used elsewhere in the app include:
- `request_id`
- `dest_ip`
- `host`
- `duration_ms`
- `bytes_in`
- `bytes_out`

## Local Setup

### Prerequisites

- Node.js and npm
- Python 3.11+
- a Supabase project

### 1. Backend setup

From `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_RAW_LOGS_BUCKET=raw-logs

XAI_API_KEY=your-xai-api-key
XAI_MODEL=grok-4-latest

VIRUSTOTAL_API_KEY=your-virustotal-api-key
```

Run the backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### 2. Frontend setup

From `frontend/`:

```bash
npm install
```

Create `frontend/.env` or `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
```

Run the frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Supabase Requirements

The app expects:
- a `raw-logs` storage bucket
- `ingestion_jobs`
- chart and summary tables used by the backend processing flow

These include tables such as:
- `chart_user_agents`
- `chart_traffic_sankey`
- `ip_minute_traffic`
- `ip_service_summary`
- `ip_method_summary`
- `ip_path_summary`
- `ip_outcome_summary`
- `ip_status_summary`
- `ip_volume_summary`
- `ip_action_summary`

If you have been following the build process in this repo, those tables should already exist in your Supabase project.

## AI and Threat Intel Integrations

### xAI / Grok

The `IP Drill Down` page supports an `AI Insights` section.

This does not perform the primary detection logic. Instead, it takes already-computed structured facts and produces a concise analyst-style summary.

The backend sends:
- source IP
- total requests
- bytes in / bytes out
- top services
- top paths
- top outcomes
- status code breakdown
- IP enrichment

to Grok and returns the generated explanation.

### VirusTotal

The `IP Drill Down` page also supports a compact VirusTotal section.

For a selected IP, the backend queries:

```text
https://www.virustotal.com/api/v3/ip_addresses/{ip}
```

The UI shows only:
- `Not blacklisted`
- or the list of detecting engines if the IP is flagged as `malicious` or `suspicious`

## Anomaly Detection / Incident Ranking Approach

The application currently uses a baseline ML-assisted suspicious-IP ranking pipeline.

### Important framing

This is intended as a prioritization model, not a final maliciousness verdict engine.

It is useful for:
- triage
- ranking suspicious IPs
- helping an analyst focus attention faster

It is not yet a production-grade validated detection model.

### How it works

During upload processing, the backend generates per-IP summary tables such as:
- request counts
- bytes in / bytes out
- service coverage
- path coverage
- outcome counts
- status code counts

From those summaries, the training pipeline builds one feature row per `src_ip`.

Example features include:
- `total_requests`
- `total_bytes_in`
- `total_bytes_out`
- `avg_bytes_in_per_request`
- `avg_bytes_out_per_request`
- `service_count`
- `path_count`
- `top_service_ratio`
- `top_path_ratio`
- `outcome_count`
- `suspicious_outcome_ratio`
- `status_2xx_ratio`
- `status_3xx_ratio`
- `status_4xx_ratio`
- `status_5xx_ratio`

### Labels

The current model is trained on heuristic labels, not analyst-reviewed truth labels.

Each IP is assigned a severity bucket using fixed scoring rules:
- `low`
- `medium`
- `high`
- `critical`

Those rules consider:
- request volume
- byte volume
- number of services hit
- number of paths hit
- concentration on paths
- suspicious outcome ratio
- 4xx rate
- 5xx rate

### Model

The current baseline model is a:

- `RandomForestClassifier`

This model is trained offline and saved to:

```text
backend/models/ip_risk_model.joblib
```

The application uses that saved artifact at runtime to score IPs on the `Incident Reports` page.

### Training

From `backend/`:

```bash
.venv/bin/python scripts/train_ip_risk_model.py --user-id <supabase-auth-user-id>
```

This script:
- reads the latest completed job for that user, unless `--job-id` is provided
- builds feature rows from the per-IP summary tables
- assigns heuristic labels
- trains the baseline model
- saves the artifact to `backend/models/ip_risk_model.joblib`

### Scoring

To inspect model output directly:

```bash
.venv/bin/python scripts/score_ip_risk_model.py --user-id <supabase-auth-user-id>
```

This prints predicted severity, confidence, heuristic label, and key supporting metrics per IP.

## Notes

- the app currently works best when logs are structured and consistent
- incident reports are scored from summary tables, not from raw logs directly
- AI is used for explanation and synthesis, not as the primary anomaly detector
- the current ML workflow is a strong prototype baseline, but should not be presented as fully validated production detection

## Suggested Demo Flow

1. Upload a log file
2. Open `Dashboard`
3. Review `Incident Reports`
4. Pivot into `Traffic Breakdown`
5. Open `IP Drill Down` for a suspicious IP
6. Review enrichment, VirusTotal, and AI insights

