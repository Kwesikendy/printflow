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
      kill_timeout: 4000,
      restart_delay: 2000,
      min_uptime: "5s",
      max_restarts: 15,
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
