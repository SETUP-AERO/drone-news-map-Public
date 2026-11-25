// Public settings for the browser. The anon key is meant to be public: Supabase
// row-level security (supabase/schema.sql) decides what each visitor can read.
// Never put the service_role key here.
window.DNM_CONFIG = {
  supabaseUrl: "",      // e.g. "https://abcd1234.supabase.co"
  supabaseAnonKey: "",  // Project Settings > API > anon public key
  googleLogin: false    // set true after enabling Google in Supabase Auth > Providers
};
