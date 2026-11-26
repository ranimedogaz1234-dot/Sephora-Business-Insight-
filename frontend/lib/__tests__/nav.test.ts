import { describe, expect, it } from "vitest";
import { NAV, NAV_SECTIONS, breadcrumbs, currentItem } from "@/lib/nav";

describe("navigation", () => {
  it("lists every page once, grouped in sections", () => {
    const hrefs = NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(NAV_SECTIONS.every((s) => s.items.length > 0)).toBe(true);
  });

  it("finds the page that owns a path", () => {
    expect(currentItem("/")?.label).toBe("Dashboard");
    expect(currentItem("/reviews")?.label).toBe("Reviews");
    expect(currentItem("/products/P123")?.label).toBe("Products");
    expect(currentItem("/nowhere")).toBeUndefined();
  });

  it("builds breadcrumbs with a Details step for nested pages", () => {
    expect(breadcrumbs("/products")).toEqual([{ label: "Analytics" }, { label: "Products" }]);
    expect(breadcrumbs("/products/P123")).toEqual([
      { label: "Analytics" },
      { label: "Products", href: "/products" },
      { label: "Details" },
    ]);
    expect(breadcrumbs("/unknown")).toEqual([]);
  });
});
