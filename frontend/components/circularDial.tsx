"use client"

import { cn } from "@/lib/utils"

type CircularDialProps = {
  className?: string
  showExport?: boolean
}

export function CircularDial({
  className,
  showExport = true,
}: CircularDialProps) {
  const size = 500
  const centerX = size / 2
  const centerY = size / 2

  // Inner circle with ticks
  const innerCircleRadius = 180
  const innerTickCount = 60
  const majorTickInterval = 5

  // Generate inner circle ticks (varying lengths)
  const innerTicks = Array.from({ length: innerTickCount }, (_, i) => {
    const angle = (i * 360) / innerTickCount - 90
    const angleRad = (angle * Math.PI) / 180
    const isMajorTick = i % majorTickInterval === 0
    const tickLength = isMajorTick ? 25 : 12

    const x1 = centerX + innerCircleRadius * Math.cos(angleRad)
    const y1 = centerY + innerCircleRadius * Math.sin(angleRad)
    const x2 = centerX + (innerCircleRadius - tickLength) * Math.cos(angleRad)
    const y2 = centerY + (innerCircleRadius - tickLength) * Math.sin(angleRad)

    return { x1, y1, x2, y2, isMajorTick }
  })

  const handleExport = () => {
    const svgElement = document.getElementById("circular-dial-svg")
    if (!svgElement) return

    const svgData = svgElement.outerHTML
    const blob = new Blob([svgData], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "circular-dial.svg"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        showExport ? "flex-col gap-8 p-8" : "h-full w-full",
        className
      )}
    >
      <svg
        id="circular-dial-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full max-w-[500px] opacity-20 drop-shadow-[0_0_10px_rgba(162,231,50,0.25)]"
      >
        {/* Inner circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={innerCircleRadius}
          fill="none"
          stroke="#a2e732"
          strokeWidth="1.5"
        />

        {/* Inner circle ticks */}
        {innerTicks.map((tick, index) => (
          <line
            key={`inner-${index}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#a2e732"
            strokeWidth={tick.isMajorTick ? "1.5" : "1"}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {showExport ? (
        <button
          onClick={handleExport}
          className="rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-gray-200"
        >
          Export SVG
        </button>
      ) : null}
    </div>
  )
}
