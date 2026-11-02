const path = require('path');

module.exports = {
  apps: [
    {
      name: "printflow",
      script: path.resolve(__dirname, "server.js"),
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "printflow-daily-backup",
      script: path.resolve(__dirname, "scripts", "run-backup.mjs"),
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      cron_restart: "0 17 * * *", // Runs every day at 17:00 (5:00 PM shift end)
      watch: false
    }
  ]
};
