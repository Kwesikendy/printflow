export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white min-h-screen text-black print:min-h-0 print:h-auto print:m-0 print:p-0">
      {children}
    </div>
  )
}
