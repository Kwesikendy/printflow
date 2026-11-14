'use client'

import { useState, useEffect } from 'react'
import {
  getBackupOverviewAction,
  triggerBackupAction,
  triggerAutoBackupAction,
  deleteLocalBackupAction,
  deleteDriveBackupAction,
  testDriveConnectionAction,
  type BackupOverviewResponse,
} from '@/app/actions/backup'
import { toast } from 'sonner'
import {
  CloudUpload,
  Download,
  Trash2,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  ExternalLink,
  ShieldCheck,
  Terminal,
  HelpCircle,
  FileCheck2,
  Clock,
  Copy,
} from 'lucide-react'

export default function BackupsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BackupOverviewResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const [testingDrive, setTestingDrive] = useState(false)
  const [runningAuto, setRunningAuto] = useState(false)
  const [includeStorage, setIncludeStorage] = useState(false)
  const [uploadToDrive, setUploadToDrive] = useState(true)

  const handleTriggerAutoBackup = async () => {
    try {
      setRunningAuto(true)
      const res = await triggerAutoBackupAction()
      if (res.success) {
        toast.success(`Automated backup complete: ${res.fileName} (${res.totalRecords} records)`)
      } else {
        toast.error(res.error || 'Automated backup failed')
      }
      await loadData()
    } catch (err: any) {
      toast.error(err.message || 'Error running automated backup')
    } finally {
      setRunningAuto(false)
    }
  }
  const [showSetupGuide, setShowSetupGuide] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getBackupOverviewAction()
      setData(res)
    } catch (err: any) {
      toast.error('Failed to load backup data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateBackup = async () => {
    try {
      setCreating(true)
      const shouldUpload = uploadToDrive && (data?.googleDriveStatus.isConfigured ?? false)
      const res = await triggerBackupAction({
        includeStorage,
        uploadToDrive: shouldUpload,
      })

      if (res.success) {
        toast.success(
          `Backup created successfully! ${res.totalRecords.toLocaleString()} records archived (${(res.sizeBytes / 1024).toFixed(1)} KB)`
        )
        if (res.driveUpload?.webViewLink) {
          toast.success('Successfully uploaded to Google Drive!')
        }
        await loadData()
      } else {
        toast.error(res.error || 'Backup failed')
      }
    } catch (err: any) {
      toast.error('Error creating backup: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteLocal = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete local backup "${fileName}"?`)) return

    try {
      const res = await deleteLocalBackupAction(fileName)
      if (res.success) {
        toast.success('Local backup deleted')
        await loadData()
      } else {
        toast.error(res.error || 'Failed to delete backup')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDeleteDrive = async (fileId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from Google Drive?`)) return

    try {
      const res = await deleteDriveBackupAction(fileId)
      if (res.success) {
        toast.success('Google Drive backup deleted')
        await loadData()
      } else {
        toast.error('Failed to delete Google Drive backup')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleTestDrive = async () => {
    try {
      setTestingDrive(true)
      const res = await testDriveConnectionAction()
      if (res.isConfigured) {
        toast.success(`Google Drive connected! Folder: ${res.folderName || res.folderId}`)
      } else {
        toast.error(res.error || 'Google Drive not configured')
      }
      await loadData()
    } catch (err: any) {
      toast.error('Test failed: ' + err.message)
    } finally {
      setTestingDrive(false)
    }
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return dateStr
    }
  }

  const isDriveConfigured = data?.googleDriveStatus.isConfigured ?? false

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner & Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Local Backups Stat */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Local Snapshots
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {data?.localBackups?.length ?? 0}{' '}
              <span className="text-sm font-normal text-slate-500">archives</span>
            </div>
          </div>
        </div>

        {/* Google Drive Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              isDriveConfigured
                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                : 'bg-amber-50 border-amber-100 text-amber-600'
            }`}
          >
            <CloudUpload className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Google Drive Cloud Sync
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isDriveConfigured ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold text-emerald-700 truncate">
                    Connected ({data?.driveBackups?.length ?? 0} in Drive)
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-sm font-bold text-amber-700">Not Configured</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Safety & RPO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Disaster Recovery
            </div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              Complete Database + Storage
            </div>
            <div className="text-xs text-slate-500">19 Tables + JSON manifests</div>
          </div>
        </div>
      </div>

      {/* Main Action Section: Trigger Backup */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-slate-200">
              <FolderArchive className="w-3.5 h-3.5" />
              Automated Snapshot Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Create New System Backup
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Export all customer orders, invoices, payments, expenditures, HR payroll, and catalog
              records into an encrypted, timestamped ZIP archive.
            </p>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px]">
            {/* Options */}
            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeStorage}
                onChange={(e) => setIncludeStorage(e.target.checked)}
                className="w-4 h-4 rounded-sm border-slate-400 text-indigo-500 focus:ring-indigo-400 bg-white/10"
              />
              <span>Include Artworks & Proofs (Storage)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={uploadToDrive}
                disabled={!isDriveConfigured}
                onChange={(e) => setUploadToDrive(e.target.checked)}
                className="w-4 h-4 rounded-sm border-slate-400 text-indigo-500 focus:ring-indigo-400 bg-white/10 disabled:opacity-50"
              />
              <span className={!isDriveConfigured ? 'opacity-60' : ''}>
                Upload copy to Google Drive {!isDriveConfigured && '(Setup required)'}
              </span>
            </label>

            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="mt-2 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white font-semibold text-sm shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Archive...
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  Run Backup Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Automated Daily Backups Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-lg">Automated Daily Backups</h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active & Scheduled
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Background engine automatically snapshots all 19 database tables every 24 hours (daily shift close at 23:00 UTC) with automatic retention and Google Drive cloud sync.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleTriggerAutoBackup}
              disabled={runningAuto}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningAuto ? 'animate-spin' : ''}`} />
              {runningAuto ? 'Running Auto Backup...' : 'Test Auto Backup Now'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Automatic Schedule</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">
              {data?.autoBackupState?.schedule || 'Daily at 23:00 UTC (End of Shift)'}
            </span>
            <span className="text-[11px] text-slate-500">Every 24 hours automatically</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Last Automatic Backup</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">
              {data?.autoBackupState?.lastRunAt ? formatDate(data.autoBackupState.lastRunAt) : 'Pending tonight'}
            </span>
            <span className="text-[11px] text-slate-500">
              {data?.autoBackupState?.lastTotalRecords
                ? `${data.autoBackupState.lastTotalRecords.toLocaleString()} records captured`
                : 'Next run scheduled at shift close'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Webhook / Cron Endpoint</span>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <span className="font-mono text-[11px] font-semibold text-slate-700 truncate">
                /api/cron/backup
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/cron/backup`)
                  toast.success('Copied cron webhook URL to clipboard!')
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Copy webhook URL"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[11px] text-slate-500">Triggers on demand or external scheduler</span>
          </div>
        </div>
      </div>

      {/* Google Drive Status & Setup Accordion */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isDriveConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Google Drive Cloud Storage</h3>
              <p className="text-xs text-slate-500">
                {isDriveConfigured
                  ? `Active folder: ${data?.googleDriveStatus.folderName || data?.googleDriveStatus.folderId}`
                  : 'Automate off-site cloud storage by connecting a Google Service Account'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestDrive}
              disabled={testingDrive}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingDrive ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {showSetupGuide ? 'Hide Instructions' : 'Setup Instructions'}
            </button>
          </div>
        </div>

        {showSetupGuide && (
          <div className="p-6 bg-slate-50/80 text-sm space-y-4 border-b border-slate-100">
            <div className="font-semibold text-slate-800 text-sm">
              How to Connect Google Drive (4 Simple Steps):
            </div>
            <ol className="list-decimal list-inside space-y-2 text-slate-600 text-xs sm:text-sm leading-relaxed">
              <li>
                <strong>Create a Google Cloud Project & Enable Drive API:</strong> Go to the{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline inline-flex items-center gap-1"
                >
                  Google Cloud Console <ExternalLink className="w-3 h-3" />
                </a>
                , create a project, and enable the <strong>Google Drive API</strong>.
              </li>
              <li>
                <strong>Create a Service Account:</strong> Go to <em>APIs & Services &gt; Credentials</em>,
                click <em>Create Credentials &gt; Service Account</em>, and create a key in JSON format.
              </li>
              <li>
                <strong>Create & Share a Google Drive Folder:</strong> Open your Google Drive, create a
                folder (e.g. <code>PrintFlow Backups</code>), and click <strong>Share</strong>. Add your
                Service Account email (found in the JSON) as an <strong>Editor</strong>.
              </li>
              <li>
                <strong>Configure PrintFlow:</strong> Either place the downloaded JSON file in the project
                root as <code>google-service-account.json</code> and set <code>GOOGLE_DRIVE_FOLDER_ID</code>,
                OR add these three variables into <code>.env.local</code>:
                <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto font-mono">
{`GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id`}
                </pre>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Local Backups Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Local Backup Snapshots</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
              {data?.localBackups?.length ?? 0}
            </span>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {data?.localBackups && data.localBackups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Archive Name</th>
                  <th className="py-3 px-5">Created At</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">File Size</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.localBackups.map((item) => (
                  <tr key={item.fileName} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                      {item.fileName}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-500">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          item.hasStorage
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {item.hasStorage ? 'Full (DB + Storage)' : 'Database Tables'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-700">
                      {formatBytes(item.sizeBytes)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={`/api/admin/backups/download?fileName=${encodeURIComponent(
                            item.fileName
                          )}`}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                          title="Download ZIP archive to your computer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                        <button
                          onClick={() => handleDeleteLocal(item.fileName)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete local archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">
            No local backups found. Click &quot;Run Backup Now&quot; to generate your first backup.
          </div>
        )}
      </div>

      {/* Google Drive Backups Table (if configured) */}
      {isDriveConfigured && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <CloudUpload className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Google Drive Remote Backups</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                {data?.driveBackups?.length ?? 0}
              </span>
            </div>
          </div>

          {data?.driveBackups && data.driveBackups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-5">File Name</th>
                    <th className="py-3 px-5">Uploaded At</th>
                    <th className="py-3 px-5">File Size</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.driveBackups.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-slate-500">
                        {formatDate(item.createdTime)}
                      </td>
                      <td className="py-3.5 px-5 text-xs font-semibold text-slate-700">
                        {formatBytes(item.sizeBytes)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {item.webViewLink && (
                            <a
                              href={item.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View in Drive
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteDrive(item.id, item.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Delete from Google Drive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              No backups uploaded to Google Drive yet.
            </div>
          )}
        </div>
      )}

      {/* Automated Daily Scheduling Guide */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-6 space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Terminal className="w-4 h-4 text-indigo-600" />
          Automated Daily Scheduling (Shift Boundary at 5:00 PM)
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          In addition to the one-click button above, you can schedule automatic backups every evening
          on the server or VPS (via Windows Task Scheduler or Linux crontab) using the built-in CLI:
        </p>
        <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs flex items-center justify-between">
          <span>npm run backup</span>
          <span className="text-slate-400 text-[10px]">Executes scripts/run-backup.mjs</span>
        </div>
      </div>
    </div>
  )
}
