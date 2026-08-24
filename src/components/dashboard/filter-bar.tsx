"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModelMultiSelect } from "@/components/dashboard/model-multi-select";
import { deletePreset, loadPresets, savePreset, type SavedPreset } from "@/lib/presets";

const PRESETS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

const GROUPS = [
  { value: "day", label: "Day" },
  { value: "hour", label: "Hour of day" },
  { value: "model", label: "Model" },
  { value: "session", label: "Session" },
  { value: "project", label: "Project" },
] as const;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function FilterBar({ models }: { models: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const preset = params.get("preset") ?? (params.get("from") || params.get("to") ? "custom" : "all");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const selectedModels = params.getAll("model").flatMap((m) => m.split(",")).filter(Boolean);
  const group = params.get("group") ?? "day";
  const session = params.get("session") ?? "";

  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftSession, setDraftSession] = useState(session);

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Resync drafts when URL state changes externally (e.g. preset applied) —
  // render-phase state adjustment per https://react.dev/learn/you-might-not-need-an-effect
  const [syncedUrl, setSyncedUrl] = useState({ from, to, session });
  if (syncedUrl.from !== from || syncedUrl.to !== to || syncedUrl.session !== session) {
    setSyncedUrl({ from, to, session });
    setDraftFrom(from);
    setDraftTo(to);
    setDraftSession(session);
  }

  const push = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      // let the server group days/hours by this viewer's calendar (JS offset convention)
      next.set("tz", String(new Date().getTimezoneOffset()));
      mutate(next);
      startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }));
    },
    [params, router]
  );

  const currentParams = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const key of ["from", "to", "session", "group"]) {
      const v = params.get(key);
      if (v) out[key] = v;
    }
    const modelsNow = params.getAll("model").filter(Boolean);
    if (modelsNow.length === 1) out.model = modelsNow[0];
    else if (modelsNow.length > 1) out.model = modelsNow.join(",");
    return out;
  }, [params]);

  const applyPreset = (p: SavedPreset) => {
    push((next) => {
      next.delete("model");
      next.delete("preset");
      for (const [k, v] of Object.entries(p.params)) {
        if (k === "model") v.split(",").forEach((m) => next.append("model", m));
        else next.set(k, v);
      }
    });
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    setSavedPresets(savePreset(name, currentParams()));
    setPresetName("");
    setSavingPreset(false);
  };

  const setPreset = (value: string) => {
    push((p) => {
      p.set("preset", value);
      if (value === "all") {
        p.delete("from");
        p.delete("to");
      } else if (/^\d+$/.test(value)) {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - Number(value) + 1);
        p.set("from", isoDay(start));
        p.set("to", isoDay(end));
      }
    });
  };

  const applyCustom = () => {
    push((p) => {
      p.set("preset", "custom");
      if (draftFrom) p.set("from", draftFrom);
      else p.delete("from");
      if (draftTo) p.set("to", draftTo);
      else p.delete("to");
    });
  };

  const hasAny =
    Boolean(from || to || session) || selectedModels.length > 0 || group !== "day";

  return (
    <div className={isPending ? "flex flex-wrap items-end gap-3 opacity-60" : "flex flex-wrap items-end gap-3"}>
      <div className="w-40">
        <Label className="text-xs text-muted-foreground">Range</Label>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...PRESETS.map((p) => ({ value: p.value as string, label: p.label })),
              ...(preset === "custom" ? [{ value: "custom", label: "Custom" }] : []),
            ].map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="filter-from" className="text-xs text-muted-foreground">From</Label>
        <Input
          id="filter-from"
          type="date"
          value={draftFrom}
          onChange={(e) => setDraftFrom(e.target.value)}
          onBlur={applyCustom}
          className="mt-1.5 w-36"
        />
      </div>
      <div>
        <Label htmlFor="filter-to" className="text-xs text-muted-foreground">To</Label>
        <Input
          id="filter-to"
          type="date"
          value={draftTo}
          onChange={(e) => setDraftTo(e.target.value)}
          onBlur={applyCustom}
          className="mt-1.5 w-36"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Models</Label>
        <ModelMultiSelect
          models={models}
          selected={selectedModels}
          onChange={(selected) =>
            push((p) => {
              p.delete("model");
              selected.forEach((m) => p.append("model", m));
            })
          }
          className="mt-1.5 w-48"
        />
      </div>

      <div className="w-44">
        <Label htmlFor="filter-session" className="text-xs text-muted-foreground">Session contains</Label>
        <Input
          id="filter-session"
          placeholder="ses_…"
          value={draftSession}
          onChange={(e) => setDraftSession(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && push((p) => (draftSession ? p.set("session", draftSession) : p.delete("session")))}
          onBlur={() => push((p) => (draftSession ? p.set("session", draftSession) : p.delete("session")))}
          className="mt-1.5 w-full font-mono text-xs"
        />
      </div>

      <div className="w-36">
        <Label className="text-xs text-muted-foreground">Group by</Label>
        <Select
          value={group}
          onValueChange={(v) =>
            push((p) => (v === "day" ? p.delete("group") : p.set("group", v)))
          }
        >
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DropdownMenu onOpenChange={(open) => open && setSavedPresets(loadPresets())}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1.5">
            <Bookmark className="size-4" /> Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Saved filter presets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {savedPresets.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Nothing saved yet.
            </p>
          )}
          {savedPresets.map((p) => (
            <DropdownMenuItem key={p.name} onSelect={() => applyPreset(p)} className="justify-between">
              <span className="truncate">{p.name}</span>
              <Trash2
                className="size-3.5 shrink-0 opacity-50 hover:!opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setSavedPresets(deletePreset(p.name));
                }}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {!savingPreset ? (
            <DropdownMenuItem onSelect={() => setSavingPreset(true)}>
              <Plus /> Save current filters…
            </DropdownMenuItem>
          ) : (
            <div className="flex items-center gap-1 p-1">
              <Input
                autoFocus
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                placeholder="Preset name"
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 px-2" onClick={handleSavePreset}>
                Save
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasAny && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraftFrom("");
            setDraftTo("");
            setDraftSession("");
            push((p) => {
              ["from", "to", "model", "session", "group", "preset"].forEach((k) => p.delete(k));
            });
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
