"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getSupabaseBrowserClient,
  hasSupabaseCredentials,
} from "@/lib/supabase/client"

export default function DashboardPage() {
  const router = useRouter()
  const configurationError = hasSupabaseCredentials
    ? null
    : "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local."
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(hasSupabaseCredentials)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    if (configurationError) {
      return
    }

    let isMounted = true

    const loadSession = async () => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (sessionError) {
        setError(sessionError.message)
        setIsLoading(false)
        return
      }

      if (!session) {
        router.replace("/login")
        return
      }

      setEmail(session.user.email ?? null)
      setIsLoading(false)
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [configurationError, router])

  const handleSignOut = async () => {
    if (!hasSupabaseCredentials) {
      return
    }

    setError(null)
    setIsSigningOut(true)

    const supabase = getSupabaseBrowserClient()
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
      setIsSigningOut(false)
      return
    }

    router.replace("/login")
    router.refresh()
  }

  return (
    <main className="bg-muted flex min-h-svh items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking session...</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Signed in{email ? ` as ${email}` : ""}.
            </p>
          )}
          {configurationError || error ? (
            <p className="text-sm text-red-600">{configurationError ?? error}</p>
          ) : null}
          <Button
            type="button"
            onClick={handleSignOut}
            disabled={isLoading || isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
