# Sephora Business Insight

Sephora Business Insight is a business intelligence project for exploring Sephora’s catalog and customer reviews. The startup screen verifies the connection to FastAPI and the presence of the six local source files.

## Run locally

Use Python 3.12, Node.js 22, and Git. Run these commands from the repository root in PowerShell.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Set `SEPHORA_DATASET_DIR` in `backend/.env` to the local directory containing the CSVs. Quote paths with spaces. Start FastAPI on loopback.

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8011 --no-proxy-headers
```

In another terminal, start Next.js.

```powershell
cd frontend
npm ci
npm run dev -- --webpack --hostname localhost --port 3011
```

Open [the startup screen](http://localhost:3011) and [the health endpoint](http://127.0.0.1:8011/health). Use `frontend/.env.local` to set a different `SEPHORA_API_URL` if needed.

## Architecture

Next.js renders the UI using TypeScript and Tailwind CSS. Recharts is installed for interactive charts. Next.js calls the FastAPI backend from the server. The backend will use Pandas to validate and join local CSVs and return aggregate metrics. AI sentiment requests will run on the backend. The CSV files are the source of truth.

Read the [dataset audit](docs/DATASET.md) for the schema, join key, quality findings, and the metrics the data supports. See the [collaboration guide](docs/COLLABORATING.md) for the branch, review, and security workflow.
