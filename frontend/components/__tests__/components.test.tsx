import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Shell, isActive } from "@/components/Shell";
import { DonutChart } from "@/components/charts/DonutChart";
import { yearTicks } from "@/components/charts/TrendChart";
import { Pagination } from "@/components/ui/Pagination";
import { KpiCard } from "@/components/ui/Card";
import { Star } from "lucide-react";

vi.mock("next/navigation", () => ({ usePathname: () => "/products" }));

describe("Shell navigation", () => {
  it("links every page and marks the current one", () => {
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/products", "/brands", "/categories", "/pricing", "/reviews", "/customers", "/about"]);
    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("opens and closes the mobile menu", () => {
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("matches nested paths but not the dashboard", () => {
    expect(isActive("/", "/products")).toBe(false);
    expect(isActive("/reviews", "/reviews")).toBe(true);
    expect(isActive("/products", "/products-x")).toBe(false);
  });
});

describe("DonutChart", () => {
  it("shows the total and a legend with values and shares", () => {
    render(
      <DonutChart
        caption="Test donut"
        unit="Products"
        centerLabel="products"
        slices={[
          { label: "Alpha", value: 75, color: "#A3264F" },
          { label: "Beta", value: 25, color: "#D4A23A" },
        ]}
      />,
    );
    expect(screen.getByText("100")).toBeInTheDocument();
    const legend = screen.getAllByRole("listitem");
    expect(legend[0]).toHaveTextContent("Alpha7575.0%");
    expect(legend[1]).toHaveTextContent("Beta2525.0%");
    const table = screen.getByRole("table", { name: "Test donut" });
    // Hidden via a wrapper: a table ignores sr-only's 1px height and would stretch the page.
    expect(table).not.toHaveClass("sr-only");
    expect(table.parentElement).toHaveClass("sr-only");
  });
});

describe("Pagination", () => {
  it("links to neighbouring pages and disables the ends", () => {
    render(<Pagination page={1} totalPages={3} total={45} pageSize={20} noun="products" href={(p) => `/products?page=${p}`} />);
    expect(screen.getByText("1–20 of 45 products")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/products?page=2");
    expect(screen.queryByRole("link", { name: /previous/i })).not.toBeInTheDocument();
  });

  it("renders nothing without results", () => {
    const { container } = render(<Pagination page={1} totalPages={0} total={0} pageSize={20} noun="x" href={() => "/"} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("KpiCard and trend ticks", () => {
  it("renders the label, value and note", () => {
    render(<KpiCard label="Average rating" value="4.30 ★" note="64% five-star" icon={Star} />);
    expect(screen.getByText("Average rating")).toBeInTheDocument();
    expect(screen.getByText("4.30 ★")).toBeInTheDocument();
  });

  it("labels long monthly series by year only", () => {
    const months = Array.from({ length: 36 }, (_, i) => ({
      period: `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
      review_count: 1,
      average_rating: 4,
    }));
    expect(yearTicks(months)).toEqual(["2020-01", "2021-01", "2022-01"]);
    expect(yearTicks(months.slice(0, 12))).toBeUndefined();
  });
});
