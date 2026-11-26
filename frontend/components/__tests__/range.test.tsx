import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RangeBars } from "@/components/charts/RangeBars";

describe("RangeBars", () => {
  it("lists values and bands in its table and marks missing values", () => {
    render(
      <RangeBars
        caption="Prices"
        domain={[0, 100]}
        format="usd"
        valueLabel="Median"
        bandLabel="Middle 50%"
        rows={[
          { label: "A", value: 40, low: 20, high: 60 },
          { label: "B", value: null },
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "Prices" });
    expect(table).toHaveTextContent("A$40$20 – $60");
    expect(table).toHaveTextContent("BNot availableNot available");
  });
});
