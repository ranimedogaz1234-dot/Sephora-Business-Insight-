import { describe, expect, it } from "vitest";
import { formatCompound, mostNegativeTopic, sentimentTrendInsight } from "@/lib/insights";
import { parseSentimentParams } from "@/lib/params";
import { NAV } from "@/lib/nav";

const options = { categories: [], review_subcategories: [{ name: "Cleansers", count: 9 }], review_years: [] };
const shares = (positive: number, negative: number) => ({ positive, neutral: 1 - positive - negative, negative });

describe("sentiment params", () => {
  it("accepts known subcategories and levels only", () => {
    expect(parseSentimentParams({ subcategory: "Cleansers", level: "brand" }, options)).toEqual({ subcategory: "Cleansers", level: "brand" });
    expect(parseSentimentParams({ subcategory: "Lipstick", level: "people" }, options)).toEqual({ subcategory: undefined, level: "product" });
  });

  it("is in the navigation", () => {
    expect(NAV.some((i) => i.href === "/sentiment")).toBe(true);
  });
});

describe("sentiment insights", () => {
  it("formats compound scores with a sign", () => {
    expect(formatCompound(0.4213)).toBe("+0.42");
    expect(formatCompound(-0.126)).toBe("−0.13");
    expect(formatCompound(0)).toBe("0.00");
    expect(formatCompound(null)).toBe("—");
  });

  it("picks the most negative topic among common ones", () => {
    const aspect = (name: string, share: number, negative: number, mentions = 100) => ({ aspect: name, pattern: "", mentions, share, average_rating: 4, ...shares(0.5, negative) });
    const topics = [aspect("Scent", 0.2, 0.1), aspect("Breakouts", 0.1, 0.3), aspect("Rare", 0.001, 0.9)];
    expect(mostNegativeTopic(topics)?.aspect).toBe("Breakouts");
    expect(mostNegativeTopic([])).toBeUndefined();
  });

  it("describes the change between the first and last well-covered years", () => {
    const year = (period: string, reviews: number, positive: number) => ({ period, reviews, average_compound: 0.5, ...shares(positive, 0.1) });
    expect(sentimentTrendInsight([year("2008", 10, 0.5), year("2010", 2000, 0.8), year("2023", 5000, 0.75)])).toBe(
      "Positive texts fell 5.0 points: 80.0% in 2010, 75.0% in 2023 (years with 1,000+ reviews).",
    );
    expect(sentimentTrendInsight([year("2020", 5000, 0.8)])).toBeUndefined();
  });
});
