"use client"

import { FormEvent, useState } from "react"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { IpSignalsChart } from "./ip-signals-chart"

type TimeSeriesPoint = {
  bucket_ts: string
  value: number
}

type IpSignalsResponse = {
  job_id: string
  src_ip: string
  total_events: number
  traffic_series: TimeSeriesPoint[]
  allowed_series: TimeSeriesPoint[]
  blocked_series: TimeSeriesPoint[]
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080"

export function IpSignalsPanel() {
  const [ipInput, setIpInput] = useState("")
  const [data, setData] = useState<IpSignalsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!ipInput.trim()) {
      setError("Enter a source IP to analyze.")
      return
    }

    setIsLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("You must be signed in to inspect IP signals.")
      }

      const response = await fetch(
        `${API_BASE_URL}/api/logs/ip-signals?user_id=${encodeURIComponent(
          user.id
        )}&src_ip=${encodeURIComponent(ipInput.trim())}`
      )

      const payload = (await response.json()) as
        | IpSignalsResponse
        | { detail?: string }

      if (!response.ok) {
        throw new Error(
          "detail" in payload && typeof payload.detail === "string"
            ? payload.detail
            : "Unable to compute IP signals."
        )
      }

      setData(payload as IpSignalsResponse)
    } catch (caughtError) {
      setData(null)
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to compute IP signals."
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/50 p-4 md:flex-row md:items-end"
      >
        <div className="flex-1 space-y-2">
          <label htmlFor="src-ip" className="text-sm font-medium">
            Source IP
          </label>
          <Input
            id="src-ip"
            type="text"
            value={ipInput}
            onChange={(event) => setIpInput(event.target.value)}
            placeholder="203.0.113.63"
            className="h-9 text-sm"
          />
        </div>
        <Button type="submit" size="lg" disabled={isLoading}>
          {isLoading ? "Analyzing..." : "Analyze IP"}
        </Button>
      </form>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              Source IP
            </p>
            <p className="mt-2 text-sm font-medium">{data.src_ip}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              Total events
            </p>
            <p className="mt-2 text-2xl font-semibold">{data.total_events}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              Ingestion job
            </p>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {data.job_id}
            </p>
          </div>
        </div>
      ) : null}

      {!data && !error ? (
        <div className="flex h-[420px] items-center justify-center rounded-xl border border-border/60 bg-background/40 text-sm text-muted-foreground">
          Enter a source IP to inspect request volume over time from the latest uploaded log.
        </div>
      ) : (data?.traffic_series?.length ?? 0) +
          (data?.allowed_series?.length ?? 0) +
          (data?.blocked_series?.length ?? 0) ===
        0 ? (
        <div className="flex h-[420px] items-center justify-center rounded-xl border border-border/60 bg-background/40 text-sm text-muted-foreground">
          No traffic data found for this IP.
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <IpSignalsChart
            trafficPoints={data?.traffic_series ?? []}
            allowedPoints={data?.allowed_series ?? []}
            blockedPoints={data?.blocked_series ?? []}
          />
        </div>
      )}
    </div>
  )
}
