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
7. [VPS Issue: Corrupted `.next` Cache (CSS/JS 404 Errors)](#7-vps-issue-corrupted-next-cache-cssjs-404-errors)
8. [VPS Issue: 35MB File Upload Failure ("Something went wrong")](#8-vps-issue-35mb-file-upload-failure-something-went-wrong)
9. [Database Issue: Duplicate Key Violation on Job Number (`jobs_tenant_id_job_number_key`)](#9-database-issue-duplicate-key-violation-on-job-number-jobs_tenant_id_job_number_key)
10. [Frontend Issue: Customer Autocomplete & Autofill Not Triggering](#10-frontend-issue-customer-autocomplete--autofill-not-triggering)
11. [Windows VPS: Safe PM2 Restart Procedure (`listen EACCES: permission denied`)](#11-windows-vps-safe-pm2-restart-procedure-listen-eacces-permission-denied)
12. [Standard Operations Quick-Reference Runbook](#12-standard-operations-quick-reference-runbook)

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

## 4. VPS Issue: Port Collision (`EADDRINUSE` or `EACCES: permission denied 0.0.0.0:3000`)

### Symptom
When starting Next.js or inspecting PM2 logs:
```text
Error: listen EACCES: permission denied 0.0.0.0:3000
  code: 'EACCES',
  errno: -4092,
  syscall: 'listen',
  address: '0.0.0.0',
  port: 3000
```
or
```text
Error: listen EADDRINUSE: address already in use :::3000
```

### Root Causes
1. **Orphan Process with Exclusive Socket Access**: On Windows, when an existing process holds port 3000 with `SO_EXCLUSIVEADDRUSE`, any subsequent bind attempt fails with `WSAEACCES` (10013) which translates to `EACCES: permission denied`, NOT `EADDRINUSE`.
2. **PM2 `cluster` Mode**: In `cluster` mode (`instances: 'max'`), multiple Next.js workers attempt to bind directly to the same port.

### Resolution
1. **Identify and kill the process holding port 3000**:
   ```powershell
   # Find the holding PID
   netstat -ano | findstr :3000

   # Force terminate the holding PID (e.g., PID 9052)
   taskkill /F /PID <PID>

   # Alternatively, terminate all processes on port 3000
   $ports = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
   if ($ports) { $ports | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }
   ```
2. **Ensure `ecosystem.config.cjs` uses `fork` mode and absolute paths**:
   ```javascript
   const path = require('path');
   module.exports = {
     apps: [
       {
         name: "printflow",
         script: path.resolve(__dirname, "server.js"),
         cwd: __dirname,
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

---

## 5. VPS Issue: Extensionless Next Binary on Windows

### Symptom
PM2 crashes when pointing `script` to `./node_modules/next/dist/bin/next`.

### Root Cause
On Linux, `./node_modules/next/dist/bin/next` has a shebang `#!/usr/bin/env node` which the OS kernel executes via Node.
On **Windows**, there is no native shebang handler, and files without extensions cannot be spawned as native executables by PM2 fork mode.

### Resolution
We created `server.js` in the project root using Next's programmatic start runner (in-process, eliminating child process orphans and Windows `.cmd` quirks):
```javascript
const { nextStart } = require('next/dist/cli/next-start');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

process.title = 'printflow';

nextStart({ port, hostname }, __dirname).catch((err) => {
  console.error('Fatal Next.js startup error:', err);
  process.exit(1);
});
```
And configured PM2 to launch `server.js`, which Node executes natively in-process.

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

## 7. VPS Issue: Corrupted `.next` Cache (CSS/JS 404 Errors)

### Symptom
After a successful build and PM2 restart, the browser loads the site but it looks completely unstyled (Times New Roman font) and the browser console shows 404 errors for `/_next/static/chunks/...css`.

### Root Cause
If a previous `npm run build` failed halfway through or was interrupted, Next.js leaves a corrupted, partially updated `.next` directory. When PM2 starts, the server generates HTML pointing to new CSS chunks that were never correctly finalized, or the browser is stuck in a version skew requesting old chunks.

### Resolution
1. Do a **Hard Refresh** in the browser (Ctrl+F5 or Cmd+Shift+R).
2. If that fails, the `.next` directory on the server is corrupted and must be nuked from orbit:
   ```powershell
   pm2 delete all
   taskkill /F /IM node.exe /T
   Remove-Item .next -Recurse -Force
   npm run build
   pm2 start ecosystem.config.cjs
   ```

---

## 8. VPS Issue: 35MB File Upload Failure ("Something went wrong")

### Symptom
When users try to upload files around 30MB or larger (e.g. a 35MB artwork file), the upload instantly fails and the Next.js React Error Boundary catches an unhandled error ("Something went wrong"). However, 1MB files upload perfectly fine.

### Root Cause
This is **not** a Next.js `bodySizeLimit` issue, and it is **not** an OOM issue. 
The Windows VPS is physically sitting behind an InterServer network-edge reverse proxy (Caddy). This proxy has a hard limit on `request_body` size (likely around 10-20MB). When a large payload hits this network edge, Caddy instantly drops the TCP connection. Next.js receives a malformed/dropped connection, crashes the Server Action parser, and triggers the Error Boundary.

### Resolution
The Next.js app itself is configured to allow `400MB` in `next.config.ts`. To fix the network layer, you must:
1. **Contact InterServer Support** and request that they increase the `request_body` limit on the proxy for your server IP/domain to `400MB`.
2. **Temporary Bypass (Cloudflare):** Moving your DNS to Cloudflare and enabling Proxy (Orange Cloud) temporarily bypasses this by routing through Cloudflare's edge. However, Cloudflare's free tier has a strict **100MB** limit. 
3. **Important Note:** Once InterServer grants the 400MB limit, you **MUST** either disable Cloudflare Proxy (turn to Grey Cloud "DNS Only") or revert your nameservers back to `cdns1.interserver.net`, otherwise Cloudflare's 100MB limit will block your 400MB files.

---

## 9. Database Issue: Duplicate Key Violation on Job Number (`jobs_tenant_id_job_number_key`)

### Symptom
When attempting to create a job or order on the New Job page (`/dashboard/jobs/new`), submission fails with an error toast:
```text
duplicate key value violates unique constraint "jobs_tenant_id_job_number_key"
Key (tenant_id, job_number)=(..., PF-00001) already exists.
```

### Root Cause
1. **Sequence Counter Reset**: In legacy versions, job numbers followed a flat sequential format (`PF-00001`, `PF-00002`). At the daily 5:00 PM shift boundary or when clicking "Start New Day", the database sequence counter (`job_sequences.last_job`) was reset to `0`.
2. **Collision with Past Records**: The next order called PostgreSQL RPC `get_next_job_number`, generating `PF-00001`. Because `PF-00001` was already committed to the database on a prior workday, PostgreSQL threw a unique constraint violation on `(tenant_id, job_number)`.
3. **Network Inaccessibility for Direct SQL Migrations**: Running database fix scripts via `node apply-sql.js` failed on the VPS with `ENOTFOUND db.zrnnrnnzywqnvdmnpbws.supabase.co` because Supabase deprecated direct IPv4 connections to the pooler, while the VPS network interface lacked direct IPv6 routing.

### Resolution
1. **Date-Prefixed Key Numbering**:
   Job and invoice numbers now incorporate the calendar date (`YYMMDD`):
   - **Job Numbers**: `PF-YYMMDD-001`, `PF-YYMMDD-002`, `PF-YYMMDD-003` (e.g. `PF-261007-001` today, `PF-261008-001` tomorrow).
   - **Invoice Numbers**: `INV-YYMMDD-001`, `INV-YYMMDD-002`.
   - Each calendar date has its own independent namespace, making cross-day collisions mathematically impossible.
2. **Decoupled from Database RPCs**:
   Job group creation, job line-item insertion, and invoice generation were migrated out of the PostgreSQL RPC and implemented directly in the Next.js Server Action (`createJobGroupAction` in `src/app/actions/jobs.ts`) using `createServiceClient()` over HTTPS. This works 100% reliably regardless of server IPv6 network status.
3. **Collision Resistance & Concurrency Safe**:
   The server queries the highest numeric suffix matching today's prefix (`PF-YYMMDD-%`) and increments from there. An automatic retry loop handles simultaneous submissions gracefully.

---

## 10. Frontend Issue: Customer Autocomplete & Autofill Not Triggering

### Symptom
When creating a job on `/dashboard/jobs/new`, typing into the **Customer Name** field did not display matching customer suggestions from the database, or failed to autofill the name and phone number.

### Root Cause
1. **High Character Threshold**: `CustomerAutocomplete` had `value.length < 2`, blocking searches on 1-character input.
2. **Phone Number Omission**: The search action only queried `ilike('name', ...)`. Searching by phone prefix (e.g. `024...`) returned 0 results.
3. **Missing Address Book Records**: Customers from historical jobs and job groups were never synced into the dedicated `customers` directory table.
4. **Dropdown Loop Bug**: Selecting a customer updated `customerName`, which re-triggered the `useEffect` and popped the dropdown back open 300ms later.

### Resolution
1. **Backfilled Customers Directory**: Synced all historical unique customers from `jobs` and `job_groups` directly into the `customers` directory table with their phone numbers.
2. **Dual Name & Phone Search**: In `src/app/actions/customers.ts`, `searchCustomers` searches across both `name` AND `phone` columns using `or('name.ilike.%q%,phone.ilike.%q%')`.
3. **Instant Search**: Lowered debounce to 150ms and enabled search on single-character inputs (`value.trim().length >= 1`).
4. **Clean Selection & Autofill**: Added `justSelectedRef` to cleanly close the dropdown upon selection. Clicking any customer immediately autofills both **Customer Name** and **Phone Number**.
5. **UI Enhancements**: Added scrollable dropdown (`max-h-64 overflow-y-auto`), customer initials avatar badges, and inline loading spinner.

---

## 11. Windows VPS: Safe PM2 Restart Procedure (`listen EACCES: permission denied`)

### Symptom
Running `pm2 restart printflow` after a build causes the application to rapidly crash (`↺ 2 stopped` or `↺ 30 stopped`). Checking `pm2 logs printflow --lines 20 --nostream` reveals:
```text
Error: listen EACCES: permission denied 0.0.0.0:3000
    at <unknown> (Error: listen EACCES: permission denied 0.0.0.0:3000) {
  code: 'EACCES',
  errno: -4092,
  syscall: 'listen',
  address: '0.0.0.0',
  port: 3000
}
```

### Root Cause
On Windows Server, when PM2 receives a restart command, it spawns a replacement process immediately before the old Node.js process has released its TCP socket. Windows holds network sockets in `TIME_WAIT` / `CLOSE_WAIT` for 1–2 seconds after process termination. Because Windows does not support port sharing without specific flags, the new process encounters `WSAEACCES` (10013 / `EACCES: permission denied`), fails to start, and PM2 exhausts its restart limit.

### Resolution
**Never use bare `pm2 restart printflow` on Windows Server.**
Always use the safe one-line command that forcefully stops any lingering Node process and launches PM2 cleanly:
```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue; pm2 start ecosystem.config.cjs
pm2 status
```

---

## 12. Standard Operations Quick-Reference Runbook

### Deploy New Code Changes to VPS (Day-to-Day)
*Always use this sequence to prevent phantom daemons, port locks, and cache corruption:*
```powershell
cd C:\Apps\printflow
git pull origin main
npm run build
Stop-Process -Name node -Force -ErrorAction SilentlyContinue; pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

### Safe Server Restart (Without Rebuilding)
```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue; pm2 start ecosystem.config.cjs
pm2 status
```

### The Ultimate "Nuke From Orbit" Reset (If Server Fails to Start or Hangs)
If PM2 crashes or port 3000 is locked:

```powershell
cd C:\Apps\printflow

# 1. Clear current PM2 memory
pm2 delete all

# 2. Assassinate all phantom PM2 Daemons and Zombie Node processes
taskkill /F /IM node.exe /T

# 3. (Optional) Reset Windows NAT Driver if Port 3000 is still ghost-locked by Hyper-V
net stop winnat
net start winnat

# 4. Pull latest repository state
git pull origin main

# 5. Obliterate corrupted build cache
Remove-Item .next -Recurse -Force

# 6. Build fresh application
npm run build

# 7. Start cleanly with PM2 and save configuration
pm2 start ecosystem.config.cjs
pm2 save

# 8. Verify health (Should say ↺ 0 and >0% CPU)
pm2 status
```

### Quick Diagnostic One-Liners
```powershell
# See who is listening on port 3000
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Format-Table -AutoSize

# Inspect process command line for port 3000
Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess } | Select-Object ProcessId, Name, CommandLine

# View PM2 error logs without live streaming
pm2 logs printflow --lines 30 --nostream
```
