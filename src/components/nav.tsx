"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScrollText, FolderGit2, MessagesSquare, FileUp, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/usage", label: "Usage history", icon: ScrollText },
  { href: "/sessions", label: "Sessions", icon: MessagesSquare },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/import", label: "Import", icon: FileUp },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Nav({ variant = "sidebar" }: { variant?: "sidebar" | "topbar" }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex gap-1", variant === "sidebar" ? "flex-col" : "flex-row items-center")}>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
