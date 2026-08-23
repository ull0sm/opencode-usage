"use client";

import { useSyncExternalStore } from "react";
import { fmtDateTime, fmtDateTimeUtc } from "@/lib/format";

const noopSubscribe = () => () => {};

/**
 * Renders timestamps in the *viewer's* timezone.
 *
 * Server components can't know the browser's timezone, so the SSR/hydration
 * markup shows UTC; immediately after hydration this swaps to the local
 * rendering (via useSyncExternalStore's server/client snapshots).
 * Pair with the <TzSync /> cookie for server-side day/hour bucketing.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => fmtDateTime(iso),
    () => fmtDateTimeUtc(iso)
  );
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
