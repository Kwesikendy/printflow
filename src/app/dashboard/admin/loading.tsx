export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top action / metrics skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-slate-100" />
              <div className="h-4 w-24 bg-slate-100 rounded-md" />
            </div>
            <div className="h-8 w-16 bg-slate-200 rounded-lg mb-2" />
            <div className="h-3 w-32 bg-slate-100 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main content / table card skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-200 rounded-md" />
            <div className="h-3.5 w-72 bg-slate-100 rounded-md" />
          </div>
          <div className="h-9 w-28 bg-slate-100 rounded-xl" />
        </div>

        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-14 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center px-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-36 bg-slate-200 rounded-md" />
                  <div className="h-2.5 w-24 bg-slate-100 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-20 bg-slate-100 rounded-md" />
                <div className="h-8 w-24 bg-slate-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
