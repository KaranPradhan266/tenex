import { AppSidebar } from "@/components/app-sidebar"
import { UploadPanel } from "@/components/upload-panel"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function UploadPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">Upload Logs</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 rounded-xl p-4 md:p-6">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold">Upload Logs</h2>
              <p className="text-muted-foreground text-sm">
                Review the intake experience here before wiring it to the
                backend ingestion API.
              </p>
            </div>
            <UploadPanel />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
