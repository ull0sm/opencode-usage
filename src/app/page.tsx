import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  filtersFromSearchParams,
  previousPeriod,
  resolveDayShift,
  type UsageFilters,
} from "@/lib/filters";
import {
  getByHourOfDay,
  getByModel,
  getByProject,
  getBySession,
  getEfficiency,
  getMeta,
  getModelEfficiency,
  getSummary,
  getTimeseries,
} from "@/lib/db/queries";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { EfficiencyCards } from "@/components/dashboard/efficiency-cards";
import { ModelEfficiencyTable } from "@/components/dashboard/model-table";
import { ChartSkeleton } from "@/components/dashboard/chart-skeleton";
import { TokenLegend } from "@/components/dashboard/token-legend";
import { TokensOverTimeChart } from "@/components/charts/tokens-over-time";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { HourHistogram } from "@/components/charts/hour-histogram";
import { CompositionChart } from "@/components/charts/composition-chart";
import { LiveRefresh } from "@/components/live-refresh";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fmtCost, fmtInt, projectLabel, sessionTitle, truncate } from "@/lib/format";

export const dynamic = "force-dynamic";

const GROUPS = ["day", "hour", "model", "session", "project"] as const;
type GroupBy = (typeof GROUPS)[number];

function groupFromSearchParams(sp: Record<string, string | string[] | undefined>): GroupBy {
  const raw = typeof sp.group === "string" ? sp.group : undefined;
  return GROUPS.includes(raw as GroupBy) ? (raw as GroupBy) : "day";
}

const MAIN_CARD_COPY: Record<GroupBy, { title: string; description: string }> = {
  day: { title: "Tokens over time", description: "Daily totals in your local days, stacked by category" },
  hour: { title: "Tokens by hour of day", description: "Hourly totals on your local clock, stacked by category" },
  model: { title: "Tokens by model", description: "Token composition per model" },
  session: { title: "Tokens by session", description: "Token composition per session (top 10)" },
  project: { title: "Tokens by project", description: "Token composition per OpenCode project (top 10)" },
};

/** Viewer timezone: ?tz= param wins, else the <TzSync /> cookie, else UTC. */
async function dayShiftFromRequest(
  sp: Record<string, string | string[] | undefined>
): Promise<number> {
  const spTz = typeof sp.tz === "string" ? sp.tz : undefined;
  const cookieTz = (await cookies()).get("tz")?.value;
  return resolveDayShift(spTz, cookieTz);
}

export default async function DashboardPage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const filter = filtersFromSearchParams(sp as Record<string, string | string[] | undefined>);
  const group = groupFromSearchParams(sp);
  const dayShift = await dayShiftFromRequest(sp as Record<string, string | string[] | undefined>);

  const prevFilter = previousPeriod(filter);
  const [meta, summary, efficiency, prevSummary, series] = await Promise.all([
    getMeta(),
    getSummary(filter),
    getEfficiency(filter),
    prevFilter ? getSummary(prevFilter) : Promise.resolve(null),
    getTimeseries(filter, dayShift),
  ]);

  const filterKey = JSON.stringify(filter);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          OpenCode token usage — input, cache read, output and reasoning kept separate.
        </p>
        <TokenLegend className="mt-2" />
      </div>

      <Suspense fallback={null}>
        <FilterBar models={meta.models} />
      </Suspense>

      <SummaryCards s={summary} previous={prevSummary} series={series} />

      <EfficiencyCards stats={efficiency} />

      <Suspense key={`${filterKey}-${group}`} fallback={<ChartSkeleton />}>
        <MainChartSection filter={filter} group={group} dayShift={dayShift} />
      </Suspense>

      <Suspense
        key={`${filterKey}-viz`}
        fallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartSkeleton height="h-56" />
            <ChartSkeleton height="h-56" />
          </div>
        }
      >
        <TimeVizSection filter={filter} dayShift={dayShift} />
      </Suspense>

      <Suspense
        key={`${filterKey}-breakdown`}
        fallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartSkeleton height="h-64" />
            <ChartSkeleton height="h-64" />
          </div>
        }
      >
        <BreakdownSection filter={filter} />
      </Suspense>

      <Suspense key={`${filterKey}-efficiency`} fallback={<ChartSkeleton height="h-48" />}>
        <ModelEfficiencySection filter={filter} blendedCostPer1m={efficiency.blended_cost_per_1m} />
      </Suspense>
      <LiveRefresh />
    </div>
  );
}

async function MainChartSection({
  filter,
  group,
  dayShift,
}: {
  filter: UsageFilters;
  group: GroupBy;
  dayShift: number;
}) {
  const copy = MAIN_CARD_COPY[group];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {group === "day" && <TokensOverTimeChart data={await getTimeseries(filter, dayShift)} />}
        {group === "hour" && (
          <TokensOverTimeChart
            granularity="hour"
            data={(await getByHourOfDay(filter, dayShift)).map((h) => ({
              date: `${h.hour}:00`,
              requests: h.requests,
              input_tokens: h.input_tokens,
              cache_read_tokens: h.cache_read_tokens,
              output_tokens: h.output_tokens,
              reasoning_tokens: h.reasoning_tokens,
              cost: 0,
            }))}
          />
        )}
        {(group === "model" || group === "session" || group === "project") && (
          <CompositionOrNothing filter={filter} group={group} />
        )}
      </CardContent>
    </Card>
  );
}

