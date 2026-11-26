"""Review analytics on the synthetic reviews (conftest.py; expected values by hand).

Texts: "Loved it" (P1 5★), "Broke me out" (P1 1★) and "Nice" for the other five; every
title is "Title". Recommendation: 4 yes, 2 no, 1 unknown (P2 3★).
"""

import pytest


def total(client, **params):
    return client.get("/api/reviews", params=params).json()["total"]


def test_text_search_is_literal_and_covers_titles(client):
    assert total(client, q="nice") == 5
    assert total(client, q="TITLE") == 7  # titles are searched too, any case
    assert total(client, q="broke") == 1
    assert total(client, q="n.c") == 0  # not a regex


@pytest.mark.parametrize(
    "params, expected",
    [
        ({"recommended": "yes"}, 4),
        ({"recommended": "no"}, 2),
        ({"recommended": "unknown"}, 1),
        ({"brand": "Alpha"}, 6),
        ({"product_id": "P2"}, 2),
        ({"skin_type": "dry"}, 7),
        ({"has_text": "false"}, 0),
        ({"brand": "Alpha", "rating": 5, "year": 2021}, 2),
    ],
)
def test_filters(client, params, expected):
    assert total(client, **params) == expected


def test_summary_groups_and_text(client):
    s = client.get("/api/reviews/summary").json()
    assert [(g["key"], g["count"]) for g in s["rating_groups"]] == [("positive", 4), ("neutral", 1), ("negative", 2)]
    assert s["recommendation"] == {"yes": 4, "no": 2, "unknown": 1}
    assert (s["text"]["with_text"], s["text"]["median_length"]) == (7, 4.0)
    assert s["text"]["length_bands"][1] == {"label": "Under 100", "count": 7, "average_rating": round(25 / 7, 2)}
    assert s["text"]["length_bands"][0]["average_rating"] is None  # no review without text
    assert s["helpfulness"] == {"with_votes": 4, "total_helpful_votes": 15, "total_unhelpful_votes": 0}
    assert [r["helpful_votes"] for r in s["most_helpful"]] == [9, 3, 2]
    assert "term" not in s


def test_search_term_is_compared_with_the_rest(client):
    s = client.get("/api/reviews/summary", params={"q": "loved"}).json()
    assert s["term"] == {
        "q": "loved",
        "matches": 1,
        "base_reviews": 7,
        "mention_share": round(1 / 7, 4),
        "average_rating_with_term": 5.0,
        "average_rating_without_term": round(20 / 6, 2),
    }


def test_longest_sort_and_card_fields(client):
    first = client.get("/api/reviews", params={"sort": "longest", "page_size": 1}).json()["items"][0]
    assert first["text"] == "Broke me out"
    assert first["unhelpful_votes"] == 0 and "author_id" not in first


@pytest.mark.parametrize(
    "params",
    [{"q": "ab"}, {"skin_type": "oily"}, {"brand": "Nobody"}, {"recommended": "maybe"}, {"product_id": "X1"}, {"sort": "random"}],
)
def test_invalid_review_filters(client, params):
    assert client.get("/api/reviews", params=params).status_code == 422
