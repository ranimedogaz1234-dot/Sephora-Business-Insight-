import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductCard } from "@/components/ui/ProductCard";
import { ReviewCard } from "@/components/ui/ReviewCard";
import type { ProductRow } from "@/lib/api";

const product: ProductRow = {
  product_id: "P1",
  product_name: "Glow Serum",
  brand_id: 1,
  brand_name: "Alpha",
  category: "Skincare",
  subcategory: "Treatments",
  price: 40,
  sale_price: 30,
  rating: null,
  catalogue_reviews: null,
  loves: 12500,
  review_count: 0,
  rating_vs_category: null,
  loves_percentile: null,
  flags: [],
};

describe("ProductCard", () => {
  it("links to the details page and shows the sale price and missing rating as text", () => {
    render(<ProductCard p={product} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/products/P1");
    expect(link).toHaveTextContent("$30");
    expect(link).toHaveTextContent("Not rated");
    expect(link).toHaveTextContent("12.5Kloves");
  });
});

describe("ReviewCard", () => {
  it("renders the review, the skin type and the helpful votes for screen readers", () => {
    render(
      <ReviewCard
        r={{ rating: 4, recommended: false, helpful_votes: 3, date: "2022-02-10", title: "Nice", text: "Works well", skin_type: "dry" }}
        product={{ id: "P1", name: "Glow Serum", brand: "Alpha" }}
      />,
    );
    expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByText("Skin: dry")).toBeInTheDocument();
    expect(screen.getByText("Does not recommend")).toBeInTheDocument();
    expect(screen.getByText(/people found this helpful/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Glow Serum" })).toHaveAttribute("href", "/products/P1");
  });

  it("says when a review has no text", () => {
    render(<ReviewCard r={{ rating: 5, recommended: null, helpful_votes: 0, date: "2021-01-01", title: null, text: null, skin_type: null }} />);
    expect(screen.getByText("No review text.")).toBeInTheDocument();
    expect(screen.queryByText(/recommend/i)).not.toBeInTheDocument();
  });
});
