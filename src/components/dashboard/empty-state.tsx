import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  /** Callers pass their own action buttons/links (e.g. clear filters). */
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No usage in this range",
  description,
  actions,
  className,
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 py-10 text-center ${className ?? ""}`}
    >
      <Inbox className="mb-1 size-6 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {actions && <div className="mt-2 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
