"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  RiArrowDownSLine,
  RiLogoutBoxRLine,
  RiSettings3Line,
} from "@remixicon/react"
import type { User } from "@supabase/supabase-js"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

function getDisplayName(user: User | null) {
  if (!user) {
    return "Guest"
  }

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.user_metadata?.user_name === "string"
          ? user.user_metadata.user_name
          : null

  if (metadataName) {
    return metadataName
  }

  if (user.email) {
    return user.email.split("@")[0]
  }

  return "User"
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      setUser(session?.user ?? null)
      setIsLoading(false)
    }

    void loadUser()

    const supabase = getSupabaseBrowserClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    setIsSigningOut(true)

    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()

    router.replace("/login")
    router.refresh()
  }

  const displayName = getDisplayName(user)
  const email = user?.email ?? "Signed in"
  const initials = getInitials(displayName)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold">
                {isLoading ? "..." : initials}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {email}
                </span>
              </div>
              <RiArrowDownSLine className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side="top"
            align="end"
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold">
                  {isLoading ? "..." : initials}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <RiSettings3Line />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
              <RiLogoutBoxRLine />
              {isSigningOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
