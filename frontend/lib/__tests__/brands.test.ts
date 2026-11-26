import { describe, expect, it } from "vitest";
import { parseBrandParams } from "@/lib/params";

const options = { categories: [{ name: "Makeup", count: 1 }], review_subcategories: [], review_years: [] };

describe("brand params", () => {
  it("accepts known categories, sizes and sorts only", () => {
    expect(parseBrandParams({ q: "dior", category: "Makeup", min_products: "10", sort: "loves", page: "2" }, options)).toEqual({
      q: "dior",
      category: "Makeup",
      min_products: 10,
      sort: "loves",
      page: 2,
    });
    expect(parseBrandParams({ q: "d", category: "Cars", min_products: "7", sort: "drop" }, options)).toEqual({
      q: undefined,
      category: undefined,
      min_products: undefined,
      sort: "products",
      page: 1,
    });
  });
});
