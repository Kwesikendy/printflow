import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/contexts/SessionContext'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'PrintFlow — Print Shop Management',
  description: 'Multi-tenant SaaS for graphic printing shops. Manage jobs, payments, and production in real time.',
  icons: {
    icon: '/printflow-logo.jpg',
    apple: '/printflow-logo.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <SessionProvider>
          <AppShell>
            {children}
          </AppShell>
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                borderRadius: '12px',
                fontFamily: 'inherit',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}

