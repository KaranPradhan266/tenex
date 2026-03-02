"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"

type TimeSeriesPoint = {
  bucket_ts: string
  value: number
}

type IpSignalsChartProps = {
  trafficPoints: TimeSeriesPoint[]
  allowedPoints: TimeSeriesPoint[]
  blockedPoints: TimeSeriesPoint[]
}

export function IpSignalsChart({
  trafficPoints,
  allowedPoints,
  blockedPoints,
}: IpSignalsChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chartRef.current) {
      return
    }

    const chart = echarts.init(chartRef.current, undefined, {
      renderer: "canvas",
      useDirtyRect: false,
    })

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        position(pt: number[]) {
          return [pt[0], "10%"]
        },
      },
      legend: {
        top: 0,
        textStyle: {
          color: "#a1a1aa",
        },
      },
      xAxis: {
        type: "time",
        boundaryGap: false,
        axisLabel: {
          color: "#a1a1aa",
        },
        axisLine: {
          lineStyle: {
            color: "#27272a",
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: "value",
        boundaryGap: [0, "100%"],
        name: "Requests",
        nameTextStyle: {
          color: "#a1a1aa",
          padding: [0, 0, 0, 8],
        },
        axisLabel: {
          color: "#a1a1aa",
        },
        axisLine: {
          show: false,
        },
        splitLine: {
          lineStyle: {
            color: "rgba(255,255,255,0.08)",
          },
        },
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
        },
        {
          start: 0,
          end: 100,
          height: 18,
          borderColor: "#27272a",
          fillerColor: "rgba(163, 230, 53, 0.16)",
          textStyle: {
            color: "#a1a1aa",
          },
        },
      ],
      series: [
        {
          name: "All Traffic",
          type: "line",
          smooth: false,
          symbol: "none",
          areaStyle: {
            color: "rgba(250, 204, 21, 0.12)",
          },
          lineStyle: {
            width: 2,
            color: "#facc15",
          },
          emphasis: {
            focus: "series",
          },
          data: trafficPoints.map((point) => [point.bucket_ts, point.value]),
        },
        {
          name: "Allowed",
          type: "line",
          smooth: false,
          symbol: "none",
          areaStyle: {
            color: "rgba(163, 230, 53, 0.12)",
          },
          lineStyle: {
            width: 2,
            color: "#a3e635",
          },
          emphasis: {
            focus: "series",
          },
          data: allowedPoints.map((point) => [point.bucket_ts, point.value]),
        },
        {
          name: "Blocked",
          type: "line",
          smooth: false,
          symbol: "none",
          areaStyle: {
            color: "rgba(248, 113, 113, 0.12)",
          },
          lineStyle: {
            width: 2,
            color: "#f87171",
          },
          emphasis: {
            focus: "series",
          },
          data: blockedPoints.map((point) => [point.bucket_ts, point.value]),
        },
      ],
      animationDuration: 700,
      animationEasing: "cubicOut",
    })

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })

    resizeObserver.observe(chartRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
    }
  }, [trafficPoints, allowedPoints, blockedPoints])

  return <div ref={chartRef} className="h-[420px] w-full" />
}
