import { AppSidebar } from "@/components/app-sidebar"
import { SankeyChart } from "@/components/sankey-chart"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const sankeyData = {
  nodes: [
    { "name": "Total Events" },

    { name: "HTTP" },
    { name: "DNS" },
    { name: "AUTH" },

    { name: "Automation Traffic" },
    { name: "Policy Violation" },
    { name: "Beaconing Behavior" },
    { name: "Brute Force Activity" },

    { name: "C2 Suspected Incident" },
    { name: "Account Compromise Attempt" },
    { name: "Productivity Policy Enforcement" },

    { name: "Blocked" },
    { name: "Alerted" },
    { name: "Allowed" },

    { name: "10.0.12.34" },
    { name: "10.0.44.19" },
    { name: "10.0.91.3" }
  ],
  links: [
    { "source": "Total Events", "target": "HTTP", "value": 1200 },
    { "source": "Total Events", "target": "DNS", "value": 450 },
    { "source": "Total Events", "target": "AUTH", "value": 300 },

    { "source": "HTTP", "target": "Automation Traffic", "value": 300 },
    { "source": "HTTP", "target": "Policy Violation", "value": 500 },

    { "source": "DNS", "target": "Beaconing Behavior", "value": 200 },

    { "source": "AUTH", "target": "Brute Force Activity", "value": 150 },

    { "source": "Automation Traffic", "target": "Productivity Policy Enforcement", "value": 180 },
    { "source": "Beaconing Behavior", "target": "C2 Suspected Incident", "value": 160 },
    { "source": "Brute Force Activity", "target": "Account Compromise Attempt", "value": 120 },

    { "source": "Productivity Policy Enforcement", "target": "Blocked", "value": 180 },
    { "source": "C2 Suspected Incident", "target": "Alerted", "value": 160 },
    { "source": "Account Compromise Attempt", "target": "Blocked", "value": 120 },

    { "source": "Productivity Policy Enforcement", "target": "10.0.12.34", "value": 180 },
    { "source": "C2 Suspected Incident", "target": "10.0.44.19", "value": 160 },
    { "source": "Account Compromise Attempt", "target": "10.0.91.3", "value": 120 }
  ],
}

export default function TrafficPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">Traffic Breakdown</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold">Traffic Breakdown</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Sankey view of request flow across filtering, authentication, and
              backend systems.
            </p>
            <div className="mt-6 rounded-xl border bg-background/60 p-4">
              <SankeyChart
                nodes={sankeyData.nodes}
                links={sankeyData.links}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
