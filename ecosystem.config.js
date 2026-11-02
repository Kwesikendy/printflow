const path = require('path');

module.exports = {
  apps: [
    {
      name: 'printflow',
      cwd: __dirname,
      script: path.resolve(__dirname, 'server.js'),
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'printflow-daily-backup',
      cwd: __dirname,
      script: path.resolve(__dirname, 'scripts', 'run-backup.mjs'),
      exec_mode: 'fork',
      instances: 1,
      autorestart: false,
      cron_restart: '0 17 * * *', // Runs every day at 17:00 (5:00 PM shift end)
      watch: false
    }
  ]
};
