"""Customer insights on the synthetic reviews (conftest.py; expected values by hand).

Skin tone answers: fair (a2 5★, a3 4★, a7 2★), lightMedium (a1 5★), notSureST (a5 3★);
two reviews did not answer. Eye colour: "Grey" (a1) and "gray" (a2) are the same answer.
"""

from sephora import customers


def attribute(body, name):
    return next(a for a in body["attributes"] if a["attribute"] == name)


def test_coverage_and_groups(client):
    body = client.get("/api/customers").json()
    assert (body["reviews"], body["total_reviews"]) == (7, 7)
    tone = attribute(body, "skin_tone")
    assert (tone["answered"], tone["coverage"]) == (5, round(5 / 7, 4))
    assert [g["label"] for g in tone["groups"]] == ["Fair", "Light-medium", "Not sure"]  # tone scale order
    fair = tone["groups"][0]
    assert (fair["count"], fair["share"], fair["average_rating"]) == (3, 0.6, round(11 / 3, 2))
    assert fair["recommend_rate"] == round(2 / 3, 4)
    assert (fair["positive_share"], fair["negative_share"]) == (round(2 / 3, 4), round(1 / 3, 4))
    assert fair["rating_shares"] == [0.0, round(1 / 3, 4), 0.0, round(1 / 3, 4), round(1 / 3, 4)]
    assert tone["groups"][2]["recommend_rate"] is None  # the only answer is unknown

    eye = attribute(body, "eye_color")
    assert [(g["label"], g["count"]) for g in eye["groups"]] == [("Gray", 2)]  # Grey + gray merged
    assert attribute(body, "skin_type")["coverage"] == 1.0
    assert {g["label"] for g in attribute(body, "hair_color")["groups"]} == {"Brown", "Black"}


def test_activity_counts_ids_without_exposing_them(client):
    body = client.get("/api/customers").json()
    assert body["activity"]["distinct_reviewer_ids"] == 7
    assert "a1" not in str(body) and "author" not in str(body)


def test_subcategory_scope(client):
    body = client.get("/api/customers", params={"subcategory": "Cleansers"}).json()
    assert body["reviews"] == 1
    assert [g["label"] for g in attribute(body, "skin_tone")["groups"]] == ["Fair"]
    assert client.get("/api/customers", params={"subcategory": "Nope"}).status_code == 422


def test_preferences(client, monkeypatch):
    body = client.get("/api/customers/preferences", params={"attribute": "skin_tone"}).json()
    assert all(g["top_rated"] == [] for g in body["groups"])  # below the 100-review threshold

    monkeypatch.setattr(customers, "MIN_GROUP_REVIEWS_FOR_PRODUCT", 1)
    monkeypatch.setattr(customers, "MIN_SUBCATEGORY_REVIEWS", 1)
    from sephora import data

    data.reset()
    fair = client.get("/api/customers/preferences", params={"attribute": "skin_tone"}).json()["groups"][0]
    # Overall answering reviews: Treatments 3/5, Cleansers 1/5. Fair: Treatments 2/3, Cleansers 1/3.
    assert [(s["name"], s["lift"]) for s in fair["subcategories"]] == [("Cleansers", 1.67), ("Treatments", 1.11)]
    assert [(p["product_id"], p["average_rating"]) for p in fair["top_rated"]] == [("P1", 4.5), ("P3", 2.0)]
    scoped = client.get("/api/customers/preferences", params={"attribute": "skin_tone", "subcategory": "Treatments"}).json()
    assert all(g["subcategories"] == [] for g in scoped["groups"])  # every lift would be 1.0
    assert client.get("/api/customers/preferences", params={"attribute": "age"}).status_code == 422
