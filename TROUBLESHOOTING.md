# PrintFlow Troubleshooting & Production Runbook

This document details common issues encountered during local development and Windows VPS production deployment with Next.js and PM2, along with root causes and exact resolution steps.

---

## Table of Contents
1. [Local Development: V8 Heap OOM Error on Node 24](#1-local-development-v8-heap-oom-error-on-node-24)
2. [IDE Warnings: Tailwind v4 `@theme` & Next.js `metadata`](#2-ide-warnings-tailwind-v4-theme--nextjs-metadata)
3. [VPS Issue: PM2 Crash Loop (`↺ 700+`, `status: stopped`)](#3-vps-issue-pm2-crash-loop--700-status-stopped)
4. [VPS Issue: Port Collision (`EADDRINUSE: address already in use :::3000`)](#4-vps-issue-port-collision-eaddrinuse-address-already-in-use-3000)
5. [VPS Issue: Extensionless Next Binary on Windows](#5-vps-issue-extensionless-next-binary-on-windows)
6. [VPS Issue: Git Pull Blocked by Untracked Files](#6-vps-issue-git-pull-blocked-by-untracked-files)
7. [Standard Operations Quick-Reference Runbook](#7-standard-operations-quick-reference-runbook)

---

## 1. Local Development: V8 Heap OOM Error on Node 24

### Symptom
Running `npm run dev` fails almost immediately (< 300ms) with:
```text
FATAL ERROR: MarkCompactCollector: young object promotion failed Allocation failed - JavaScript heap out of memory
```

### Root Cause
Under Node.js v24, Turbopack's native Rust bindings allocate rapid objects in V8's young generation (nursery) during startup. Under default memory limits, objects surviving GC scavenges fail promotion into the old space, throwing this fatal error.

### Resolution
Pass `--max-old-space-size=4096` directly to Node in `package.json`:
```json
"scripts": {
  "dev": "node --max-old-space-size=4096 ./node_modules/next/dist/bin/next dev",
  "dev:webpack": "next dev --webpack"
}
```
If Turbopack ever misbehaves, run `npm run dev:webpack`.

---

## 2. IDE Warnings: Tailwind v4 `@theme` & Next.js `metadata`

### Issue A: "Unknown at rule @theme" in `globals.css`
* **Cause**: Tailwind CSS v4 introduced native `@theme` directives that the standard VS Code CSS language service does not recognise by default.
* **Fix**: Added `.vscode/settings.json`:
  ```json
  {
    "css.lint.unknownAtRules": "ignore"
  }
  ```

### Issue B: "The Next.js 'metadata' export should be type of 'Metadata' from 'next'"
* **Cause**: App Router pages exporting `export const metadata = { ... }` without the explicit `Metadata` type annotation.
* **Fix**:
  ```typescript
  import type { Metadata } from 'next'

  export const metadata: Metadata = {
    title: 'Your Page Title',
  }
  ```

---

## 3. VPS Issue: PM2 Crash Loop (`↺ 700+`, `status: stopped`)

### Symptom
Running `pm2 status` shows a process with hundreds of restarts (`↺ 750+`) and status `stopped` or `errored`.

### Root Cause
1. **Crash Threshold**: When a process dies within 1–2 seconds of starting, PM2 restarts it continuously until its auto-restart throttle triggers and marks it `stopped` to protect server CPU.
2. **`pm2 restart` Trap**: `pm2 restart` **never** updates the saved command, working directory, or environment. If PM2 was originally registered with paths pointing to a missing drive (e.g. `D:\Printess` from local development while on a VPS at `C:\Apps\printflow`), `pm2 restart` simply re-runs the broken configuration.
3. **`npm.cmd` on Windows**: Running `pm2 start "npm start"` on Windows spawns a `.cmd` batch file. PM2 cannot cleanly manage `.cmd` sub-processes, leading to unhandled termination.

### Resolution
Never just `pm2 restart` a corrupted process. Always delete and re-register:
```powershell
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 4. VPS Issue: Port Collision (`EADDRINUSE: address already in use :::3000`)

### Symptom
In PM2 logs (`pm2 logs printflow --lines 25 --nostream`):
```text
Error: listen EADDRINUSE: address already in use :::3000
  code: 'EADDRINUSE',
  errno: -4091,
  syscall: 'listen'
```

### Root Causes
1. **Orphan Node Process**: A previous crashed, detached, or manual Node server is still holding port 3000 in the background.
2. **PM2 `cluster` Mode**: In `cluster` mode (`instances: 'max'` or multiple instances), Next.js workers attempt to bind directly to the same port 3000 simultaneously without a reverse load balancer.

### Resolution
1. **Force Fork Mode**: Ensure `ecosystem.config.cjs` uses `instances: 1` and `exec_mode: "fork"`:
   ```javascript
   module.exports = {
     apps: [
       {
         name: "printflow",
         script: "server.js",
         instances: 1,
         exec_mode: "fork",
         env: {
           NODE_ENV: "production",
           PORT: 3000
         }
       }
     ]
   };
   ```
2. **Kill any process holding port 3000**:
   ```powershell
   $ports = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
   if ($ports) {
       $ports | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
   }
   ```

---

## 5. VPS Issue: Extensionless Next Binary on Windows

### Symptom
PM2 crashes when pointing `script` to `./node_modules/next/dist/bin/next`.

### Root Cause
On Linux, `./node_modules/next/dist/bin/next` has a shebang `#!/usr/bin/env node` which the OS kernel executes via Node.
On **Windows**, there is no native shebang handler, and files without extensions cannot be spawned as native executables by PM2 fork mode.

### Resolution
We created `server.js` in the project root:
```javascript
const { spawn } = require('child_process');
const path = require('path');

const nextBin = path.resolve(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
const port = process.env.PORT || '3000';

const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
```
And configured PM2 to launch `server.js`, which Node executes natively across all platforms.

---

## 6. VPS Issue: Git Pull Blocked by Untracked Files

### Symptom
```text
error: The following untracked working tree files would be overwritten by merge:
        ecosystem.config.cjs
Please move or remove them before you merge.
Aborting
```

### Resolution
Remove the untracked file so Git can perform a clean fast-forward merge:
```powershell
Remove-Item ecosystem.config.cjs -Force -ErrorAction SilentlyContinue
git pull
```

---

## 7. Standard Operations Quick-Reference Runbook

### Deploy New Code Changes to VPS (Day-to-Day)
```powershell
cd C:\Apps\printflow
git pull
npm run build
pm2 restart printflow
```

### Full Clean Reset (If Server Fails to Start or Hangs)
```powershell
cd C:\Apps\printflow

# 1. Clear PM2
pm2 delete all

# 2. Free port 3000
$ports = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
if ($ports) {
    $ports | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

# 3. Pull latest repository state
git pull

# 4. Build application
npm run build

# 5. Start with PM2 and save configuration
pm2 start ecosystem.config.cjs
pm2 save

# 6. Verify health
pm2 status
pm2 logs printflow --lines 20 --nostream
```

### Quick Diagnostic One-Liners
```powershell
# See who is listening on port 3000
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Format-Table -AutoSize

# Inspect process command line for port 3000
Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess } | Select-Object ProcessId, Name, CommandLine

# View PM2 error logs without live streaming
pm2 logs printflow --lines 30 --nostream

# View PM2 process details (paths, env, uptime)
pm2 describe 0
```
