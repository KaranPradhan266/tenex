"use client"

import Spline from "@splinetool/react-spline"

const splineSceneUrl = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL

export function DashboardSpline() {
  if (!splineSceneUrl) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center rounded-xl border border-dashed bg-background/60 p-6 text-center">
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
    <div className="pointer-events-none h-full min-h-[480px] overflow-hidden rounded-xl bg-background/60">
      <Spline scene={splineSceneUrl} />
    </div>
  )
}
