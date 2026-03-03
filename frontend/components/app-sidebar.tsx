import * as React from "react"
import Link from "next/link"

import { UserMenu } from "@/components/user-menu"
import { VersionSwitcher } from "@/components/version-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  navMain: [
  {
    title: "Getting Started",
    url: "#",
    items: [
      {
        title: "Overview",
        url: "/overview",
      },
      {
        title: "Upload Logs",
        url: "/upload",
      },
    ],
  },
  {
    title: "Command Center",
    url: "#",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
      },
    ],
  },
  // {
  //   title: "Threats & Incidents",
  //   url: "#",
  //   items: [
  //     {
  //       title: "Incidents",
  //       url: "/incidents",
  //     },
  //     {
  //       title: "Alerts",
  //       url: "/alerts",
  //     },
  //     {
  //       title: "High-Risk Entities",
  //       url: "/high-risk",
  //     },
  //     {
  //       title: "Automation Traffic",
  //       url: "/automation",
  //     },
  //   ],
  // },
  {
    title: "Analytics",
    url: "#",
    items: [
      {
        title: "Traffic Breakdown",
        url: "/traffic",
      },
      {
        title: "IP Drill Down",
        url: "/ipdrill",
      },
      {
        title: "User-Agent Analysis",
        url: "/user-agents",
      },
    ],
  },
  {
    title: "Reports",
    url: "#",
    items: [
      {
        title: "Summarized Timeline",
        url: "/timeline",
      },
      {
        title: "Incident Reports",
        url: "/reports",
      },
    ],
  },
],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher/>
        {/* <SearchForm /> */}
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>{item.title}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
