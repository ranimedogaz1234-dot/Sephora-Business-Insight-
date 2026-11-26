"""Print the verified dataset figures: ``python -m sephora`` (run from ``backend/``).

Loads the CSVs named by SEPHORA_DATASET_DIR with the same cleaning as the API, so the
numbers quoted in the README and the About page can be re-checked at any time.
"""

import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sephora import analytics  # noqa: E402
from sephora.data import get_dataset  # noqa: E402

if __name__ == "__main__":
    o = analytics.overview(get_dataset())
    keys = [
        "total_products", "total_brands", "total_categories", "raw_review_rows",
        "duplicates_removed", "total_reviews", "reviewed_products", "average_rating",
        "first_review", "last_review", "review_categories",
    ]
    print(json.dumps({k: o[k] for k in keys}, indent=2))
