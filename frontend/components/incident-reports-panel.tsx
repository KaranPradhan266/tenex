"use client"

import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080"

type IpRiskRankingEntry = {
  src_ip: string
  predicted_label: string
  heuristic_label: string
  prediction_confidence: number
  probabilities: Record<string, number>
  total_requests: number
  total_bytes_in: number
  total_bytes_out: number
  service_count: number
  path_count: number
  outcome_count: number
  suspicious_outcome_ratio: number
  status_4xx_ratio: number
  status_5xx_ratio: number
}

type IpRiskRankingsResponse = {
  job_id: string
  total_ips: number
  rankings: IpRiskRankingEntry[]
}

const SEVERITY_TABS = ["critical", "high", "medium", "low"] as const
type SeverityTab = (typeof SEVERITY_TABS)[number]
const PAGE_SIZE = 10

function severityClass(label: string) {
  switch (label) {
    case "critical":
      return "bg-destructive/12 text-destructive border-destructive/30"
    case "high":
      return "bg-amber-500/12 text-amber-400 border-amber-500/30"
    case "medium":
      return "bg-sky-500/12 text-sky-400 border-sky-500/30"
    default:
      return "bg-emerald-500/12 text-emerald-400 border-emerald-500/30"
  }
}

function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildWhyFlaggedReasons(row: IpRiskRankingEntry) {
  const reasons: string[] = []

  if (row.suspicious_outcome_ratio >= 0.3) {
    reasons.push("high suspicious outcome ratio")
  } else if (row.suspicious_outcome_ratio > 0) {
    reasons.push("non-zero suspicious outcome activity")
  }

  if (row.status_4xx_ratio >= 0.35) {
    reasons.push("elevated 4xx response rate")
  } else if (row.status_4xx_ratio >= 0.2) {
    reasons.push("moderate 4xx response rate")
  }

  if (row.status_5xx_ratio >= 0.15) {
    reasons.push("elevated 5xx response rate")
  } else if (row.status_5xx_ratio >= 0.05) {
    reasons.push("non-trivial 5xx response rate")
  }

  if (row.total_requests >= 40) {
    reasons.push("high request volume")
  } else if (row.total_requests >= 20) {
    reasons.push("elevated request volume")
  }

  if (row.path_count >= 8) {
    reasons.push("broad path coverage")
  }

  if (row.service_count >= 4) {
    reasons.push("multi-service activity")
  }

  if (row.total_bytes_out >= 50_000) {
    reasons.push("large outbound byte volume")
  }

  return reasons.length > 0 ? reasons : ["ranked by overall model feature combination"]
}

export function IncidentReportsPanel() {
  const [data, setData] = useState<IpRiskRankingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SeverityTab>("critical")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const rankings = data?.rankings ?? []

  useEffect(() => {
    let ignore = false

    async function loadRankings() {
      setIsLoading(true)
      setError(null)

      try {
        const supabase = getSupabaseBrowserClient()
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error("You must be signed in to view incident reports.")
        }

        const response = await fetch(
          `${API_BASE_URL}/api/ip-risk-rankings?user_id=${encodeURIComponent(user.id)}`,
          {
            method: "GET",
          }
        )

        const payload = (await response.json()) as
          | IpRiskRankingsResponse
          | { detail?: string }

        if (!response.ok) {
          throw new Error(
            "detail" in payload && typeof payload.detail === "string"
              ? payload.detail
              : "Unable to load incident reports."
          )
        }

        if (!ignore) {
          setData(payload as IpRiskRankingsResponse)
        }
      } catch (caughtError) {
        if (!ignore) {
          setData(null)
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load incident reports."
          )
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadRankings()

    return () => {
      ignore = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
        Loading incident reports...
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

  if (!data || rankings.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
        Nothing to show
      </div>
    )
  }

  const groupedRankings = SEVERITY_TABS.reduce(
    (accumulator, label) => {
      accumulator[label] = rankings.filter((row) => row.predicted_label === label)
      return accumulator
    },
    {} as Record<SeverityTab, IpRiskRankingEntry[]>
  )

  const activeRows = groupedRankings[activeTab]
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE))
  const paginatedRows = activeRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )
  const selectedRow =
    data.rankings.find((row) => row.src_ip === selectedIp) ?? activeRows[0] ?? null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
            Ranked IPs
          </p>
          <p className="mt-2 text-2xl font-semibold">{data.total_ips}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
            Highest Severity
          </p>
          <p className="mt-2 text-2xl font-semibold capitalize">
            {data.rankings[0]?.predicted_label ?? "n/a"}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
            Ingestion Job
          </p>
          <p className="mt-2 break-all text-xs text-muted-foreground">
            {data.job_id}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEVERITY_TABS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setActiveTab(label)
              setCurrentPage(1)
              setSelectedIp(groupedRankings[label][0]?.src_ip ?? null)
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
              activeTab === label
                ? severityClass(label)
                : "border-border/60 bg-background/40 text-muted-foreground"
            }`}
          >
            {toTitleCase(label)}
            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
              {groupedRankings[label].length}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {activeRows.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center rounded-xl border border-border/60 bg-background/40 text-sm text-muted-foreground">
            No {activeTab} incidents in the latest completed ingestion job.
          </div>
        ) : null}

        {activeRows.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/40 p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source IP</TableHead>
                  <TableHead>Suspicious Outcome</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Heuristic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row) => (
                  <TableRow key={row.src_ip}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIp(row.src_ip)
                          setIsDialogOpen(true)
                        }}
                        className="text-left underline-offset-4 hover:underline"
                      >
                        {row.src_ip}
                      </button>
                    </TableCell>
                    <TableCell>{formatRatio(row.suspicious_outcome_ratio)}</TableCell>
                    <TableCell>{formatRatio(row.prediction_confidence)}</TableCell>
                    <TableCell className="capitalize">{row.heuristic_label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-2 pt-3">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {selectedRow ? (
            <AlertDialogContent size="default">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/60 transition-colors"
                aria-label="Close details"
              >
                <X className="size-4" />
              </button>
              <AlertDialogHeader>
                <AlertDialogTitle>{selectedRow.src_ip}</AlertDialogTitle>
                <AlertDialogDescription>
                  Why flagged
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-wrap gap-2">
                {buildWhyFlaggedReasons(selectedRow).map((reason) => (
                  <div
                    key={`${selectedRow.src_ip}-${reason}`}
                    className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-foreground"
                  >
                    {reason}
                  </div>
                ))}
              </div>
            </AlertDialogContent>
          ) : null}
        </AlertDialog>
      </div>
    </div>
  )
}
