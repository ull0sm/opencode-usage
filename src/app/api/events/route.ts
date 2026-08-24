import { NextRequest } from "next/server";
import { getDataSignature } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 1000;
const HEARTBEAT_MS = 15000;

/**
 * GET /api/events — Server-Sent Events stream.
 * Emits a "changed" event whenever the database signature (row counts +
 * high-water marks across usage_events/sessions/projects) differs from the
 * previous poll. Heartbeat comments keep proxies from closing idle streams.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let closed = false;
  let lastSig = getDataSignature();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("hello", { sig: lastSig });

      let lastBeat = Date.now();
      req.signal.addEventListener("abort", () => {
        closed = true;
      });

      void (async () => {
        while (!closed) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (closed) break;
          try {
            const sig = getDataSignature();
            if (sig !== lastSig) {
              lastSig = sig;
              send("changed", { sig });
              lastBeat = Date.now();
            } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
              controller.enqueue(encoder.encode(": ping\n\n"));
              lastBeat = Date.now();
            }
          } catch {
            break;
          }
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      })();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
