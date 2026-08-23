import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Nav } from "@/components/nav";
import { TzSync } from "@/components/tz-sync";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Activity } from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Token Analytics",
  description: "Local-first OpenCode token usage analytics",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full dark antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider delayDuration={200}>
          <div className="flex min-h-svh w-full">
          <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar">
            <div className="flex items-center gap-2 px-4 py-5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">Token Analytics</p>
                <p className="text-xs text-muted-foreground mt-1">local · OpenCode usage</p>
              </div>
            </div>
            <div className="px-2">
              <Nav />
            </div>
            <div className="mt-auto px-4 py-4 text-[11px] leading-relaxed text-muted-foreground">
              <p>Context sent = input + cache read</p>
              <p>Generated = output + reasoning</p>
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Activity className="size-4" /> Token Analytics
                </div>
                <Nav variant="topbar" />
              </header>
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </TooltipProvider>
        <TzSync />
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
