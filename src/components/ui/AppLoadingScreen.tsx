'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface AppLoadingScreenProps {
  visible: boolean
  tenantName?: string
  logoUrl?: string | null
}

export function AppLoadingScreen({ visible, tenantName, logoUrl }: AppLoadingScreenProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!visible) return
    const start = Date.now()
    const duration = 2300
    setProgress(0)

    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / duration) * 100, 100)
      setProgress(pct)
      if (pct < 100) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(99,102,241,0.07) 0%, #f8fafc 60%, #f1f5f9 100%)',
          }}
        >
          {/* Soft glow blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }}
            />
            <div
              className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }}
            />
          </div>

          {/* Floating background icons */}
          <motion.div
            initial={{ opacity: 0, x: -60, y: 20, rotate: -15 }}
            animate={{ opacity: 0.18, x: -80, y: 0, rotate: -15 }}
            transition={{ delay: 0.4, duration: 1, ease: 'easeOut' }}
            className="absolute left-[12%] top-[20%]"
          >
            <Image src="/3d_file.png" alt="" width={100} height={100} className="select-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60, y: -20, rotate: 12 }}
            animate={{ opacity: 0.15, x: 80, y: 0, rotate: 12 }}
            transition={{ delay: 0.6, duration: 1, ease: 'easeOut' }}
            className="absolute right-[12%] top-[18%]"
          >
            <Image src="/3d_filed.png" alt="" width={110} height={110} className="select-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30, y: 30, rotate: 8 }}
            animate={{ opacity: 0.12, x: -50, y: 0, rotate: 8 }}
            transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
            className="absolute left-[18%] bottom-[22%]"
          >
            <Image src="/3d_filed.png" alt="" width={80} height={80} className="select-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30, y: 30, rotate: -10 }}
            animate={{ opacity: 0.12, x: 50, y: 0, rotate: -10 }}
            transition={{ delay: 0.7, duration: 1, ease: 'easeOut' }}
            className="absolute right-[18%] bottom-[20%]"
          >
            <Image src="/3d_file.png" alt="" width={85} height={85} className="select-none" />
          </motion.div>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center gap-8">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
              className="drop-shadow-xl flex flex-col items-center gap-3"
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={tenantName || 'Company Logo'}
                  width={320}
                  height={100}
                  priority
                  unoptimized
                  className="select-none object-contain rounded-xl"
                  style={{ maxHeight: '90px', width: 'auto' }}
                />
              ) : (
                <Image
                  src="/printflow-logo.jpg"
                  alt="PrintFlow"
                  width={320}
                  height={100}
                  priority
                  className="select-none object-contain rounded-xl"
                  style={{ maxHeight: '90px', width: 'auto' }}
                />
              )}
              {tenantName && (
                <p className="text-2xl font-black text-slate-800 tracking-tight">{tenantName}</p>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-sm font-medium tracking-widest text-slate-400 uppercase"
            >
              Preparing your workspace…
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="w-64 h-[3px] bg-slate-200 rounded-full overflow-hidden"
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)',
                  backgroundSize: '200% 100%',
                  transition: 'width 0.1s linear',
                }}
                animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
                transition={{ backgroundPosition: { repeat: Infinity, duration: 1.5, ease: 'linear' } }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
