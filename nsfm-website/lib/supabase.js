const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const isConfigured = Boolean(url && publishableKey);

const supabase = isConfigured
  ? createClient(url, publishableKey, { auth: { persistSession: false } })
  : null;

module.exports = { supabase, isConfigured };
