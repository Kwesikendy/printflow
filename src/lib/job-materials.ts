/**
 * Returns the ids of jobs that already have a material deduction recorded in inventory_logs.
 * Used so the print room is only asked to pick a material once per job.
 */
export async function getDeductedJobIds(serviceSupabase: any, jobIds: string[]): Promise<string[]> {
  if (jobIds.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < jobIds.length; i += 50) chunks.push(jobIds.slice(i, i + 50))

  const results = await Promise.all(
    chunks.map(chunk =>
      serviceSupabase
        .from('inventory_logs')
        .select('job_id')
        .eq('action', 'job_deduction')
        .in('job_id', chunk)
    )
  )

  const ids = new Set<string>()
  results.forEach((res: any) => (res.data || []).forEach((row: any) => row.job_id && ids.add(row.job_id)))
  return Array.from(ids)
}
