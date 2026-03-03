"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import { CircularDial } from "./circularDial"
import { DashboardSpline } from "./dashboard-spline"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080"

type IngestionJob = {
  id: string
  filename: string
  parsed_lines: number
  rejected_lines: number
  status: string
  created_at?: string | null
}

type IpRiskRankingEntry = {
  src_ip: string
  predicted_label: string
  prediction_confidence: number
  suspicious_outcome_ratio: number
}

type IpRiskRankingsResponse = {
  job_id: string
  rankings: IpRiskRankingEntry[]
}

type OutcomeSummaryRow = {
  outcome: string
  request_count: number
}

type ServiceSummaryRow = {
  service: string
  request_count: number
}

type MinuteTrafficRow = {
  traffic_count: number
  allowed_count: number
  blocked_count: number
}

type DashboardData = {
  latestJob: IngestionJob
  criticalIps: IpRiskRankingEntry[]
  topOutcomes: OutcomeSummaryRow[]
  topServices: ServiceSummaryRow[]
  blockedCount: number
  allowedCount: number
  uniqueIps: number
}

function severityTone(label: string) {
  switch (label) {
    case "critical":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    case "high":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400"
    case "medium":
      return "border-sky-500/30 bg-sky-500/10 text-sky-400"
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
  }
}

