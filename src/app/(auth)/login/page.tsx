'use client'

import { useState, useTransition, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import Image from 'next/image'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) setError(errorParam)
  }, [searchParams])

  // Fetch tenant branding (uses the first tenant for the logo/name)
  useEffect(() => {
    const fetchBranding = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('tenants').select('name, logo_url').limit(1).single()
      if (data) {
        setTenantName((data as any).name)
        setLogoUrl((data as any).logo_url || null)
      }
    }
    fetchBranding()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else if (result?.success && result.url) {
        window.location.href = result.url
      }
    })
  }

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 gap-3">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={tenantName || 'Company Logo'}
            width={240}
            height={75}
            priority
            unoptimized
            className="object-contain select-none drop-shadow-sm rounded-lg"
            style={{ maxHeight: '68px', width: 'auto' }}
          />
        ) : (
          <Image
            src="/printflow-logo.jpg"
            alt="PrintFlow"
            width={240}
            height={75}
            priority
            className="object-contain select-none drop-shadow-sm"
            style={{ maxHeight: '68px', width: 'auto' }}
          />
        )}
        {tenantName && (
          <p className="text-xl font-black text-slate-800 tracking-tight">{tenantName}</p>
        )}
      </div>

      <p className="text-center text-sm text-slate-500 mb-8 font-medium">
        Sign in to your print shop dashboard
      </p>

      <Card className="mx-4 sm:mx-0">
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-600">
                Email address
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-standard"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-600">
                Password
              </label>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input-standard"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" className="w-full" loading={isPending}>
                Sign in
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  )
}

