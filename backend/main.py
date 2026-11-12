"""Loopback startup check for Sephora Business Insight."""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

FILES = (
    "product_info.csv",
    "reviews_0-250.csv",
    "reviews_250-500.csv",
    "reviews_500-750.csv",
    "reviews_750-1250.csv",
    "reviews_1250-end.csv",
)

app = FastAPI(title="Sephora Business Insight")


@app.get("/health")
def health() -> dict[str, str | bool]:
    configured = os.getenv("SEPHORA_DATASET_DIR", "").strip()
    dataset_ready = False
    if configured:
        directory = Path(configured).expanduser()
        if not directory.is_absolute():
            directory = ROOT / directory
        dataset_ready = all((directory / file).is_file() for file in FILES)
    return {"status": "ok", "dataset_ready": dataset_ready}
