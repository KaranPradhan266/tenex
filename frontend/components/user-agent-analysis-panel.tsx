"use client"

import { useEffect, useState } from "react"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

import { UserAgentSunburst } from "./user-agent-sunburst"

const colors = ["#FFAE57", "#FF7853", "#EA5151", "#CC3F57", "#9A2555"]

const itemStyle = {
  star5: {
    color: colors[0],
  },
  star4: {
    color: colors[1],
  },
  star3: {
    color: colors[2],
  },
  star2: {
    color: colors[3],
  },
}

type UserAgentNode = {
  name: string
  value?: number
  itemStyle?: {
    color?: string
    opacity?: number
  }
  label?: {
    color?: string
    downplay?: {
      opacity?: number
    }
  }
  children?: UserAgentNode[]
}

type ChartUserAgentRow = {
  group_name: string
  category_name: string
  tier_name: string
  leaf_name: string
  event_count: number
}

function decorateTree(rawData: UserAgentNode[]) {
  return rawData.map((group) => ({
    ...group,
    children: group.children?.map((section) => ({
      ...section,
      itemStyle: {
        color: group.itemStyle?.color,
      },
      children: section.children?.map((tier) => {
        const style =
          tier.name === "5☆"
            ? itemStyle.star5
            : tier.name === "4☆"
              ? itemStyle.star4
              : tier.name === "3☆"
                ? itemStyle.star3
                : itemStyle.star2

        return {
          ...tier,
          label: {
            color: style.color,
            downplay: {
              opacity: 0.5,
            },
          },
          itemStyle: {
            color: "transparent",
            opacity: 1,
          },
          children: tier.children?.map((entry) => ({
            ...entry,
            label: {
              color: style.color,
              downplay: {
                opacity: 0.5,
              },
            },
            itemStyle: {
              color: style.color,
              opacity: 1,
            },
          })),
        }
      }),
    })),
  }))
}

function buildTreeFromRows(rows: ChartUserAgentRow[]) {
  const groups = new Map<string, UserAgentNode>()

  for (const row of rows) {
    let groupNode = groups.get(row.group_name)
    if (!groupNode) {
      groupNode = {
        name: row.group_name,
        itemStyle: {
          color: row.group_name === "Clients" ? colors[1] : colors[2],
        },
        children: [],
      }
      groups.set(row.group_name, groupNode)
    }

    let categoryNode = groupNode.children?.find(
      (child) => child.name === row.category_name
    )
    if (!categoryNode) {
      categoryNode = {
        name: row.category_name,
        children: [],
      }
      groupNode.children?.push(categoryNode)
    }

    let tierNode = categoryNode.children?.find(
      (child) => child.name === row.tier_name
    )
    if (!tierNode) {
      tierNode = {
        name: row.tier_name,
        children: [],
      }
      categoryNode.children?.push(tierNode)
    }

    tierNode.children?.push({
      name: row.leaf_name,
      value: row.event_count,
    })
  }

  return Array.from(groups.values())
}

export function UserAgentAnalysisPanel() {
  const [data, setData] = useState<UserAgentNode[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadUserAgentRows() {
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
        .from("chart_user_agents")
        .select(
          "group_name, category_name, tier_name, leaf_name, event_count"
        )
        .eq("job_id", latestJob.id)

      if (rowsError || !rows || rows.length === 0 || ignore) {
        if (!ignore) {
          setIsLoading(false)
        }
        return
      }

      setData(decorateTree(buildTreeFromRows(rows as ChartUserAgentRow[])))
      setIsLoading(false)
    }

    void loadUserAgentRows()

    return () => {
      ignore = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[640px] items-center justify-center text-sm text-muted-foreground">
        Loading user-agent analysis...
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[640px] items-center justify-center text-sm text-muted-foreground">
        Nothing to show
      </div>
    )
  }

  return <UserAgentSunburst data={data} />
}
