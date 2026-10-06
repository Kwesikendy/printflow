export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white min-h-screen text-black print:min-h-0 print:h-auto">
      {children}
    </div>
  )
}
