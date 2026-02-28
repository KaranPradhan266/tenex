import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function SettingsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">Settings</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold">Account Settings</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Settings content can go here next.
            </p>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
