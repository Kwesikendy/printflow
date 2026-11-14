export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startAutoBackupScheduler } = await import('@/lib/auto-backup-scheduler')
      startAutoBackupScheduler()
    } catch (err) {
      console.warn('[Instrumentation] Failed to initialize auto-backup scheduler:', err)
    }
  }
}
