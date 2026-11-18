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

Next.js renders the UI using TypeScript and Tailwind CSS. Recharts is installed for interactive charts. Next.js calls the FastAPI backend from the server. The backend uses Pandas to clean and join the local CSVs (duplicate reviews removed, reviews joined to the catalogue on `product_id`) and returns aggregate metrics. The first request builds a Parquet cache in `backend/.cache/` (gitignored), so later starts take a few seconds instead of about half a minute. AI sentiment requests will run on the backend. The CSV files are the source of truth.

Read the [dataset audit](docs/DATASET.md) for the schema, join key, quality findings, and the metrics the data supports. See the [collaboration guide](docs/COLLABORATING.md) for the branch, review, and security workflow.

## API

All endpoints are read-only `GET` requests on the loopback backend. Invalid parameters return `422`; a missing dataset returns `503` without revealing local paths. Reviewer IDs are never returned.

| Endpoint | Returns |
| --- | --- |
| `/health` | Backend status, whether the six files are present and whether data is loaded |
| `/api/overview` | KPIs: products, brands, categories, reviews, average rating, five-star share, recommendation rate |
| `/api/categories` | Products per primary category (catalogue) |
| `/api/top-products?limit=10` | Most reviewed products (review rows) |
| `/api/top-brands?limit=10` | Brands by number of review rows |
| `/api/ratings` | Reviews per star rating, 1–5 |
| `/api/trend?granularity=month\|year` | Review volume and average rating over time |
| `/api/filters` | Values for the Products and Reviews filters |
| `/api/products?q=&category=&sort=&page=` | Catalogue search (name or brand), category filter, sort (`popular`, `rating`, `reviews`, `price_asc`, `price_desc`, `name`), pagination |
| `/api/reviews/summary?subcategory=&year=&rating=` | Review KPIs, rating distribution, trend and top products for the filters |
| `/api/reviews?subcategory=&year=&rating=&sort=&page=` | Paginated review texts (`recent`, `helpful`, `highest`, `lowest`) |

Interactive documentation is at http://127.0.0.1:8011/docs (disabled when `SEPHORA_ENV=production`).

## Tests

The backend tests build a small synthetic dataset at runtime; no real data is needed or committed.

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
cd backend
..\.venv\Scripts\python.exe -m pytest
```

GitHub Actions runs the repository scan, dependency audits, these tests, the frontend type check and the production build on every push and pull request.
