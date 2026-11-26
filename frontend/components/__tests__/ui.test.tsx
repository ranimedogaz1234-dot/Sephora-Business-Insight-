import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Shell } from "@/components/Shell";
import { Badge } from "@/components/ui/Badge";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { Stars } from "@/components/ui/Stars";
import { Missing } from "@/components/ui/Table";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/P1" }));

describe("Shell layout", () => {
  it("has a skip link, section headings and breadcrumbs", () => {
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getAllByText("Analytics").length).toBeGreaterThan(0);
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs).toHaveTextContent("AnalyticsProductsDetails");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("moves focus into the mobile menu and back to the trigger", () => {
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });
});

describe("small components", () => {
  it("announces star ratings as text", () => {
    render(<Stars rating={4} />);
    expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeInTheDocument();
  });

  it("marks the active segmented option", () => {
    render(<SegmentedLinks label="Sort" options={{ a: "A", b: "B" }} active="b" href={(v) => `/x?sort=${v}`} />);
    expect(screen.getByRole("link", { name: "B" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("href", "/x?sort=a");
  });

  it("renders badges and missing values with readable text", () => {
    render(
      <>
        <Badge tone="positive">Recommended</Badge>
        <Missing label="No rating" />
      </>,
    );
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("No rating")).toHaveClass("sr-only");
  });
});
