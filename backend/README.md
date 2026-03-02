# Backend

Install dependencies:

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
```

Run the API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Upload logs:

- `POST /api/logs/upload`
- accepts `.log` and `.txt`
- expects a `user_id` form field
- expects one JSON object per non-empty line

Example line:

```json
{"ts":"2026-03-02T18:22:43Z","src_ip":"10.0.12.34","service":"api-gateway","method":"GET","path":"/v1/reports/export","status":403,"user_agent":"Mozilla/5.0","action":"blocked","outcome":"policy_violation"}
```

Train the baseline suspicious-IP model:

```bash
python scripts/train_ip_risk_model.py \
  --user-id <supabase-auth-user-id> \
  --output models/ip_risk_model.joblib
```

Optional:

- pass `--job-id <ingestion-job-id>` to train from a specific completed upload
- omit `--job-id` to use the latest completed job for that user

The script reads these summary tables for the selected job:

- `ip_volume_summary`
- `ip_service_summary`
- `ip_path_summary`
- `ip_outcome_summary`
- `ip_status_summary`

It then:

- builds one feature row per `src_ip`
- assigns heuristic labels: `low`, `medium`, `high`, `critical`
- trains a baseline `RandomForestClassifier`
- writes a `joblib` artifact containing the model, feature names, feature rows, and any classification report

Score IPs with the saved model:

```bash
python scripts/score_ip_risk_model.py \
  --user-id <supabase-auth-user-id> \
  --model models/ip_risk_model.joblib
```

Optional:

- pass `--job-id <ingestion-job-id>` to score a specific completed upload
- omit `--job-id` to score the latest completed job for that user
