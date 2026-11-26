# Security and privacy

## Reporting a problem

If you find a security or privacy problem, please do not open a public issue. Contact the repository owner, [@ranimedogaz1234-dot](https://github.com/ranimedogaz1234-dot), through GitHub instead.

## What the repository protects

- **No private data in Git.** The Sephora CSV files, the Parquet cache, `.env` files, keys and certificates are gitignored, and the scanner blocks them if they are staged anyway.
- **No credentials in the browser.** The frontend calls the API only from the Next.js server. `SEPHORA_API_URL` is a server-side variable, and the scanner blocks `NEXT_PUBLIC_` variables whose names look like secrets.
- **No reviewer identifiers in API responses.** `author_id` is used only to remove duplicate reviews and to count distinct reviewer IDs. It is dropped before any data is cached or returned.
- **Validated input.** Query parameters have length and range limits, and category, brand and filter values are checked against the dataset.
- **Quiet errors.** When the dataset is missing, the API returns a fixed message and never a local path. In production (`SEPHORA_ENV=production`) the interactive API docs and the OpenAPI schema are switched off.

## Automated checks

`scripts/check_public_repo.py` runs in the pre-commit and pre-push hooks and in CI. It blocks:

- private files (datasets, caches, `.env` files, keys);
- common credential formats (GitHub, cloud and AI provider tokens, private keys, credentials in URLs, literal secret assignments);
- personal email addresses and local user paths (paths inside a Windows, macOS or Linux user folder) in file contents and commit messages;
- in the hooks only, new commits made with a personal email address. Use your GitHub noreply address instead (GitHub → Settings → Emails).

CI also audits the Python runtime and development dependencies with `pip-audit` and the frontend with `npm audit`. On GitHub, secret scanning, push protection and Dependabot alerts are switched on.

## Limits

These checks are pattern-based. They can miss a secret in an unusual format, so review every diff before you push. The API has no authentication and is meant to run locally. Add authentication, authorization and rate limits before deploying it publicly.
