const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runCleanup() {
  console.log('=== STARTING ARTWORK STORAGE CLEANUP ===\n');

  // 1. Fetch all jobs
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('id, job_number, status, artwork_url');

  if (jobsErr) {
    console.error('Error fetching jobs:', jobsErr);
    return;
  }

  const cleanableStatuses = new Set(['picked_up', 'completed', 'cancelled']);
  const fileToJob = new Map();
  const jobsToUpdate = [];

  for (const j of jobs) {
    if (j.artwork_url) {
      const match = j.artwork_url.match(/00000000-0000-0000-0000-000000000001\/([^?]+)/);
      if (match) {
        const filename = match[1];
        fileToJob.set(filename, j);
        if (cleanableStatuses.has(j.status)) {
          jobsToUpdate.push(j.id);
        }
      }
    }
  }

  // 2. Fetch all files from storage bucket
  let allFiles = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const { data, error } = await supabase.storage
      .from('artworks')
      .list('00000000-0000-0000-0000-000000000001', { limit, offset });
    if (error) {
      console.error('Error listing files:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allFiles = allFiles.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }

  console.log(`Found ${allFiles.length} total files in artworks storage bucket.`);

  // 3. Identify files to delete
  const pathsToDelete = [];
  let bytesToFree = 0;
  let activeRetained = 0;
  let activeBytes = 0;

  for (const file of allFiles) {
    const job = fileToJob.get(file.name);
    const size = file.metadata?.size || 0;
    const fullPath = `00000000-0000-0000-0000-000000000001/${file.name}`;

    if (!job) {
      // Orphan file (never linked to a job or abandoned draft upload)
      pathsToDelete.push(fullPath);
      bytesToFree += size;
    } else if (cleanableStatuses.has(job.status)) {
      // Job is completed, picked up, or cancelled
      pathsToDelete.push(fullPath);
      bytesToFree += size;
    } else {
      // Job is ACTIVE (awaiting_payment, paid_released, printing, etc.) - KEEP!
      activeRetained++;
      activeBytes += size;
    }
  }

  console.log(`Active artwork files to PRESERVE: ${activeRetained} files (${(activeBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Cleanable files to DELETE: ${pathsToDelete.length} files (${(bytesToFree / 1024 / 1024).toFixed(2)} MB / ${(bytesToFree / 1024 / 1024 / 1024).toFixed(2)} GB)\n`);

  if (pathsToDelete.length === 0) {
    console.log('No cleanable files found. Bucket is already clean!');
    return;
  }

  // 4. Delete in chunks of 50
  console.log(`Deleting ${pathsToDelete.length} files in batches of 50...`);
  const chunkSize = 50;
  let deletedCount = 0;

  for (let i = 0; i < pathsToDelete.length; i += chunkSize) {
    const chunk = pathsToDelete.slice(i, i + chunkSize);
    const { data, error } = await supabase.storage.from('artworks').remove(chunk);
    if (error) {
      console.error(`Batch ${i / chunkSize + 1} error:`, error.message);
    } else {
      deletedCount += (data ? data.length : chunk.length);
      process.stdout.write(`Deleted ${deletedCount} / ${pathsToDelete.length} files...\r`);
    }
  }

  console.log(`\nSuccessfully removed ${deletedCount} files from Supabase Storage!`);

  // 5. Update jobs table: set artwork_url = null for completed/picked_up/cancelled jobs
  console.log(`Updating ${jobsToUpdate.length} completed/cancelled jobs in database to clear artwork_url...`);
  const updateChunkSize = 50;
  for (let i = 0; i < jobsToUpdate.length; i += updateChunkSize) {
    const chunkIds = jobsToUpdate.slice(i, i + updateChunkSize);
    await supabase.from('jobs').update({ artwork_url: null }).in('id', chunkIds);
  }

  console.log('Database jobs updated successfully.');
  console.log('\n=== CLEANUP COMPLETE ===');
  console.log(`Total space freed: ${(bytesToFree / 1024 / 1024).toFixed(2)} MB (${(bytesToFree / 1024 / 1024 / 1024).toFixed(2)} GB)`);
  console.log(`Active files remaining: ${activeRetained} files (${(activeBytes / 1024 / 1024).toFixed(2)} MB)`);
}

runCleanup();
