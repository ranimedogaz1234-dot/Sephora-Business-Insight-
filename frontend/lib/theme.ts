/** Chart colours. The categorical set was checked with the dataviz palette validator
 * (all pairs: lightness band, chroma, colour-blind separation, normal-vision floor). */
export const colors = {
  burgundy: "#800F35",
  rose: "#E8A0B4",
  blush: "#FCEEF2",
  charcoal: "#29252A",
  muted: "#6E6870",
  grid: "#EFEBF0",
  other: "#BDB4BA",
} as const;

/** Fixed order — slice N always gets colour N; extra slices fold into "Other". */
export const categorical = ["#A3264F", "#D4A23A", "#3A6FB0", "#E58FAB", "#5E8F3E"] as const;

/** One hue, light -> dark, for ordered values such as 1 -> 5 stars. */
export const starRamp = ["#F2C4D2", "#E58FAB", "#C2557A", "#A3264F", "#6E0A2C"] as const;

export const axis = {
  tick: { fill: colors.muted, fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const;
