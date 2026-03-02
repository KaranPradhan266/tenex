"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"

type TimeSeriesPoint = {
  bucket_ts: string
  value: number
}

type IpSignalsChartProps = {
  points: TimeSeriesPoint[]
}

export function IpSignalsChart({ points }: IpSignalsChartProps) {
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
          name: "Traffic",
          type: "line",
          smooth: true,
          symbol: "none",
          areaStyle: {
            color: "rgba(250, 204, 21, 0.14)",
          },
          lineStyle: {
            width: 2,
            color: "#facc15",
          },
          emphasis: {
            focus: "series",
          },
          data: points.map((point) => [point.bucket_ts, point.value]),
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
  }, [points])

  return <div ref={chartRef} className="h-[420px] w-full" />
}
