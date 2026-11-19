import { describe, expect, it } from "vitest";
import type { CategoryShare, FilterOptions } from "@/lib/api";
import { toQueryString } from "@/lib/api";
import { formatCompact, formatDate, formatPeriod, truncate } from "@/lib/format";
import { brandInsight, categoryInsight, categorySlices, ratingInsight, ratingSlices, trendInsight } from "@/lib/insights";
import { hrefWith, parseProductParams, parseReviewParams } from "@/lib/params";
import { categorical, colors, starRamp } from "@/lib/theme";

// Synthetic values only — not real dataset figures.
const options: FilterOptions = {
  categories: [
    { name: "Skincare", count: 10 },
    { name: "Makeup", count: 5 },
  ],
  review_subcategories: [{ name: "Moisturizers", count: 7 }],
  review_years: [2020, 2021],
};

describe("format", () => {
  it("keeps small numbers exact and compacts large ones", () => {
    expect(formatCompact(9_999)).toBe("9,999");
    expect(formatCompact(1_094_187)).toBe("1.1M");
  });
  it("formats periods and dates without time-zone drift", () => {
    expect(formatPeriod("2021-03")).toBe("Mar 2021");
    expect(formatPeriod("2021")).toBe("2021");
    expect(formatDate("2023-03-21")).toBe("Mar 21, 2023");
    expect(formatDate(null)).toBe("—");
  });
  it("truncates on length", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
});

describe("api", () => {
  it("drops empty query values", () => {
    expect(toQueryString({ q: "oil", category: undefined, page: 2, x: "" })).toBe("?q=oil&page=2");
    expect(toQueryString({})).toBe("");
  });
});

describe("params", () => {
  it("accepts only known values", () => {
    expect(parseProductParams({ q: " oil ", category: "Makeup", sort: "price_asc", page: "3" }, options)).toEqual({
      q: "oil",
      category: "Makeup",
      sort: "price_asc",
      page: 3,
    });
    expect(parseProductParams({ q: "a", category: "Nope", sort: "evil", page: "-2" }, options)).toEqual({
      q: undefined,
      category: undefined,
      sort: "popular",
      page: 1,
    });
    expect(parseReviewParams({ subcategory: "Moisturizers", year: "2021", rating: "5", sort: "helpful" }, options)).toEqual({
      subcategory: "Moisturizers",
      year: 2021,
      rating: 5,
      sort: "helpful",
      page: 1,
    });
    expect(parseReviewParams({ year: "1999", rating: "9", subcategory: "<b>" }, options)).toMatchObject({
      year: undefined,
      rating: undefined,
      subcategory: undefined,
    });
  });

  it("builds links that keep filters and drop page 1", () => {
    const p = { q: "oil", category: undefined, sort: "popular", page: 2 };
    expect(hrefWith("/products", p, { page: 3 })).toBe("/products?q=oil&sort=popular&page=3");
    expect(hrefWith("/products", p, { page: 1 })).toBe("/products?q=oil&sort=popular");
  });
});

describe("insights", () => {
  const cats: CategoryShare[] = [
    { category: "A", products: 50, share: 0.5 },
    { category: "B", products: 20, share: 0.2 },
    { category: "C", products: 10, share: 0.1 },
    { category: "D", products: 8, share: 0.08 },
    { category: "E", products: 6, share: 0.06 },
    { category: "F", products: 4, share: 0.04 },
    { category: "G", products: 2, share: 0.02 },
  ];

  it("gives the largest slices fixed colours and folds the rest into Other", () => {
    const slices = categorySlices(cats);
    expect(slices.map((s) => s.label)).toEqual(["A", "B", "C", "D", "E", "Other (2)"]);
    expect(slices.map((s) => s.color)).toEqual([...categorical, colors.other]);
    expect(slices[5]).toMatchObject({ value: 6, detail: "F, G" });
    expect(slices.reduce((a, s) => a + s.value, 0)).toBe(100);
  });

  it("keeps a single leftover category under its own name", () => {
    expect(categorySlices(cats.slice(0, 6)).at(-1)).toMatchObject({ label: "F", value: 4 });
  });

  it("orders star slices 5 -> 1 on a one-hue ramp", () => {
    const slices = ratingSlices([1, 2, 3, 4, 5].map((r) => ({ rating: r, count: r, share: 0 })));
    expect(slices.map((s) => s.label)).toEqual(["5 stars", "4 stars", "3 stars", "2 stars", "1 star"]);
    expect(slices[0].color).toBe(starRamp[4]);
  });

  it("writes takeaways from the numbers", () => {
    expect(categoryInsight(cats)).toBe("A leads with 50.0% of products, followed by B (20.0%).");
    expect(
      ratingInsight([
        { rating: 5, count: 6, share: 0 },
        { rating: 4, count: 2, share: 0 },
        { rating: 1, count: 2, share: 0 },
      ]),
    ).toBe("80.0% of reviews give 4 or 5 stars.");
    expect(
      trendInsight([
        { period: "2021-01", review_count: 3, average_rating: 4 },
        { period: "2021-02", review_count: 9, average_rating: 4 },
      ]),
    ).toBe("Busiest period: Feb 2021 with 9 reviews.");
    expect(brandInsight([{ brand_name: "X", review_count: 5, share: 0.25, average_rating: 4, products: 1 }])).toBe(
      "X leads; the top 1 brands hold 25.0% of all reviews.",
    );
    expect(trendInsight([])).toBeUndefined();
    expect(ratingInsight([])).toBeUndefined();
  });
});
