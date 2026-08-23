"use client";

import { useMemo } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  models: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

/** Multi-select dropdown for filtering by one or more models. */
export function ModelMultiSelect({ models, selected, onChange, className }: Props) {
  const label = useMemo(() => {
    if (selected.length === 0) return "All models";
    if (selected.length === 1) return selected[0];
    return `${selected.length} models`;
  }, [selected]);

  const toggle = (model: string, checked: boolean) => {
    onChange(checked ? [...selected, model] : selected.filter((m) => m !== model));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("justify-between font-normal", className)}>
          <span className="truncate">{label}</span>
          <span className="flex items-center gap-1">
            {selected.length > 0 && (
              <X
                className="size-3.5 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              />
            )}
            <ChevronDown className="size-4 opacity-50" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Models</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={selected.length === 0}
          onClick={() => onChange([])}
          className="text-xs text-muted-foreground"
        >
          Clear selection
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {models.map((model) => (
            <DropdownMenuCheckboxItem
              key={model}
              checked={selected.includes(model)}
              onCheckedChange={(checked) => toggle(model, checked === true)}
              onSelect={(e) => e.preventDefault()}
              className="font-mono text-xs"
            >
              {model}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
