"use client"

import * as React from "react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { RiGalleryLine} from "@remixicon/react"

export function VersionSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
         <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <RiGalleryLine className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">Tenex.AI</span>
              </div>
            </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
