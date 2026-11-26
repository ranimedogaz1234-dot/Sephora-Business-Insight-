import { describe, expect, it } from "vitest";
import { flagLabel, lovesIndicator, ratingIndicator } from "@/lib/insights";
import { parseProductParams, productFilterQuery } from "@/lib/params";
import type { FilterOptions, ProductOptions } from "@/lib/api";

const options: FilterOptions = { categories: [{ name: "Skincare", count: 3 }], review_subcategories: [], review_years: [] };
const products: ProductOptions = {
  brands: [{ name: "Alpha", count: 2 }],
  subcategories: [{ category: "Skincare", name: "Treatments", count: 1 }],
  flags: [{ key: "on_sale", label: "On sale" }],
  price_range: [3, 1900],
};

describe("product params", () => {
  it("keeps only known values and valid numbers", () => {
    const p = parseProductParams(
      { brand: "Alpha", subcategory: "Treatments", flag: "on_sale", min_rating: "4", min_reviews: "100", min_price: "10", max_price: "49.99" },
      options,
      products,
    );
    expect(p).toMatchObject({ brand: "Alpha", subcategory: "Treatments", flag: "on_sale", min_rating: 4, min_reviews: 100, min_price: 10, max_price: 49.99 });
    const bad = parseProductParams({ brand: "Zeta", flag: "free", min_rating: "4.2", min_reviews: "7", min_price: "-5", max_price: "1e9" }, options, products);
    expect(bad).toMatchObject({ brand: undefined, flag: undefined, min_rating: undefined, min_reviews: undefined, min_price: undefined, max_price: undefined });
  });

  it("swaps an inverted price range and strips sort and page from filter queries", () => {
    const p = parseProductParams({ min_price: "80", max_price: "20", sort: "rating", page: "3" }, options, products);
    expect([p.min_price, p.max_price]).toEqual([20, 80]);
    expect(productFilterQuery(p)).not.toHaveProperty("sort");
    expect(productFilterQuery(p)).not.toHaveProperty("page");
  });
});

describe("product indicators", () => {
  it("describes the rating against the category", () => {
    expect(ratingIndicator(0.31)).toEqual({ text: "+0.31 vs category", tone: "positive" });
    expect(ratingIndicator(-0.5)).toEqual({ text: "−0.50 vs category", tone: "negative" });
    expect(ratingIndicator(0.01)?.text).toBe("At category average");
    expect(ratingIndicator(null)).toBeNull();
  });

  it("describes the loves percentile", () => {
    expect(lovesIndicator(0.97)).toBe("Top 3% loved in category");
    expect(lovesIndicator(1)).toBe("Top 1% loved in category");
    expect(lovesIndicator(0.1)).toBe("Bottom 11% loved in category");
    expect(flagLabel("on_sale")).toBe("On sale");
  });
});
