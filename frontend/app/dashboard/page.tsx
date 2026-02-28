import { AppSidebar } from "@/components/app-sidebar"
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
          <div className="bg-muted/50 flex min-h-screen flex-1 items-center justify-center rounded-xl md:min-h-min">
            <p className="text-muted-foreground text-sm">
              Nothing to display, please upload logs
            </p>
          </div>
          {/* <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="bg-muted/50 flex aspect-video items-center justify-center rounded-xl">
              <p className="text-muted-foreground text-center text-sm">
                Nothing to display, please upload logs
              </p>
            </div>
            <div className="bg-muted/50 flex aspect-video items-center justify-center rounded-xl">
              <p className="text-muted-foreground text-center text-sm">
                Nothing to display, please upload logs
              </p>
            </div>
            <div className="bg-muted/50 flex aspect-video items-center justify-center rounded-xl">
              <p className="text-muted-foreground text-center text-sm">
                Nothing to display, please upload logs
              </p>
            </div>
          </div>  */}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
