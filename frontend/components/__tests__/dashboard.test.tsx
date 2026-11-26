import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Star } from "lucide-react";
import { KpiCard } from "@/components/ui/Card";
import { ObservationList } from "@/components/ui/Observations";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { recommendationColumns, recommendationInsight } from "@/lib/insights";
import { parseDashboardParams } from "@/lib/params";
import type { RecommendationPatterns } from "@/lib/api";

const recs: RecommendationPatterns = {
  answered: 80,
  unanswered: 20,
  recommend_rate: 0.75,
  by_rating: [1, 2, 3, 4, 5].map((r) => ({ rating: r, answered: r === 3 ? 0 : 16, recommend_rate: r === 3 ? null : r / 5 })),
  by_year: [],
};

describe("dashboard helpers", () => {
  it("accepts only catalogue categories as the global filter", () => {
    const options = { categories: [{ name: "Hair", count: 1 }], review_subcategories: [], review_years: [] };
    expect(parseDashboardParams({ category: "Hair" }, options)).toEqual({ category: "Hair" });
    expect(parseDashboardParams({ category: "Nope" }, options)).toEqual({ category: undefined });
    expect(parseDashboardParams({ category: "Hair" }, null)).toEqual({ category: undefined });
  });

  it("keeps unknown recommendation rates as gaps and states the excluded share", () => {
    const cols = recommendationColumns(recs);
    expect(cols.map((c) => c.value)).toEqual([0.2, 0.4, null, 0.8, 1]);
    expect(cols[0].details?.[0].value).toBe("16");
    expect(recommendationInsight(recs)).toBe("75.0% recommend overall; 20.0% of reviews did not answer and are excluded.");
  });
});

describe("dashboard components", () => {
  it("turns a KPI card into a described link", () => {
    render(<KpiCard label="Products" value="8,494" icon={Star} href="/products" />);
    expect(screen.getByRole("link", { name: "Products: 8,494. View details" })).toHaveAttribute("href", "/products");
  });

  it("spells out each observation's tone", () => {
    render(
      <ObservationList
        items={[
          { id: "a", title: "Up 5%", detail: "Detail", tone: "positive", evidence: { change: 0.05 } },
          { id: "b", title: "Down", detail: "Detail", tone: "warning", evidence: {} },
        ]}
      />,
    );
    expect(screen.getByText("Strength")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
  });

  it("lists unavailable values as text in the chart's table", () => {
    render(
      <ColumnChart
        caption="Rates"
        unit="Rate"
        format="percent"
        data={[
          { label: "A", value: 0.5 },
          { label: "B", value: null },
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "Rates" });
    expect(table).toHaveTextContent("A50%");
    expect(table).toHaveTextContent("BNot available");
  });
});
