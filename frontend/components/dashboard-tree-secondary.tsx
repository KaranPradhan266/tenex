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
      name: "Response",
      children: [
        { name: "Case Opened" },
        { name: "Playbook Triggered" },
        { name: "Containment Started" },
      ],
    },
    {
      name: "Assets",
      children: [
        {
          name: "Endpoints",
          children: [{ name: "ENG-LT-22" }, { name: "HR-MBP-03" }],
        },
        {
          name: "Services",
          children: [{ name: "auth-api" }, { name: "reporting-api" }],
        },
      ],
    },
    {
      name: "Evidence",
      children: [
        { name: "DNS Anomaly" },
        { name: "Session Drift" },
        { name: "Privilege Spike" },
      ],
    },
    {
      name: "Outcome",
      children: [
        { name: "Escalated" },
        { name: "Observed" },
        { name: "Closed" },
      ],
    },
  ],
}

treeData.children?.forEach((child, index) => {
  if (index % 2 === 0) {
    child.collapsed = true
  }
})

type DashboardTreeSecondaryProps = {
  className?: string
}

export function DashboardTreeSecondary({
  className,
}: DashboardTreeSecondaryProps) {
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
              position: "left",
              verticalAlign: "middle",
              align: "right",
              fontSize: 9,
              color: "#d4d4d8",
              backgroundColor: "rgba(24, 24, 27, 0.68)",
              borderRadius: 999,
              padding: [3, 6],
            },
            leaves: {
              label: {
                position: "right",
                verticalAlign: "middle",
                align: "left",
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
