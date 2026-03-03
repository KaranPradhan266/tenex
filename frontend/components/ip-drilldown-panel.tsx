"use client"

import { FormEvent, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

import { Button } from "./ui/button"
import { Input } from "./ui/input"

type SummaryRow = {
  request_count: number
}

type ServiceRow = SummaryRow & {
  service: string
}

type PathRow = SummaryRow & {
  path: string
}

type OutcomeRow = SummaryRow & {
  outcome: string
}

type StatusRow = SummaryRow & {
  status: number
}

type VolumeRow = {
  total_requests: number
  total_bytes_in: number
  total_bytes_out: number
}

type DrilldownData = {
  srcIp: string
  jobId: string
  volume: VolumeRow | null
  services: ServiceRow[]
  paths: PathRow[]
  outcomes: OutcomeRow[]
  statuses: StatusRow[]
}

type AiInsightResponse = {
  insight: string
  model: string
}

type IpLookupResponse = {
  country: string | null
  regionName: string | null
  city: string | null
  isp: string | null
  org: string | null
}

function renderInlineMarkdown(text: string) {
  const segments = text.split(/(\*\*.*?\*\*)/g)

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={`${segment}-${index}`} className="font-semibold text-foreground">
          {segment.slice(2, -2)}
        </strong>
      )
    }

    return <span key={`${segment}-${index}`}>{segment}</span>
  })
}

