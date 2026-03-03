import Link from "next/link"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const tabs = [
  {
    title: "Upload Logs",
    href: "/upload",
    intention:
      "Ingest structured log files, persist the raw source, and generate the summaries that power the rest of the application.",
    usage:
      "Use this first. Upload one file at a time when validating a new dataset, then verify the processing report before moving into analysis pages.",
  },
  {
    title: "Dashboard",
    href: "/dashboard",
    intention:
      "Provide a fast triage snapshot of the latest completed ingestion job, including priority IPs, suspicious outcomes, and traffic posture.",
    usage:
      "Use this as the landing control center after ingestion. It is best for deciding where to investigate next, not for deep analysis itself.",
  },
  {
    title: "Incident Reports",
    href: "/reports",
    intention:
      "Rank source IPs by predicted severity so analysts can focus on the most suspicious entities first.",
    usage:
      "Start here when the goal is prioritization. Use the severity tabs, confidence score, and why-flagged popup to decide which IP should be investigated in detail.",
  },
  {
    title: "IP Drill Down",
    href: "/ipdrill",
    intention:
      "Inspect one source IP in depth using precomputed service, path, outcome, status, volume, enrichment, and AI context.",
    usage:
      "Use this after selecting a suspicious IP. It is the best page for building an investigative narrative around one actor.",
  },
  {
    title: "Traffic Breakdown",
    href: "/traffic",
    intention:
      "Visualize the request flow from method to service to status class to outcome and action.",
    usage:
      "Use this to understand how traffic is moving through the system and where defensive actions are being triggered. Click nodes to pivot to associated IPs.",
  },
  {
    title: "User-Agent Analysis",
    href: "/user-agents",
    intention:
      "Surface client, automation, crawler, and suspicious user-agent behavior using a structured hierarchy.",
    usage:
      "Use this to separate likely human traffic from libraries, bots, and automation tooling. It is especially useful when client identity is part of the investigation.",
  },
  {
    title: "Summarized Timeline",
    href: "/timeline",
    intention:
      "Plot traffic volume over time for a selected source IP using precomputed minute buckets.",
    usage:
      "Use this to understand pacing, spikes, and request concentration for one IP after you have already identified it as relevant.",
  },
]

export default function OverviewPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">Overview</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 rounded-xl p-6">
            <div className="space-y-8">
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">SOC Workflow Overview</h2>
                <p className="text-muted-foreground max-w-5xl text-sm leading-6">
                  This application is designed to help a SOC analyst move from
                  raw structured logs to prioritized incident context. The
                  system ingests a log file once, generates security-focused
                  summaries, and exposes multiple investigative views that can
                  be used to pivot from high-level triage into IP-level detail.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recommended Flow
                </h3>
                <div className="grid gap-3 xl:grid-cols-4">
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      01
                    </p>
                    <p className="mt-2 font-medium">Upload logs</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Start ingestion and confirm the processing report.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      02
                    </p>
                    <p className="mt-2 font-medium">Triage ranked IPs</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Use Incident Reports to identify high-priority entities.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      03
                    </p>
                    <p className="mt-2 font-medium">Pivot into context</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Review traffic flow, user agents, and time-based activity.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      04
                    </p>
                    <p className="mt-2 font-medium">Investigate one IP</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Use IP Drill Down and AI insights to build the narrative.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Tabs And Intent
                </h3>
                <div className="grid gap-3 xl:grid-cols-2">
                  {tabs.map((tab) => (
                    <div
                      key={tab.href}
                      className="rounded-xl border border-border/60 bg-background/60 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium">{tab.title}</h4>
                            <Link
                              href={tab.href}
                              className="text-xs text-primary underline-offset-4 hover:underline"
                            >
                              Open
                            </Link>
                          </div>
                          <p className="text-sm text-muted-foreground leading-6">
                            {tab.intention}
                          </p>
                          <p className="text-sm text-muted-foreground leading-6">
                            {tab.usage}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-background/60 p-4">
                <h3 className="font-medium">How To Get The Most Out Of It</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Treat the dashboard and reports pages as decision surfaces,
                  and the drill-down pages as evidence surfaces. The strongest
                  workflow in the current application is: upload, rank,
                  investigate, then pivot between traffic flow, user-agent
                  identity, and IP-specific behavior until the source can be
                  explained clearly.
                </p>
              </section>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
