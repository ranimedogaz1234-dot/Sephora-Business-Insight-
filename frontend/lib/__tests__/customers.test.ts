import { describe, expect, it } from "vitest";
import { parseCustomerParams } from "@/lib/params";

const options = { categories: [], review_subcategories: [{ name: "Cleansers", count: 9 }], review_years: [] };

describe("customer params", () => {
  it("accepts known subcategories and attributes only", () => {
    expect(parseCustomerParams({ subcategory: "Cleansers", attribute: "skin_tone" }, options)).toEqual({ subcategory: "Cleansers", attribute: "skin_tone" });
    expect(parseCustomerParams({ subcategory: "Lipstick", attribute: "age" }, options)).toEqual({ subcategory: undefined, attribute: "skin_type" });
  });
});