function renderInsightMarkdown(insight: string) {
  const lines = insight
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const bulletLines = lines.filter((line) => line.startsWith("- "))
  if (bulletLines.length === lines.length) {
    return (
      <ul className="space-y-3">
        {bulletLines.map((line, index) => (
          <li key={`${line}-${index}`} className="text-sm leading-7 text-foreground">
            {renderInlineMarkdown(line.slice(2))}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className="text-sm leading-7 text-foreground">
          {renderInlineMarkdown(line)}
        </p>
      ))}
    </div>
  )
}

function SummaryList<T extends { request_count: number }>(props: {
  title: string
  rows: T[]
  renderLabel: (row: T) => string
}) {
  const { title, rows, renderLabel } = props

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
          Top {rows.length}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">Nothing to show</p>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <div
              key={`${title}-${index}-${renderLabel(row)}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-card/50 px-3 py-2"
            >
              <p className="truncate text-sm">{renderLabel(row)}</p>
              <p className="text-sm font-semibold">{row.request_count}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function IpDrilldownPanel() {
  const searchParams = useSearchParams()
  const [ipInput, setIpInput] = useState("")
  const [data, setData] = useState<DrilldownData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiModel, setAiModel] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false)
  const [generatedForContext, setGeneratedForContext] = useState<string | null>(null)
  const [ipLookup, setIpLookup] = useState<IpLookupResponse | null>(null)
  const [ipLookupError, setIpLookupError] = useState<string | null>(null)
  const [isLoadingIpLookup, setIsLoadingIpLookup] = useState(false)

  const currentContextKey = data ? `${data.jobId}:${data.srcIp}` : null
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080"

  async function loadDrilldown(srcIp: string) {
    setError(null)
    setIsLoading(true)
    setAiInsight(null)
    setAiModel(null)
    setAiError(null)
    setGeneratedForContext(null)
    setIpLookup(null)
    setIpLookupError(null)
    setIsLoadingIpLookup(false)

    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("You must be signed in to inspect IP summaries.")
      }

      const { data: latestJob, error: jobsError } = await supabase
        .from("ingestion_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (jobsError || !latestJob) {
        throw new Error("No completed ingestion jobs found.")
      }

      const [
        serviceResult,
        pathResult,
        outcomeResult,
        statusResult,
        volumeResult,
      ] = await Promise.all([
        supabase
          .from("ip_service_summary")
          .select("service, request_count")
          .eq("job_id", latestJob.id)
          .eq("src_ip", srcIp)
          .order("request_count", { ascending: false })
          .limit(8),
        supabase
          .from("ip_path_summary")
          .select("path, request_count")
          .eq("job_id", latestJob.id)
          .eq("src_ip", srcIp)
          .order("request_count", { ascending: false })
          .limit(8),
        supabase
          .from("ip_outcome_summary")
          .select("outcome, request_count")
          .eq("job_id", latestJob.id)
          .eq("src_ip", srcIp)
          .order("request_count", { ascending: false })
          .limit(8),
        supabase
          .from("ip_status_summary")
          .select("status, request_count")
          .eq("job_id", latestJob.id)
          .eq("src_ip", srcIp)
          .order("request_count", { ascending: false })
          .limit(8),
        supabase
          .from("ip_volume_summary")
          .select("total_requests, total_bytes_in, total_bytes_out")
          .eq("job_id", latestJob.id)
          .eq("src_ip", srcIp)
          .maybeSingle(),
      ])

      const failures = [
        serviceResult.error,
        pathResult.error,
        outcomeResult.error,
        statusResult.error,
        volumeResult.error,
      ].filter(Boolean)

      if (failures.length > 0) {
        throw new Error("Unable to load one or more IP summary sections.")
      }

      setData({
        srcIp,
        jobId: latestJob.id,
        volume: (volumeResult.data as VolumeRow | null) ?? null,
        services: (serviceResult.data as ServiceRow[] | null) ?? [],
        paths: (pathResult.data as PathRow[] | null) ?? [],
        outcomes: (outcomeResult.data as OutcomeRow[] | null) ?? [],
        statuses: (statusResult.data as StatusRow[] | null) ?? [],
      })
      void loadIpLookup(srcIp)
    } catch (caughtError) {
      setData(null)
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load IP drill-down data."
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGenerateInsight() {
    if (!data || !currentContextKey || generatedForContext === currentContextKey) {
      return
    }

    setAiError(null)
    setIsGeneratingInsight(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/ip-ai-insight`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          src_ip: data.srcIp,
          job_id: data.jobId,
          total_requests: data.volume?.total_requests ?? 0,
          total_bytes_in: data.volume?.total_bytes_in ?? 0,
          total_bytes_out: data.volume?.total_bytes_out ?? 0,
          country: ipLookup?.country ?? null,
          regionName: ipLookup?.regionName ?? null,
          city: ipLookup?.city ?? null,
          isp: ipLookup?.isp ?? null,
          org: ipLookup?.org ?? null,
          services: data.services.map((row) => ({
            label: row.service,
            request_count: row.request_count,
          })),
          paths: data.paths.map((row) => ({
            label: row.path,
            request_count: row.request_count,
          })),
          outcomes: data.outcomes.map((row) => ({
            label: row.outcome,
            request_count: row.request_count,
          })),
          statuses: data.statuses.map((row) => ({
            label: String(row.status),
            request_count: row.request_count,
          })),
        }),
      })

      const responseBody = (await response.json()) as AiInsightResponse | { detail?: string }

      if (!response.ok || !("insight" in responseBody)) {
        throw new Error(
          "detail" in responseBody && responseBody.detail
            ? responseBody.detail
            : "Unable to generate AI insights."
        )
      }

      setAiInsight(responseBody.insight)
      setAiModel(responseBody.model)
      setGeneratedForContext(currentContextKey)
    } catch (caughtError) {
      setAiInsight(null)
      setAiModel(null)
      setAiError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate AI insights."
      )
    } finally {
      setIsGeneratingInsight(false)
    }
  }

  async function loadIpLookup(srcIp: string) {
    setIpLookup(null)
    setIpLookupError(null)
    setIsLoadingIpLookup(true)

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/ip-lookup?src_ip=${encodeURIComponent(srcIp)}`
      )
      const responseBody = (await response.json()) as IpLookupResponse | { detail?: string }

      if (!response.ok) {
        throw new Error(
          "detail" in responseBody && responseBody.detail
            ? responseBody.detail
            : "Unable to load IP enrichment."
        )
      }

      setIpLookup(responseBody as IpLookupResponse)
    } catch (caughtError) {
      setIpLookupError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load IP enrichment."
      )
    } finally {
      setIsLoadingIpLookup(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const srcIp = ipInput.trim()
    if (!srcIp) {
      setError("Enter a source IP to inspect.")
      return
    }

    await loadDrilldown(srcIp)
  }

  useEffect(() => {
    const srcIpParam = searchParams.get("src_ip")?.trim() ?? ""
    if (!srcIpParam) {
      return
    }

    setIpInput(srcIpParam)
    void loadDrilldown(srcIpParam)
  }, [searchParams])

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/50 p-4 md:flex-row md:items-end"
      >
        <div className="flex-1 space-y-2">
          <label htmlFor="drilldown-src-ip" className="text-sm font-medium">
            Source IP
          </label>
          <Input
            id="drilldown-src-ip"
            type="text"
            value={ipInput}
            onChange={(event) => setIpInput(event.target.value)}
            placeholder="203.0.113.63"
            className="h-9 text-sm"
          />
        </div>
        <Button type="submit" size="lg" disabled={isLoading}>
          {isLoading ? "Loading..." : "Load summaries"}
        </Button>
      </form>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                Source IP
              </p>
              <p className="mt-2 text-sm font-medium">{data.srcIp}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                Total Requests
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {data.volume?.total_requests ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                Bytes In
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {data.volume?.total_bytes_in ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                Bytes Out
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {data.volume?.total_bytes_out ?? 0}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              IP Enrichment
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Country, region, city, and provider details for this source IP.
            </p>

            {isLoadingIpLookup ? (
              <div className="text-muted-foreground mt-4 rounded-lg border border-dashed border-border/50 p-4 text-sm">
                Loading IP enrichment...
              </div>
            ) : ipLookupError ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {ipLookupError}
              </div>
            ) : ipLookup ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                    Country
                  </p>
                  <p className="mt-2 text-sm font-medium">{ipLookup.country ?? "Unknown"}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                    Region
                  </p>
                  <p className="mt-2 text-sm font-medium">{ipLookup.regionName ?? "Unknown"}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                    City
                  </p>
                  <p className="mt-2 text-sm font-medium">{ipLookup.city ?? "Unknown"}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                    ISP
                  </p>
                  <p className="mt-2 text-sm font-medium">{ipLookup.isp ?? "Unknown"}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                    Org
                  </p>
                  <p className="mt-2 text-sm font-medium">{ipLookup.org ?? "Unknown"}</p>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground mt-4 rounded-lg border border-dashed border-border/50 p-4 text-sm">
                IP enrichment will appear here after the source IP summaries load.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                  AI Insights
                </p>
                <p className="text-sm text-muted-foreground">
                  Generate a one-time analyst summary for the loaded source IP.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleGenerateInsight}
                disabled={
                  !data ||
                  isLoading ||
                  isGeneratingInsight ||
                  generatedForContext === currentContextKey
                }
              >
                {isGeneratingInsight ? "Generating..." : "Generate"}
              </Button>
            </div>

            {aiError ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {aiError}
              </div>
            ) : null}

            {aiInsight ? (
              <div className="mt-4 rounded-lg border border-border/50 bg-card/50 p-4">
                {renderInsightMarkdown(aiInsight)}
                {aiModel ? (
                  <p className="text-muted-foreground mt-3 text-xs">Generated with {aiModel}</p>
                ) : null}
              </div>
            ) : (
              <div className="text-muted-foreground mt-4 rounded-lg border border-dashed border-border/50 p-4 text-sm">
                {isGeneratingInsight
                  ? "Generating grounded analyst insight..."
                  : "Insights will appear here after the source IP summaries load and you click Generate."}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SummaryList
              title="Top Services"
              rows={data.services}
              renderLabel={(row) => row.service}
            />
            <SummaryList
              title="Top Paths"
              rows={data.paths}
              renderLabel={(row) => row.path}
            />
            <SummaryList
              title="Top Outcomes"
              rows={data.outcomes}
              renderLabel={(row) => row.outcome}
            />
            <SummaryList
              title="Status Codes"
              rows={data.statuses}
              renderLabel={(row) => String(row.status)}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              Ingestion job
            </p>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {data.jobId}
            </p>
          </div>
        </>
      ) : !error ? (
        <div className="flex h-[320px] items-center justify-center rounded-xl border border-border/60 bg-background/40 text-sm text-muted-foreground">
          Enter a source IP to inspect services, paths, outcomes, status codes, and byte totals.
        </div>
      ) : null}
    </div>
  )
}
