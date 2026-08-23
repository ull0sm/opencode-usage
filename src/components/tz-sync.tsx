"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Publishes the browser's UTC offset as a cookie so server components can
 * bucket days/hours in the viewer's local calendar. If the cookie had to be
 * created or updated (e.g. very first visit), triggers one refresh so the
 * current page re-renders with correct bucketing.
 */
export function TzSync() {
  const router = useRouter();

  useEffect(() => {
    const offset = String(new Date().getTimezoneOffset());
    const match = document.cookie.match(/(?:^|;\s*)tz=([^;]*)/);
    if (match?.[1] !== offset) {
      document.cookie = `tz=${offset}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [router]);

  return null;
}
