"""Text sentiment on the synthetic reviews (conftest.py; expected values by hand).

Texts: a1 "Loved it" (5★), a4 "Broke me out" (1★), every other review "Nice" (5, 4, 3, 5, 2★).
"Nice" and "Loved it" score positive; "Broke me out" is rewritten to "breakout" (negative).
So 6 of 7 texts are positive and 1 negative. Star groups agree for 5 of them: the 3★
review is "neutral" by stars and the 2★ review "negative", but both texts read positive.
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from sephora import data, sentiment


@pytest.fixture
def scored(dataset_dir, tmp_path, monkeypatch):
    """API client with sentiment computed into a temporary cache."""
    monkeypatch.setenv("SEPHORA_DATASET_DIR", str(dataset_dir))
    monkeypatch.setenv("SEPHORA_CACHE", "1")
    monkeypatch.setenv("SEPHORA_CACHE_DIR", str(tmp_path))
    data.reset()
    sentiment.build(data.get_dataset(), tmp_path, workers=1)
    from main import app

    yield TestClient(app)
    data.reset()


def test_adapted_rules():
    assert sentiment.score("Great", "I love this serum, my skin is glowing.") > 0.05
    assert sentiment.score(None, "This broke me out within two days.") < -0.05  # phrase rule
    assert sentiment.score(None, "I wanted to love it.") < -0.05  # "wanted to love" reads as disappointment
    assert sentiment.score(None, "It is not good.") < -0.05  # VADER negation
    assert sentiment.score(None, None) == 0.0
    assert sentiment.label_of(np.array([0.05, 0.0499, -0.05, -0.2])).tolist() == [2, 1, 0, 0]


def test_metrics_from_a_known_confusion_matrix():
    truth = np.array([2, 2, 2, 0, 0, 1])
    pred = np.array([2, 2, 0, 0, 2, 1])
    m = sentiment._metrics(truth, pred)
    assert m["confusion"] == [[1, 0, 1], [0, 1, 0], [1, 0, 2]]
    assert m["accuracy"] == round(4 / 6, 4)
    per = {p["label"]: p for p in m["per_class"]}
    assert (per["positive"]["precision"], per["positive"]["recall"]) == (round(2 / 3, 4), round(2 / 3, 4))
    assert per["neutral"]["f1"] == 1.0
    # kappa: observed 4/6, expected (2*2 + 1*1 + 3*3) / 36
    assert m["cohen_kappa"] == round((4 / 6 - 14 / 36) / (1 - 14 / 36), 4)


def test_routes_return_503_until_computed(client):
    response = client.get("/api/sentiment")
    assert response.status_code == 503
    assert response.json() == {"detail": "Sentiment has not been computed for this dataset"}


def test_summary(scored):
    body = scored.get("/api/sentiment").json()
    assert body["reviews"] == 7
    assert body["counts"] == {"negative": 1, "neutral": 0, "positive": 6}
    assert body["agreement_with_stars"] == round(5 / 7, 4)
    stars = {s["rating"]: s for s in body["by_stars"]}
    assert (stars[1]["negative"], stars[5]["positive"], stars[4]["reviews"]) == (1.0, 1.0, 1)
    assert [t["period"] for t in body["trend"]] == ["2021", "2022"]
    assert {s["name"] for s in body["by_subcategory"]} == {"Treatments", "Moisturizers", "Cleansers"}

    scoped = scored.get("/api/sentiment", params={"subcategory": "Moisturizers"}).json()
    assert (scoped["reviews"], scoped["shares"]["positive"]) == (2, 1.0)
    assert scored.get("/api/sentiment", params={"subcategory": "Nope"}).status_code == 422


def test_rankings_and_examples(scored):
    body = scored.get("/api/sentiment/rankings").json()
    assert (body["level"], body["min_reviews"], body["eligible"]) == ("product", 100, 0)  # too few reviews
    ranked = sentiment.rankings(data.get_dataset(), data.cache_dir(), "product", min_reviews=1)
    assert ranked["most_negative"][0]["product_id"] == "P1"  # 1 of 4 negative
    brands = sentiment.rankings(data.get_dataset(), data.cache_dir(), "brand", min_reviews=1)
    assert [(b["brand_name"], b["reviews"], b["negative"]) for b in brands["most_negative"]] == [("Alpha", 6, round(1 / 6, 4)), ("Beta", 1, 0.0)]
    assert "product_id" not in brands["most_negative"][0]
    assert scored.get("/api/sentiment/rankings", params={"level": "brand"}).status_code == 200
    assert scored.get("/api/sentiment/rankings", params={"level": "people"}).status_code == 422

    examples = scored.get("/api/sentiment/examples").json()
    assert set(examples) == {"negative", "neutral", "positive", "disagreements"}


def test_methodology_and_topics(scored):
    m = scored.get("/api/sentiment/methodology").json()
    assert m["model_version"] == sentiment.MODEL_VERSION
    assert m["validation"]["sample_size"] == 0  # every synthetic review falls in the development sample
    assert m["validation"]["adapted"] is None
    topics = scored.get("/api/sentiment/topics").json()
    assert {a["aspect"] for a in topics["aspects"]} == set(sentiment.ASPECTS)
    irritation = next(a for a in topics["aspects"] if a["aspect"] == "Breakouts & irritation")
    assert (irritation["mentions"], irritation["negative"]) == (1, 1.0)  # "Broke me out"


def test_no_reviewer_identifiers(scored):
    for path in ("/api/sentiment", "/api/sentiment/examples", "/api/sentiment/rankings", "/api/sentiment/topics"):
        assert "author_id" not in scored.get(path).text
