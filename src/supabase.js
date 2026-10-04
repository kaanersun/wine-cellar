import { createClient } from '@supabase/supabase-js';

// The anon key is meant to be public: Row Level Security on the tables is what
// keeps each user's data private. Env vars override these for other projects.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jvvbhgihqtpmydlbbqkc.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dmJoZ2locXRwbXlkbGJicWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMzI3OTYsImV4cCI6MjEwNjcwODc5Nn0.FbbIIsdNM9VZQetil1FUy2A0-C2qjSaLIrGiiY_3b9Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
