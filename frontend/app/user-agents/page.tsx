import { AppSidebar } from "@/components/app-sidebar"
import { UserAgentSunburst } from "@/components/user-agent-sunburst"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const colors = ["#FFAE57", "#FF7853", "#EA5151", "#CC3F57", "#9A2555"]

const itemStyle = {
  star5: {
    color: colors[0],
  },
  star4: {
    color: colors[1],
  },
  star3: {
    color: colors[2],
  },
  star2: {
    color: colors[3],
  },
}

type UserAgentNode = {
  name: string
  value?: number
  itemStyle?: {
    color?: string
    opacity?: number
  }
  label?: {
    color?: string
    downplay?: {
      opacity?: number
    }
  }
  children?: UserAgentNode[]
}

const rawUserAgentData: UserAgentNode[] = [
  {
    name: "Clients",
    itemStyle: {
      color: colors[1],
    },
    children: [
      {
        name: "Browsers",
        children: [
          {
            name: "5☆",
            children: [
              { name: "Chrome / Windows" },
              { name: "Chrome / macOS" },
              { name: "Safari / iPhone" },
            ],
          },
          {
            name: "4☆",
            children: [
              { name: "Safari / Mac" },
              { name: "Firefox / Desktop" },
              { name: "Edge / Windows" },
            ],
          },
          {
            name: "3☆",
            children: [{ name: "Opera / Desktop" }],
          },
        ],
      },
      {
        name: "Libraries",
        children: [
          {
            name: "5☆",
            children: [{ name: "python-requests" }],
          },
          {
            name: "4☆",
            children: [{ name: "curl" }, { name: "Go-http-client" }],
          },
          {
            name: "3☆",
            children: [{ name: "axios" }],
          },
        ],
      },
    ],
  },
  {
    name: "Automated",
    itemStyle: {
      color: colors[2],
    },
    children: [
      {
        name: "Automation",
        children: [
          {
            name: "5☆",
            children: [{ name: "Headless Chrome" }],
          },
          {
            name: "4☆",
            children: [{ name: "Playwright" }, { name: "Puppeteer" }],
          },
          {
            name: "3☆",
            children: [{ name: "Selenium Grid" }],
          },
        ],
      },
      {
        name: "Crawlers",
        children: [
          {
            name: "5☆",
            children: [{ name: "Googlebot" }],
          },
          {
            name: "4☆",
            children: [{ name: "Bingbot" }, { name: "DuckDuckBot" }],
          },
          {
            name: "3☆",
            children: [{ name: "YandexBot" }],
          },
        ],
      },
      {
        name: "Suspicious",
        children: [
          {
            name: "5☆",
            children: [{ name: "Spoofed UA" }],
          },
          {
            name: "4☆",
            children: [{ name: "Randomized Agents" }, { name: "Legacy Signatures" }],
          },
          {
            name: "3☆",
            children: [{ name: "Empty Header" }],
          },
          {
            name: "2☆",
            children: [{ name: "Malformed Tokens" }],
          },
        ],
      },
      {
        name: "Internal Tooling",
        children: [
          {
            name: "4☆",
            children: [{ name: "Synthetic Monitor" }, { name: "Health Probe" }],
          },
        ],
      },
      {
        name: "Mobile Apps",
        children: [
          {
            name: "5☆",
            children: [{ name: "iOS App WebView" }],
          },
          {
            name: "4☆",
            children: [{ name: "Android App WebView" }, { name: "Embedded SDK" }],
          },
          {
            name: "3☆",
            children: [{ name: "Legacy Hybrid App" }],
          },
        ],
      },
      {
        name: "Partner Traffic",
        children: [
          {
            name: "4☆",
            children: [{ name: "Partner API Gateway" }],
          },
        ],
      },
      {
        name: "Engineering",
        children: [
          {
            name: "5☆",
            children: [{ name: "Load Test Runner" }],
          },
          {
            name: "4☆",
            children: [{ name: "K6 Client" }],
          },
        ],
      },
    ],
  },
]

const userAgentData = rawUserAgentData.map((group) => ({
  ...group,
  children: group.children?.map((section) => ({
    ...section,
    itemStyle: {
      color: group.itemStyle?.color,
    },
    children: section.children?.map((bucket) => {
      const style =
        bucket.name === "5☆"
          ? itemStyle.star5
          : bucket.name === "4☆"
            ? itemStyle.star4
            : bucket.name === "3☆"
              ? itemStyle.star3
              : itemStyle.star2

      return {
        ...bucket,
        label: {
          color: style.color,
          downplay: {
            opacity: 0.5,
          },
        },
        children: bucket.children?.map((entry) => ({
          ...entry,
          value: 1,
          itemStyle: {
            color: style.color,
            opacity: 1,
          },
          label: {
            color: style.color,
          },
        })),
      }
    }),
  })),
}))

export default function UserAgentsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">User-Agent Analysis</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="bg-muted/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold">User-Agent Analysis</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Sunburst view of browser traffic, automation clients, SDK usage,
              and suspicious user-agent clusters.
            </p>
            <div className="mt-6 rounded-xl border bg-background/60 p-4">
              <UserAgentSunburst data={userAgentData} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
