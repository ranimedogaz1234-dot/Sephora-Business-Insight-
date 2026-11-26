import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StackedShares } from "@/components/charts/StackedShares";

describe("StackedShares", () => {
  it("names every segment and lists the shares in its table", () => {
    render(
      <StackedShares
        caption="Mix"
        totalLabel="Reviews"
        segments={[
          { label: "Low", color: "#eee" },
          { label: "High", color: "#800" },
        ]}
        rows={[{ label: "Dry", shares: [0.25, 0.75], total: 40 }]}
      />,
    );
    expect(screen.getByRole("table", { name: "Mix" })).toHaveTextContent("Dry25.0%75.0%40");
  });
});
