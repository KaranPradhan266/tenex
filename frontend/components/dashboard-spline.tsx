"use client"

import Spline from "@splinetool/react-spline"

import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type DashboardSplineProps = {
  className?: string
}

export function DashboardSpline({ className }: DashboardSplineProps) {
  const { state } = useSidebar()

  const splineSceneUrl =
    process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ?? "/mainGlobe.splinecode"

  return (
    <div
      className={cn(
        "pointer-events-none h-full min-h-[480px] overflow-hidden rounded-xl bg-background/60",
        className
      )}
    >
      <Spline scene={splineSceneUrl} />
    </div>
  )
}
