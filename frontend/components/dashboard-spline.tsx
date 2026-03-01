"use client"

import Spline from "@splinetool/react-spline"

import { cn } from "@/lib/utils"

const splineSceneUrl = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL

type DashboardSplineProps = {
  className?: string
}

export function DashboardSpline({ className }: DashboardSplineProps) {
  if (!splineSceneUrl) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[480px] items-center justify-center rounded-xl border border-dashed bg-background/60 p-6 text-center",
          className
        )}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Spline scene not configured</p>
          <p className="text-muted-foreground text-sm">
            Set `NEXT_PUBLIC_SPLINE_SCENE_URL` in `frontend/.env` or
            `frontend/.env.local` to render your dashboard scene.
          </p>
        </div>
      </div>
    )
  }

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
