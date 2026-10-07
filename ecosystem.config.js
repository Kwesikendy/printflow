module.exports = {
  apps: [
    {
      name: 'printflow',
      script: 'npm.cmd',
      args: 'run start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
}
