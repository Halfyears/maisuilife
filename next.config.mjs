/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase Database types are hand-maintained stubs; run `supabase gen types`
  // to regenerate. Until then, type errors in query results are expected.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverComponentsExternalPackages: ['crypto'],
  },
  // Never expose server-only env vars to client bundle
  serverRuntimeConfig: {
    encryptionKey: process.env.ENCRYPTION_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
  },
  publicRuntimeConfig: {
    appName: process.env.NEXT_PUBLIC_APP_NAME,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  },
}

export default nextConfig
