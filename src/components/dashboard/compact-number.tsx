"use client";

import { useState } from "react";
import { fmtInt } from "@/lib/format";

/** K thousands · M millions (10 lakh) · B billions · T trillions */
function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) {
    // never print raw float noise (0.007470239999…); keep 3 meaningful digits
    return String(parseFloat(n.toPrecision(3)));
  }
  const units = [
    { v: 1e12, s: "T" },
    { v: 1e9, s: "B" },
    { v: 1e6, s: "M" },
    { v: 1e3, s: "K" },
  ];
  for (const u of units) {
    if (abs >= u.v) {
      const scaled = n / u.v;
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${parseFloat(scaled.toFixed(digits))}${u.s}`;
    }
  }
  return String(n);
}

/** Big stat number: compact (10.4M) by default, click for the exact value. */
export function CompactNumber({
  value,
  prefix = "",
  decimals,
}: {
  value: number;
  prefix?: string;
  /** Fixed decimal places when expanded (e.g. 4 for USD costs); default groups as integer. */
  decimals?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const full =
    decimals !== undefined
      ? `${prefix}${value.toFixed(decimals)}`
      : `${prefix}${fmtInt(value)}`;

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      title={expanded ? "Click for compact view" : "Click for exact value"}
      aria-label={expanded ? full : `${full} — click to expand`}
      className="block w-full cursor-pointer text-left text-[inherit] font-semibold leading-tight tracking-tight transition-opacity hover:opacity-75"
    >
      {expanded ? full : `${prefix}${compact(value)}`}
    </button>
  );
}
