"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Opens an SSE connection to /api/events and calls router.refresh() whenever
 * the server reports new data. Renders a small fixed live indicator.
 */
export function LiveRefresh() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("changed", () => {
      router.refresh();
    });
    return () => es.close();
  }, [router]);

  return (
    <div
      className="fixed right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur"
      title={connected ? "Live updates connected" : "Reconnecting…"}
    >
      <span className="relative flex size-2">
        {connected && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            connected ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
        />
      </span>
      {connected ? "live" : "offline"}
    </div>
  );
}
