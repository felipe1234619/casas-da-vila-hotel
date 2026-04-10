const SUPABASE_URL = "  https://wrtlgzbjxxerihuwgwrv.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_OEmkC3OvQY00TfL4rN2HyA_v2ImAzQ_";

if (!window.supabase) {
  console.warn("Supabase SDK não carregado.");
} else {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("Supabase conectado com sucesso.");
}