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
