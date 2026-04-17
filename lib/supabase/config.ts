function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} no esta configurada.`);
  }

  return value;
}

export function getSupabaseUrl() {
  return requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
      process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL?.trim(),
  );
}

export function getSupabasePublishableKey() {
  return requireEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
      process.env.NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY?.trim(),
  );
}

export function getSupabaseServiceRoleKey() {
  return requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
      process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY?.trim(),
  );
}

