import { describe, expect, it } from "vitest";
import { correlationLabel } from "@/lib/insights";

describe("correlationLabel", () => {
  it("describes strength and direction", () => {
    expect(correlationLabel(0.05)).toBe("no meaningful relationship");
    expect(correlationLabel(-0.05)).toBe("no meaningful relationship");
    expect(correlationLabel(0.2)).toBe("a weak positive relationship");
    expect(correlationLabel(-0.4)).toBe("a moderate negative relationship");
    expect(correlationLabel(0.8)).toBe("a strong positive relationship");
    expect(correlationLabel(null)).toBe("not enough data");
  });
});
