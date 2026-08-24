"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** API path of the entity, e.g. /api/sessions/ses_x or /api/projects/proj_y */
  endpoint: string;
  field: "title" | "name";
  initialValue: string | null;
}

/** Inline rename affordance: pencil → input → PATCH → refresh. */
export function RenameControl({ endpoint, field, initialValue }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        title="Rename"
        aria-label="Rename"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" />
      </Button>
    );
  }

  return (
    <RenameForm
      endpoint={endpoint}
      field={field}
      initialValue={initialValue}
      onDone={() => setOpen(false)}
    />
  );
}

function RenameForm({
  endpoint,
  field,
  initialValue,
  onDone,
}: Props & { onDone: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value.trim() || null }),
      });
      onDone();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Input
        autoFocus
        value={value}
        maxLength={200}
        placeholder={field === "title" ? "Session name" : "Project name"}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        className="h-7 w-56 text-sm"
      />
      <Button type="submit" variant="ghost" size="icon" className="size-7" disabled={saving} aria-label="Save">
        <Check className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onDone}
        aria-label="Cancel"
      >
        <X className="size-3.5" />
      </Button>
    </form>
  );
}
