import { AppSidebar } from "@/components/app-sidebar"
import { IncidentReportsPanel } from "@/components/incident-reports-panel"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function ReportsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">Incident Reports</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold">Incident Reports</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Ranked suspicious source IPs inferred from the latest completed ingestion job.
            </p>
          </div>
          <IncidentReportsPanel />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
