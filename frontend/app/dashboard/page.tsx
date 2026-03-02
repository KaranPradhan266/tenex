import { AppSidebar } from "@/components/app-sidebar"
import { CircularDial } from "@/components/circularDial"
import { DashboardSpline } from "@/components/dashboard-spline"
import { DashboardTree } from "@/components/dashboard-tree"
import { DashboardTreeSecondary } from "@/components/dashboard-tree-secondary"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          {/* <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          /> */}
          {/* <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Build Your Application</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Data Fetching</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb> */}
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 min-h-screen flex-1 rounded-xl p-4 md:min-h-min">
            <div className="relative flex h-full min-h-[640px] items-center justify-center overflow-hidden rounded-xl">
              <DashboardSpline className="absolute inset-x-[22%] inset-y-[24%] min-h-0 -translate-y-[25%] rounded-full bg-transparent" />
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <CircularDial
                  showExport={false}
                  className="h-full w-full max-w-[512px]"
                />
              </div>
              <div className="absolute inset-y-[6%] left-0 z-20 w-[50%]">
                <DashboardTree className="min-h-0" />
              </div>
              <div className="absolute inset-y-[6%] right-0 z-20 w-[50%]">
                <DashboardTreeSecondary className="min-h-0" />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
