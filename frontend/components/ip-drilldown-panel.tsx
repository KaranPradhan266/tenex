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

  async function loadDrilldown(srcIp: string) {
    setError(null)
    setIsLoading(true)

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
