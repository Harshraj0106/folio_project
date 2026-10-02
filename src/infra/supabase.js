import { createClient } from '@supabase/supabase-js';

// The server never keeps a Supabase session of its own. Every client is
// throwaway and acts either anonymously or with one user's access token,
// so row level security always applies.
const STATELESS = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export function anonymousClientFactory({ url, anonKey }) {
  return () => createClient(url, anonKey, { auth: STATELESS });
}

export function userClientFactory({ url, anonKey }) {
  return (accessToken) =>
    createClient(url, anonKey, {
      auth: STATELESS,
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}
