import { TOKEN_SERIES } from "@/lib/colors";

/** Persistent color legend for the four token categories. */
export function TokenLegend({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className ?? ""}`}>
      {TOKEN_SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}
