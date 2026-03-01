"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"

type SunburstNode = {
  name: string
  value?: number
  itemStyle?: {
    color?: string
    opacity?: number
    shadowBlur?: number
    shadowColor?: string
  }
  label?: {
    color?: string
    rotate?: "radial" | "tangential" | number
    fontSize?: number
    position?: "inside" | "outside"
    downplay?: {
      opacity?: number
    }
    textShadowBlur?: number
    textShadowColor?: string
  }
  children?: SunburstNode[]
}

type UserAgentSunburstProps = {
  data: SunburstNode[]
}

type SunburstSortParam = {
  depth: number
  dataIndex: number
  getValue: () => number
}

export function UserAgentSunburst({ data }: UserAgentSunburstProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chartRef.current) {
      return
    }

    const colors = ["#FFAE57", "#FF7853", "#EA5151", "#CC3F57", "#9A2555"]
    const backgroundColor = "#2E2733"

    const chart = echarts.init(chartRef.current, undefined, {
      renderer: "canvas",
      useDirtyRect: false,
    })

    chart.showLoading("default", {
      text: "Loading analysis...",
      color: colors[0],
      textColor: "#d4d4d8",
      maskColor: "rgba(24, 24, 27, 0.35)",
    })

    const timeoutId = window.setTimeout(() => {
      chart.hideLoading()
      chart.setOption({
      backgroundColor,
      color: colors,
      animationDuration: 2500,
      animationDurationUpdate: 2500,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
      },
      series: [
        {
          type: "sunburst",
          center: ["50%", "50%"],
          data,
          radius: ["0%", "62%"],
          sort(a: SunburstSortParam, b: SunburstSortParam) {
            if (a.depth === 1) {
              return b.getValue() - a.getValue()
            }

            return a.dataIndex - b.dataIndex
          },
          label: {
            rotate: "radial",
            color: backgroundColor,
            fontSize: 9,
            overflow: "truncate",
            width: 80,
          },
          itemStyle: {
            borderColor: backgroundColor,
            borderWidth: 2,
          },
          levels: [
            {},
            {
              r0: "0%",
              r: "14%",
              label: {
                rotate: 0,
              },
            },
            {
              r0: "14%",
              r: "34%",
            },
            {
              r0: "38%",
              r: "52%",
              itemStyle: {
                shadowBlur: 2,
                shadowColor: colors[2],
                color: "transparent",
              },
              label: {
                rotate: "tangential",
                fontSize: 8,
                color: colors[0],
                overflow: "truncate",
                width: 72,
              },
            },
            {
              r0: "54%",
              r: "62%",
              itemStyle: {
                shadowBlur: 60,
                shadowColor: colors[0],
              },
              label: {
                position: "outside",
                textShadowBlur: 5,
                textShadowColor: "#111827",
                overflow: "truncate",
                width: 110,
              },
              downplay: {
                label: {
                  opacity: 0.5,
                },
              },
            },
          ],
        },
      ],
    })
    }, 800)

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })

    resizeObserver.observe(chartRef.current)

    return () => {
      window.clearTimeout(timeoutId)
      resizeObserver.disconnect()
      chart.dispose()
    }
  }, [data])

  return <div ref={chartRef} className="h-[640px] w-full opacity-80" />
}
