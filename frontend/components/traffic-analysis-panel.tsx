"use client"

import { useEffect, useState } from "react"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

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

export function TrafficAnalysisPanel() {
  const [data, setData] = useState<{
    nodes: SankeyNode[]
    links: SankeyLink[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

      setData(buildSankeyData(rows as TrafficSankeyRow[]))
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

  return <SankeyChart nodes={data.nodes} links={data.links} />
}
