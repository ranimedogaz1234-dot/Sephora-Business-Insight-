import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ObservationList } from "@/components/ui/Observations";
import { breadcrumbs } from "@/lib/nav";

describe("business insights", () => {
  it("shows a finding's suggested next step only when it has one", () => {
    render(
      <ObservationList
        items={[
          { id: "a", title: "With action", detail: "d", tone: "warning", evidence: {}, action: "Read the low-star reviews." },
          { id: "b", title: "Without action", detail: "d", tone: "neutral", evidence: {} },
        ]}
      />,
    );
    expect(screen.getByText("Read the low-star reviews.")).toBeInTheDocument();
    expect(screen.getAllByText("Suggested next step:")).toHaveLength(1);
  });

  it("is an Overview page", () => {
    expect(breadcrumbs("/insights")).toEqual([{ label: "Overview" }, { label: "Business insights" }]);
  });
});
