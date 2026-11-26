import { describe, expect, it } from "vitest";
import { parseReviewParams, reviewFilterQuery } from "@/lib/params";

const options = { categories: [], review_subcategories: [{ name: "Cleansers", count: 1 }], review_years: [2022] };
const extra = { brands: ["LANEIGE"], skin_types: ["dry", "oily"] };

describe("review params", () => {
  it("accepts search, product, brand, recommendation, skin type and text filters", () => {
    const p = parseReviewParams(
      { q: "  broke me out ", product_id: "P420652", brand: "LANEIGE", recommended: "no", skin_type: "dry", has_text: "true", sort: "longest" },
      options,
      extra,
    );
    expect(p).toMatchObject({ q: "broke me out", product_id: "P420652", brand: "LANEIGE", recommended: "no", skin_type: "dry", has_text: "true", sort: "longest" });
    expect(reviewFilterQuery(p)).not.toHaveProperty("sort");
  });

  it("rejects short searches, malformed IDs and unknown values", () => {
    const p = parseReviewParams({ q: "ab", product_id: "../x", brand: "Nobody", recommended: "maybe", skin_type: "scaly", has_text: "1" }, options, extra);
    expect(p).toMatchObject({ q: undefined, product_id: undefined, brand: undefined, recommended: undefined, skin_type: undefined, has_text: undefined });
  });
});
