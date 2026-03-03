"use client"

import { X } from "lucide-react"
import Link from "next/link"
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

import { SankeyChart } from "./sankey-chart"

type TrafficSankeyRow = {
  source: string
  target: string
  value: number
}

type SankeyNode = {
  name: string
}

type SankeyLink = {
  source: string
  target: string
  value: number
}

type NodeStage = "root" | "method" | "service" | "status_class" | "outcome" | "action"

type AssociatedIpRow = {
  srcIp: string
  requestCount: number
}

function buildSankeyData(rows: TrafficSankeyRow[]) {
  const nodeNames = new Set<string>()
  const sourceNames = new Set<string>()
  const targetNames = new Set<string>()
  const links: SankeyLink[] = rows.map((row) => {
    nodeNames.add(row.source)
    nodeNames.add(row.target)
    sourceNames.add(row.source)
    targetNames.add(row.target)

    return {
      source: row.source,
      target: row.target,
      value: row.value,
    }
  })

  const initialNodes = Array.from(sourceNames).filter(
    (name) => !targetNames.has(name)
  )
  const rootLinks = initialNodes.map((name) => ({
    source: "Traffic",
    target: name,
    value: links
      .filter((link) => link.source === name)
      .reduce((sum, link) => sum + link.value, 0),
  }))

  if (rootLinks.length > 0) {
    nodeNames.add("Traffic")
    links.unshift(...rootLinks)
  }

  const nodes: SankeyNode[] = Array.from(nodeNames).map((name) => ({ name }))

  return { nodes, links }
}

function inferNodeStages(links: SankeyLink[]) {
  const stages = new Map<string, NodeStage>()
  stages.set("Traffic", "root")

  let changed = true
  while (changed) {
    changed = false
    for (const link of links) {
      const sourceStage = stages.get(link.source)
      if (!sourceStage || stages.has(link.target)) {
        continue
      }

      const nextStage: NodeStage =
        sourceStage === "root"
          ? "method"
          : sourceStage === "method"
            ? "service"
            : sourceStage === "service"
              ? "status_class"
              : sourceStage === "status_class"
                ? "outcome"
                : "action"

      stages.set(link.target, nextStage)
      changed = true
    }
  }

  return stages
}

