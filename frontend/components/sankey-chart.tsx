"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"

type SankeyNode = {
  name: string
}

type SankeyLink = {
  source: string
  target: string
  value: number
}

type SankeyChartProps = {
  nodes: SankeyNode[]
  links: SankeyLink[]
  onNodeClick?: (nodeName: string) => void
}

export function SankeyChart({ nodes, links, onNodeClick }: SankeyChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const onNodeClickRef = useRef(onNodeClick)

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    if (!chartRef.current) {
      return
    }

    const chart = echarts.init(chartRef.current, undefined, {
      renderer: "canvas",
      useDirtyRect: false,
    })

    chart.setOption({
      animationDuration: 2500,
      title: {
        
        textStyle: {
          color: "#f5f5f5",
          fontSize: 16,
          fontWeight: 600,
        },
      },
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
      },
      series: [
        {
          type: "sankey",
          data: nodes,
          links,
          left: "10%",
          right: "10%",
          top: 24,
          bottom: 24,
          emphasis: {
            focus: "adjacency",
          },
          levels: [
            {
              depth: 0,
              itemStyle: {
                color: "#8ecf3a",
                borderColor: "#b6ea66",
              },
              lineStyle: {
                color: "source",
                opacity: 0.35,
              },
            },
            {
              depth: 1,
              itemStyle: {
                color: "#5da9e9",
                borderColor: "#9ecdf4",
              },
              lineStyle: {
                color: "source",
                opacity: 0.3,
              },
            },
            {
              depth: 2,
              itemStyle: {
                color: "#f59e0b",
                borderColor: "#f8c35c",
              },
              lineStyle: {
                color: "source",
                opacity: 0.28,
              },
            },
            {
              depth: 3,
              itemStyle: {
                color: "#f97373",
                borderColor: "#fca5a5",
              },
              lineStyle: {
                color: "source",
                opacity: 0.25,
              },
            },
          ],
          lineStyle: {
            curveness: 0.5,
          },
          label: {
            color: "#d4d4d8",
            fontSize: 12,
          },
          nodeGap: 18,
          nodeWidth: 14,
          draggable: false,
        },
      ],
      backgroundColor: "transparent",
    })

    const handleClick = (params: unknown) => {
      if (
        onNodeClickRef.current &&
        typeof params === "object" &&
        params !== null &&
        "dataType" in params &&
        "name" in params &&
        (params as { dataType?: string }).dataType === "node" &&
        typeof (params as { name?: unknown }).name === "string"
      ) {
        onNodeClickRef.current((params as { name: string }).name)
      }
    }

    chart.on("click", handleClick)

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })

    resizeObserver.observe(chartRef.current)

    return () => {
      chart.off("click", handleClick)
      resizeObserver.disconnect()
      chart.dispose()
    }
  }, [links, nodes])

  return <div ref={chartRef} className="h-[480px] w-full opacity-70" />
}
