const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_PDF_BUCKET || 'digital-products';
const objectPath = process.env.SUPABASE_PDF_PATH || 'The_Nervous_System_Field_Manual.pdf';

const isConfigured = Boolean(url && serviceRoleKey);

// Service-role client — bypasses RLS to read the private bucket. Server-side only.
const client = isConfigured
  ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  : null;

// Returns the PDF as a Buffer. Throws if not configured or the object is missing,
// so the caller can refuse before consuming a download use.
async function fetchPdfBuffer() {
  if (!client) {
    throw new Error('Supabase storage is not configured — cannot stream PDF.');
  }
  const { data, error } = await client.storage.from(bucket).download(objectPath);
  if (error) throw error;
  if (!data) throw new Error(`PDF object not found: ${bucket}/${objectPath}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { fetchPdfBuffer, isConfigured, bucket, objectPath };