async function CompositionOrNothing({
  filter,
  group,
}: {
  filter: UsageFilters;
  group: "model" | "session" | "project";
}) {
  if (group === "model") {
    const byModel = await getByModel(filter);
    return <CompositionChart data={byModel.map((m) => ({ name: m.model, ...m }))} />;
  }
  if (group === "session") {
    const bySession = await getBySession(filter);
    return (
      <CompositionChart
        data={bySession.map((s) => ({
          name: truncate(sessionTitle(s), 24),
          input_tokens: s.input_tokens,
          cache_read_tokens: s.cache_read_tokens,
          output_tokens: s.output_tokens,
          reasoning_tokens: s.reasoning_tokens,
        }))}
        labelWidth={120}
      />
    );
  }
  const byProject = await getByProject(filter);
  return (
    <CompositionChart
      data={byProject.map((p) => ({
        name: projectLabel(p),
        input_tokens: p.input_tokens,
        cache_read_tokens: p.cache_read_tokens,
        output_tokens: p.output_tokens,
        reasoning_tokens: p.reasoning_tokens,
      }))}
      labelWidth={120}
    />
  );
}

async function TimeVizSection({ filter, dayShift }: { filter: UsageFilters; dayShift: number }) {
  const [series, byHour] = await Promise.all([
    getTimeseries(filter, dayShift),
    getByHourOfDay(filter, dayShift),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Activity calendar</CardTitle>
          <CardDescription>Daily token volume, GitHub-style heatmap</CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarHeatmap data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hour of day</CardTitle>
          <CardDescription>When you burn tokens (local time)</CardDescription>
        </CardHeader>
        <CardContent>
          <HourHistogram data={byHour} />
        </CardContent>
      </Card>
    </div>
  );
}

async function BreakdownSection({ filter }: { filter: UsageFilters }) {
  const [byModel, bySession, byProject] = await Promise.all([
    getByModel(filter),
    getBySession(filter),
    getByProject(filter),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>By model</CardTitle>
          <CardDescription>Token composition per model</CardDescription>
        </CardHeader>
        <CardContent>
          <CompositionChart data={byModel.map((m) => ({ name: m.model, ...m }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top projects</CardTitle>
          <CardDescription>Token composition per OpenCode project</CardDescription>
        </CardHeader>
        <CardContent>
          <CompositionChart
            data={byProject.map((p) => ({
              name: projectLabel(p),
              input_tokens: p.input_tokens,
              cache_read_tokens: p.cache_read_tokens,
              output_tokens: p.output_tokens,
              reasoning_tokens: p.reasoning_tokens,
            }))}
            labelWidth={120}
          />
          {byProject.length > 0 && (
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              {byProject.slice(0, 5).map((p) => {
                const label = projectLabel(p);
                const body = (
                  <>
                    <span className="truncate">{label}</span>
                    <span>{fmtInt(p.sessions)} sess · {fmtCost(p.cost)}</span>
                  </>
                );
                return p.project_id ? (
                  <Link
                    key={p.project_id}
                    href={`/projects/${encodeURIComponent(p.project_id)}`}
                    className="flex justify-between gap-2 underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key="none" className="flex justify-between gap-2">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top sessions</CardTitle>
          <CardDescription>Token composition per session (top 10)</CardDescription>
        </CardHeader>
        <CardContent>
          <CompositionChart
            data={bySession.map((s) => ({
              name: truncate(sessionTitle(s), 24),
              input_tokens: s.input_tokens,
              cache_read_tokens: s.cache_read_tokens,
              output_tokens: s.output_tokens,
              reasoning_tokens: s.reasoning_tokens,
            }))}
            labelWidth={120}
          />
          {bySession.length > 0 && (
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              {bySession.slice(0, 5).map((s) => {
                const body = (
                  <>
                    <span className="truncate">{sessionTitle(s)}</span>
                    <span>{fmtInt(s.requests)} req · {fmtCost(s.cost)}</span>
                  </>
                );
                return s.session_id ? (
                  <Link
                    key={s.session_id}
                    href={`/sessions/${encodeURIComponent(s.session_id)}`}
                    className="flex justify-between gap-2 underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key="none" className="flex justify-between gap-2">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function ModelEfficiencySection({
  filter,
  blendedCostPer1m,
}: {
  filter: UsageFilters;
  blendedCostPer1m: number | null;
}) {
  const rows = await getModelEfficiency(filter);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Model cost efficiency</CardTitle>
        <CardDescription>
          Cost per 1M tokens per model — most expensive first. Outliers are
          flagged at more than 2× the blended average.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ModelEfficiencyTable rows={rows} blendedCostPer1m={blendedCostPer1m} />
      </CardContent>
    </Card>
  );
}
