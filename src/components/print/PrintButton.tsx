'use client'

export function PrintButton({ label = 'Print payslip' }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">{label}</button>
}