export function TrafficAnalysisPanel() {
  const [data, setData] = useState<{
    nodes: SankeyNode[]
    links: SankeyLink[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [nodeStages, setNodeStages] = useState<Map<string, NodeStage>>(new Map())
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [associatedIps, setAssociatedIps] = useState<AssociatedIpRow[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoadingIps, setIsLoadingIps] = useState(false)
  const [ipError, setIpError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadTrafficRows() {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (!ignore) {
          setIsLoading(false)
        }
        return
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
        if (!ignore) {
          setIsLoading(false)
        }
        return
      }

      const { data: rows, error: rowsError } = await supabase
        .from("chart_traffic_sankey")
        .select("source, target, value")
        .eq("job_id", latestJob.id)

      if (rowsError || !rows || rows.length === 0 || ignore) {
        if (!ignore) {
          setIsLoading(false)
        }
        return
      }

      const sankeyData = buildSankeyData(rows as TrafficSankeyRow[])
      setData(sankeyData)
      setNodeStages(inferNodeStages(sankeyData.links))
      setIsLoading(false)
    }

    void loadTrafficRows()

    return () => {
      ignore = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[480px] items-center justify-center text-sm text-muted-foreground">
        Loading traffic breakdown...
      </div>
    )
  }

  if (!data || data.links.length === 0) {
    return (
      <div className="flex h-[480px] items-center justify-center text-sm text-muted-foreground">
        Nothing to show
      </div>
    )
  }

  async function handleNodeClick(nodeName: string) {
    if (!data) {
      return
    }

    const nodeStage = nodeStages.get(nodeName)
    if (!nodeStage) {
      return
    }

    setSelectedNode(nodeName)
    setIsDialogOpen(true)
    setIsLoadingIps(true)
    setIpError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("You must be signed in to inspect node associations.")
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

      let rows: AssociatedIpRow[] = []

      if (nodeStage === "root") {
        const { data: volumeRows, error } = await supabase
          .from("ip_volume_summary")
          .select("src_ip, total_requests")
          .eq("job_id", latestJob.id)
          .order("total_requests", { ascending: false })
          .limit(15)

        if (error) {
          throw new Error("Unable to load IPs for Traffic.")
        }

        rows =
          volumeRows?.map((row) => ({
            srcIp: row.src_ip as string,
            requestCount: row.total_requests as number,
          })) ?? []
      } else if (nodeStage === "method") {
        const { data: methodRows, error } = await supabase
          .from("ip_method_summary")
          .select("src_ip, request_count")
          .eq("job_id", latestJob.id)
          .eq("method", nodeName)
          .order("request_count", { ascending: false })
          .limit(15)

        if (error) {
          throw new Error("Unable to load IPs for method node.")
        }

        rows =
          methodRows?.map((row) => ({
            srcIp: row.src_ip as string,
            requestCount: row.request_count as number,
          })) ?? []
      } else if (nodeStage === "service") {
        const { data: serviceRows, error } = await supabase
          .from("ip_service_summary")
          .select("src_ip, request_count")
          .eq("job_id", latestJob.id)
          .eq("service", nodeName)
          .order("request_count", { ascending: false })
          .limit(15)

        if (error) {
          throw new Error("Unable to load IPs for service node.")
        }

        rows =
          serviceRows?.map((row) => ({
            srcIp: row.src_ip as string,
            requestCount: row.request_count as number,
          })) ?? []
      } else if (nodeStage === "status_class") {
        const { data: statusRows, error } = await supabase
          .from("ip_status_summary")
          .select("src_ip, status, request_count")
          .eq("job_id", latestJob.id)

        if (error) {
          throw new Error("Unable to load IPs for status class node.")
        }

        const counter = new Map<string, number>()
        for (const row of statusRows ?? []) {
          const statusClass = `${Math.floor(Number(row.status) / 100)}xx`
          if (statusClass !== nodeName) {
            continue
          }
          counter.set(
            row.src_ip as string,
            (counter.get(row.src_ip as string) ?? 0) + Number(row.request_count)
          )
        }
        rows = Array.from(counter.entries())
          .map(([srcIp, requestCount]) => ({ srcIp, requestCount }))
          .sort((left, right) => right.requestCount - left.requestCount)
          .slice(0, 15)
      } else if (nodeStage === "outcome") {
        const { data: outcomeRows, error } = await supabase
          .from("ip_outcome_summary")
          .select("src_ip, request_count")
          .eq("job_id", latestJob.id)
          .eq("outcome", nodeName)
          .order("request_count", { ascending: false })
          .limit(15)

        if (error) {
          throw new Error("Unable to load IPs for outcome node.")
        }

        rows =
          outcomeRows?.map((row) => ({
            srcIp: row.src_ip as string,
            requestCount: row.request_count as number,
          })) ?? []
      } else if (nodeStage === "action") {
        const { data: actionRows, error } = await supabase
          .from("ip_action_summary")
          .select("src_ip, request_count")
          .eq("job_id", latestJob.id)
          .eq("action", nodeName)
          .order("request_count", { ascending: false })
          .limit(15)

        if (error) {
          throw new Error("Unable to load IPs for action node.")
        }

        rows =
          actionRows?.map((row) => ({
            srcIp: row.src_ip as string,
            requestCount: row.request_count as number,
          })) ?? []
      }

      setAssociatedIps(rows)
    } catch (caughtError) {
      setAssociatedIps([])
      setIpError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load associated IPs."
      )
    } finally {
      setIsLoadingIps(false)
    }
  }

  return (
    <>
      <SankeyChart
        nodes={data.nodes}
        links={data.links}
        onNodeClick={handleNodeClick}
      />
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent size="default" className="max-w-lg">
          <button
            type="button"
            onClick={() => setIsDialogOpen(false)}
            className="text-muted-foreground hover:text-foreground absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/60 transition-colors"
            aria-label="Close associated IPs"
          >
            <X className="size-4" />
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedNode ?? "Associated IPs"}</AlertDialogTitle>
            <AlertDialogDescription>
              Source IPs associated with the selected Sankey node.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isLoadingIps ? (
            <div className="py-6 text-sm text-muted-foreground">
              Loading associated IPs...
            </div>
          ) : ipError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {ipError}
            </div>
          ) : associatedIps.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No associated IPs found.
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/40 p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source IP</TableHead>
                    <TableHead>Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {associatedIps.map((row) => (
                    <TableRow key={`${selectedNode}-${row.srcIp}`}>
                      <TableCell>
                        <Link
                          href={`/ipdrill?src_ip=${encodeURIComponent(row.srcIp)}`}
                          onClick={() => setIsDialogOpen(false)}
                          className="underline-offset-4 hover:underline"
                        >
                          {row.srcIp}
                        </Link>
                      </TableCell>
                      <TableCell>{row.requestCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
