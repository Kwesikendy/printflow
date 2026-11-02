const { nextStart } = require('next/dist/cli/next-start');
const path = require('path');
const { fork } = require('child_process');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

process.title = 'printflow';

/**
 * Automatically schedules daily backups at 17:00 UTC (5:00 PM Africa/Accra)
 * aligning with the Ghanaian print shop shift change.
 */
function scheduleNextDailyBackup() {
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(17, 0, 0, 0);
  if (now.getTime() >= nextRun.getTime()) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  const delay = nextRun.getTime() - now.getTime();
  const hoursUntil = (delay / 3600000).toFixed(1);
  console.log(`[Backup Scheduler] Next automated daily backup scheduled for ${nextRun.toISOString()} (in ${hoursUntil} hrs)`);

  const timer = setTimeout(() => {
    console.log('[Backup Scheduler] Triggering automated daily shift backup...');
    try {
      const backupScript = path.join(__dirname, 'scripts', 'run-backup.mjs');
      const child = fork(backupScript, [], { stdio: 'inherit' });

      child.on('exit', (code) => {
        console.log(`[Backup Scheduler] Backup process finished with exit code ${code}`);
        scheduleNextDailyBackup();
      });

      child.on('error', (err) => {
        console.error('[Backup Scheduler] Failed to spawn backup process:', err);
        scheduleNextDailyBackup();
      });
    } catch (err) {
      console.error('[Backup Scheduler] Error triggering backup:', err);
      scheduleNextDailyBackup();
    }
  }, delay);

  if (timer.unref) {
    timer.unref();
  }
}

nextStart({ port, hostname }, __dirname)
  .then(() => {
    scheduleNextDailyBackup();
  })
  .catch((err) => {
    console.error('Fatal Next.js startup error:', err);
    process.exit(1);
  });