function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatJobTime(value?: string | null) {
  if (!value) return "Unknown"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function SectionCard(props: {
  title: string
  eyebrow?: string
  children: React.ReactNode
  className?: string
}) {
  const { title, eyebrow, children, className } = props

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-background/65 p-4 backdrop-blur-sm",
        className
      )}
    >
      {eyebrow ? (
        <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-1 text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function DashboardCommandCenter() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadDashboard() {
      setIsLoading(true)
      setError(null)

      try {
        const supabase = getSupabaseBrowserClient()
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error("You must be signed in to view the dashboard.")
        }

        const { data: latestJob, error: latestJobError } = await supabase
          .from("ingestion_jobs")
          .select("id, filename, parsed_lines, rejected_lines, status, created_at")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestJobError || !latestJob) {
          throw new Error("No completed ingestion jobs found.")
        }

        const [rankingsResponse, outcomesResult, servicesResult, trafficResult, volumeResult] =
          await Promise.all([
            fetch(
              `${API_BASE_URL}/api/ip-risk-rankings?user_id=${encodeURIComponent(user.id)}&job_id=${encodeURIComponent(latestJob.id)}&limit=100`
            ),
            supabase
              .from("ip_outcome_summary")
              .select("outcome, request_count")
              .eq("job_id", latestJob.id),
            supabase
              .from("ip_service_summary")
              .select("service, request_count")
              .eq("job_id", latestJob.id),
            supabase
              .from("ip_minute_traffic")
              .select("traffic_count, allowed_count, blocked_count")
              .eq("job_id", latestJob.id),
            supabase
              .from("ip_volume_summary")
              .select("src_ip")
              .eq("job_id", latestJob.id),
          ])

        const rankingsPayload = (await rankingsResponse.json()) as
          | IpRiskRankingsResponse
          | { detail?: string }

        if (!rankingsResponse.ok) {
          throw new Error(
            "detail" in rankingsPayload && typeof rankingsPayload.detail === "string"
              ? rankingsPayload.detail
              : "Unable to load ranked IPs."
          )
        }

        const summaryErrors = [
          outcomesResult.error,
          servicesResult.error,
          trafficResult.error,
          volumeResult.error,
        ].filter(Boolean)

        if (summaryErrors.length > 0) {
          throw new Error("Unable to load one or more dashboard summary sections.")
        }

        const aggregateTopCounts = <T extends Record<string, unknown>>(
          rows: T[],
          key: keyof T
        ) => {
          const totals = new Map<string, number>()

          rows.forEach((row) => {
            const label = row[key]
            if (typeof label !== "string") return
            const count =
              typeof row.request_count === "number" ? row.request_count : 0
            totals.set(label, (totals.get(label) ?? 0) + count)
          })

          return Array.from(totals.entries())
            .map(([label, request_count]) => ({ label, request_count }))
            .sort((left, right) => right.request_count - left.request_count)
            .slice(0, 5)
        }

        const suspiciousOutcomes = aggregateTopCounts(
          ((outcomesResult.data as OutcomeSummaryRow[] | null) ?? []).filter((row) =>
            /(blocked|denied|failed|invalid|waf|rate|error|forbidden)/i.test(row.outcome)
          ),
          "outcome"
        ).map((row) => ({
          outcome: row.label,
          request_count: row.request_count,
        }))

        const topServices = aggregateTopCounts(
          (servicesResult.data as ServiceSummaryRow[] | null) ?? [],
          "service"
        ).map((row) => ({
          service: row.label,
          request_count: row.request_count,
        }))

        const minuteTraffic = (trafficResult.data as MinuteTrafficRow[] | null) ?? []
        const blockedCount = minuteTraffic.reduce(
          (sum, row) => sum + row.blocked_count,
          0
        )
        const allowedCount = minuteTraffic.reduce(
          (sum, row) => sum + row.allowed_count,
          0
        )

        const rankings = (rankingsPayload as IpRiskRankingsResponse).rankings
        const criticalIps = rankings
          .filter((row) => row.predicted_label === "critical")
          .slice(0, 3)

        if (!ignore) {
          setData({
            latestJob,
            criticalIps,
            topOutcomes: suspiciousOutcomes,
            topServices,
            blockedCount,
            allowedCount,
            uniqueIps: (volumeResult.data as { src_ip: string }[] | null)?.length ?? 0,
          })
        }
      } catch (caughtError) {
        if (!ignore) {
          setData(null)
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load dashboard snapshot."
          )
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      ignore = true
    }
  }, [])

  const trafficTotal = useMemo(() => {
    if (!data) return 0
    return data.allowedCount + data.blockedCount
  }, [data])

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[640px] items-center justify-center rounded-xl border border-border/60 bg-background/50 text-sm text-muted-foreground">
        Loading dashboard snapshot...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full min-h-[640px] items-center justify-center rounded-xl border border-border/60 bg-background/50 text-sm text-muted-foreground">
        Nothing to show
      </div>
    )
  }

  return (
    <div className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(280px,1fr)_minmax(380px,520px)_minmax(280px,1fr)]">
      <div className="space-y-4">
        <SectionCard title="Priority IP Radar" eyebrow="Triage Queue">
          <div className="space-y-3">
            {data.criticalIps.length > 0 ? (
              data.criticalIps.map((row) => (
                <Link
                  key={row.src_ip}
                  href={`/ipdrill?src_ip=${encodeURIComponent(row.src_ip)}`}
                  className="block rounded-xl border border-border/50 bg-card/50 p-3 transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.src_ip}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Suspicious outcome {formatRatio(row.suspicious_outcome_ratio)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                        severityTone(row.predicted_label)
                      )}
                    >
                      {row.predicted_label}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-3 text-xs">
                    Confidence {formatRatio(row.prediction_confidence)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No critical IPs in the latest completed job.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Latest Ingestion" eyebrow="Job Status">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Filename</span>
              <span className="truncate font-medium">{data.latestJob.filename}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Parsed</span>
              <span className="font-medium">{data.latestJob.parsed_lines}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Rejected</span>
              <span className="font-medium">{data.latestJob.rejected_lines}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Unique IPs</span>
              <span className="font-medium">{data.uniqueIps}</span>
            </div>
            <div className="pt-2 text-xs text-muted-foreground">
              Completed {formatJobTime(data.latestJob.created_at)}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
        <div className="relative flex h-full min-h-[640px] items-center justify-center overflow-hidden rounded-xl">
          <DashboardSpline className="absolute inset-x-[22%] inset-y-[24%] min-h-0 -translate-y-[25%] rounded-full bg-transparent" />
          <div className="pointer-events-none absolute inset-0 z-10 flex -translate-x-[2.5%] -translate-y-[10%] items-center justify-center">
            <CircularDial
              showExport={false}
              className="h-full w-full max-w-[512px]"
            />
          </div>

          <div className="absolute bottom-5 left-5 right-5 z-20 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/75 p-3 backdrop-blur-sm">
              <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                All Traffic
              </p>
              <p className="mt-2 text-2xl font-semibold">{trafficTotal}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                Allowed
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {data.allowedCount}
              </p>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-destructive">
                Blocked
              </p>
              <p className="mt-2 text-2xl font-semibold text-destructive">
                {data.blockedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SectionCard title="Suspicious Outcomes" eyebrow="What Stands Out">
          <div className="space-y-2">
            {data.topOutcomes.length > 0 ? (
              data.topOutcomes.map((row) => (
                <div
                  key={row.outcome}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-card/50 px-3 py-2"
                >
                  <p className="truncate text-sm">{row.outcome}</p>
                  <p className="text-sm font-semibold">{row.request_count}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No suspicious outcomes in the latest completed job.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Services Under Pressure" eyebrow="Attack Surface">
          <div className="space-y-2">
            {data.topServices.map((row) => (
              <div
                key={row.service}
                className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-card/50 px-3 py-2"
              >
                <p className="truncate text-sm">{row.service}</p>
                <p className="text-sm font-semibold">{row.request_count}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Quick Actions" eyebrow="Pivot Faster">
          <div className="grid gap-2">
            <Link
              href="/reports"
              className="rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-card"
            >
              Open Incident Reports
            </Link>
            <Link
              href="/traffic"
              className="rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-card"
            >
              Inspect Traffic Breakdown
            </Link>
            <Link
              href="/user-agents"
              className="rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-card"
            >
              Review User-Agent Analysis
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
