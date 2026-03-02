import { AppSidebar } from "@/components/app-sidebar"
import { IpSignalsPanel } from "@/components/ip-signals-panel"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function TimelinePage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">Summarized Timeline</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold">IP Signal Analysis</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Inspect burst and beaconing behavior for a single source IP from
              the latest completed ingestion job.
            </p>
            <div className="mt-6 rounded-xl border bg-background/60 p-4">
              <IpSignalsPanel />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
