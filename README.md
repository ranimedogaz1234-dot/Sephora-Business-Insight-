# Sephora Business Insight

Sephora Business Insight is a business intelligence dashboard for exploring Sephora’s catalog and customer reviews, built as a university project.

## Pages

| Page | What it shows |
| --- | --- |
| **Dashboard** (`/`) | KPI cards (products, reviews, average rating, brands), products by category (donut), rating distribution, review activity over time (monthly/yearly), top 10 most reviewed products and top brands by reviews |
| **Business insights** (`/insights`) | Findings from documented rules with a suggested next step: highly rated but rarely saved products, popular products rated below their category, Skincare products whose review rating rose or fell in the last two years, brand positioning (rating against saves per product) and category demand (share of loves against share of products) |
| **Products** (`/products`) | Searchable catalogue (name or brand), category filter, six sort orders, pagination |
| **Reviews** (`/reviews`) | Review KPIs, star-rating donut, review trend and most reviewed products for the selected category, year and rating, plus customer review cards sorted by recency, helpfulness or rating |
| **Sentiment** (`/sentiment`) | Positive, neutral and negative review texts by star rating, year and subcategory; sentiment per topic; words and phrases that set positive and negative reviews apart; most positive and negative products and brands; example reviews; model validation against star ratings |
| **About** (`/about`) | Project goal, dataset, technologies and contributors |

Every figure comes from the dataset through the API; nothing is hard-coded. Each chart has hover tooltips and a hidden data table for screen readers, and the layout adapts from phones to wide screens.

## Run locally

Use Python 3.12 or later (CI uses 3.12), Node.js 22 or later, and Git. Run these commands from the repository root in PowerShell.

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

Open [the dashboard](http://localhost:3011) and [the health endpoint](http://127.0.0.1:8011/health). Use `frontend/.env.local` to set a different `SEPHORA_API_URL` if needed.

To re-check the dataset figures (products, brands, categories, raw and deduplicated reviews, average rating), run `..\.venv\Scripts\python.exe -m sephora` from `backend/`. It applies the same cleaning as the API.

The Sentiment page needs the review texts to be scored once per dataset (about a minute on a multi-core machine). Run `..\.venv\Scripts\python.exe -m sephora.sentiment` from `backend/`. It scores every review with VADER adapted to skincare, checks the result against star ratings on a held-out sample, and writes `sentiment.parquet` and `sentiment.json` to the gitignored cache. Until then the sentiment endpoints return `503`.

## Architecture

Next.js renders the UI using TypeScript and Tailwind CSS. Recharts is installed for interactive charts. Next.js calls the FastAPI backend from the server. The backend uses Pandas to clean and join the local CSVs (duplicate reviews removed, reviews joined to the catalogue on `product_id`) and returns aggregate metrics. The first request builds a Parquet cache in `backend/.cache/` (gitignored), so later starts take a few seconds instead of about half a minute. Text sentiment is computed locally with a lexicon-based model (VADER, adapted to skincare); no external AI service is called. The CSV files are the source of truth.

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
| `/api/insights?category=` | Business insight findings, hidden gems, products rated below their category, rating momentum, brand quadrants and category demand, with each rule |
| `/api/sentiment?subcategory=` | Text sentiment shares and counts, agreement with star groups, by year, star rating and subcategory |
| `/api/sentiment/rankings?level=product\|brand&subcategory=` | Products or brands (100+ reviews) with the most positive and most negative texts |
| `/api/sentiment/examples?subcategory=` | Example reviews per class and reviews where text and stars disagree |
| `/api/sentiment/topics` | Sentiment per topic (keyword groups) and distinctive words and phrases |
| `/api/sentiment/methodology` | Model, adaptations and validation metrics (accuracy, macro F1, Cohen's kappa, confusion matrix) |

Interactive documentation is at http://127.0.0.1:8011/docs (disabled when `SEPHORA_ENV=production`).

## Tests

The backend tests build a small synthetic dataset at runtime; no real data is needed or committed.

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
cd backend
..\.venv\Scripts\python.exe -m pytest
```

The frontend tests (Vitest and Testing Library) cover formatting, URL filters, chart preparation and the main components.

```powershell
cd frontend
npm run lint
npm test
npm run typecheck
```

GitHub Actions runs the repository scan, dependency audits, the backend and frontend tests, frontend linting (ESLint with the Next.js rules), the type check and the production build on every push and pull request.
