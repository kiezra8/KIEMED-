import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gabapoeejwqueautmkew.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYmFwb2VlandxdWVhdXRta2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTExNTAsImV4cCI6MjEwNDA2NzE1MH0.uOG2IJDEukQ2MhLuwjTt0rl0lgEm9ziEGEiACMEsTqQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
})
