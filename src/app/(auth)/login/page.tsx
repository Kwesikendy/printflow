'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import Image from 'next/image'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      }
      // If successful, the server action handles the redirect
    })
  }

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Image
          src="/printflow-logo.jpg"
          alt="PrintFlow"
          width={240}
          height={75}
          priority
          className="object-contain select-none drop-shadow-sm"
          style={{ maxHeight: '68px', width: 'auto' }}
        />
      </div>
      
      <p className="text-center text-sm text-slate-500 mb-8 font-medium">
        Sign in to your print shop dashboard
      </p>

      <Card glass className="mx-4 sm:mx-0">
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
                  placeholder="you@example.com"
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
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={isPending}
              >
                Sign in
              </Button>
            </div>
            
            <div className="text-center mt-4">
              <p className="text-xs text-slate-500">
                MVP Demo Access: Use the credentials from the README to log in.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
