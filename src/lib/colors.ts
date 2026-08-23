/** Fixed token-category colors, reused across every chart, card accent and legend. */
export const TOKEN_SERIES = [
  { key: "input_tokens", label: "Input", color: "#60a5fa" }, // blue
  { key: "cache_read_tokens", label: "Cache read", color: "#22d3ee" }, // cyan
  { key: "output_tokens", label: "Output", color: "#34d399" }, // green
  { key: "reasoning_tokens", label: "Reasoning", color: "#a78bfa" }, // violet
] as const;

export type TokenSeriesKey = (typeof TOKEN_SERIES)[number]["key"];
