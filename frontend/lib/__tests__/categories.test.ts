import { describe, expect, it } from "vitest";
import { parseCategoryParams } from "@/lib/params";

const paths = { Skincare: ["Moisturizers", "Treatments"], Makeup: ["Lip"] };

describe("category drill-down params", () => {
  it("keeps a valid path", () => {
    expect(parseCategoryParams({ primary: "Skincare", secondary: "Treatments", sort: "median_loves" }, paths)).toEqual({
      primary: "Skincare",
      secondary: "Treatments",
      sort: "median_loves",
    });
  });

  it("drops a subcategory that belongs to another category, or has no category", () => {
    expect(parseCategoryParams({ primary: "Makeup", secondary: "Treatments" }, paths)).toEqual({ primary: "Makeup", secondary: undefined, sort: "products" });
    expect(parseCategoryParams({ secondary: "Lip" }, paths).secondary).toBeUndefined();
    expect(parseCategoryParams({ primary: "Skincare" }, null).primary).toBeUndefined();
  });
});
