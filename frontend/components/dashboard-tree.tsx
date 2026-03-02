"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"

import { cn } from "@/lib/utils"

type TreeNode = {
  name: string
  collapsed?: boolean
  children?: TreeNode[]
}

const treeData: TreeNode = {
  name: "",
  children: [
    {
      name: "Ingress",
      children: [
        { name: "CDN Edge" },
        { name: "VPN Gateway" },
        { name: "Partner API" },
      ],
    },
    {
      name: "Detections",
      children: [
        {
          name: "Automation Traffic",
          children: [{ name: "Headless Chrome" }, { name: "Playwright" }],
        },
        {
          name: "Policy Violations",
          children: [{ name: "Exfil Pattern" }, { name: "Unauthorized Tool" }],
        },
        {
          name: "Auth Risk",
          children: [{ name: "Password Spray" }, { name: "Session Replay" }],
        },
      ],
    },
    {
      name: "Actions",
      children: [
        { name: "Blocked" },
        { name: "Alerted" },
        { name: "Sandboxed" },
      ],
    },
    {
      name: "Assets",
      children: [
        { name: "api-gateway" },
        { name: "identity-service" },
        { name: "reports-service" },
      ],
    },
  ],
}

treeData.children?.forEach((child, index) => {
  if (index % 2 === 0) {
    child.collapsed = true
  }
})

type DashboardTreeProps = {
  className?: string
}

export function DashboardTree({ className }: DashboardTreeProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chartRef.current) {
      return
    }

    const chart = echarts.init(chartRef.current, undefined, {
      renderer: "canvas",
      useDirtyRect: false,
    })

    chart.showLoading("default", {
      text: "Loading tree...",
      color: "#a2e732",
      textColor: "#d4d4d8",
      maskColor: "rgba(24, 24, 27, 0.2)",
    })

    const timeoutId = window.setTimeout(() => {
      chart.hideLoading()
      chart.setOption({
        tooltip: {
          trigger: "item",
          triggerOn: "mousemove",
        },
        animationDuration: 650,
        animationDurationUpdate: 900,
        series: [
          {
            type: "tree",
            data: [treeData],
            top: "4%",
            left: "7%",
            bottom: "4%",
            right: "20%",
            symbol: "none",
            symbolSize: 0,
            orient: "RL",
            roam: false,
            lineStyle: {
              color: "rgba(162, 231, 50, 0.5)",
              width: 1.44,
              curveness: 0.35,
            },
            itemStyle: {
              color: "#a2e732",
              borderColor: "#d9ff8c",
              borderWidth: 1,
            },
            label: {
              position: "right",
              verticalAlign: "middle",
              align: "left",
              color: "#d4d4d8",
              fontSize: 9,
              backgroundColor: "rgba(24, 24, 27, 0.68)",
              borderRadius: 999,
              padding: [3, 6],
            },
            leaves: {
              label: {
                position: "left",
                verticalAlign: "middle",
                align: "right",
                color: "#a1a1aa",
                fontSize: 10,
                backgroundColor: "transparent",
                padding: 0,
              },
            },
            emphasis: {
              focus: "descendant",
            },
            expandAndCollapse: true,
            initialTreeDepth: 2,
          },
        ],
      })
    }, 500)

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })

    resizeObserver.observe(chartRef.current)

    return () => {
      window.clearTimeout(timeoutId)
      resizeObserver.disconnect()
      chart.dispose()
    }
  }, [])

  return <div ref={chartRef} className={cn("h-full w-full px-[10%]", className)} />
}
