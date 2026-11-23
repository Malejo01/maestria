import { registrarOrigen } from '@/lib/origen-server'
import NextAuth, { type DefaultSession } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { DEV_LOGIN_PROVIDER_ID, devLoginConfigurado, usuarioDeDesarrollo } from '@/lib/dev-login'
import { sql } from '@/lib/db'

// ─── NextAuth type augmentation ───────────────────────────────────────────────
// Extends the built-in Session and JWT types with our custom fields.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'ALUMNO' | 'DOCENTE' | null
      isOnboarded: boolean
      nivel: string | null
      grado: string | null
    } & DefaultSession['user']
  }
}

// In NextAuth v5 (Auth.js), JWT type augmentation lives in @auth/core/jwt
declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    role: 'ALUMNO' | 'DOCENTE' | null
    isOnboarded: boolean
    nivel: string | null
    grado: string | null
  }
}

// ─── NextAuth configuration ───────────────────────────────────────────────────
export const { handlers, signIn, signOut, auth } = NextAuth({
  // AUTH_SECRET is the canonical name in NextAuth v5.
  // Also accepts NEXTAUTH_SECRET for backward compatibility.
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'maestria-fallback-secret-key-2026',
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Ingreso de desarrollo: sólo en `next dev`, con DEV_LOGIN=1 y contra una
    // base marcada como staging. En un build de producción este proveedor no
    // existe. Los tres candados están explicados en lib/dev-login.ts.
    ...(devLoginConfigurado()
      ? [
          Credentials({
            id: DEV_LOGIN_PROVIDER_ID,
            name: 'Ingreso de desarrollo',
            credentials: { userId: {} },
            async authorize(credentials) {
              const usuario = await usuarioDeDesarrollo(credentials?.userId)
              if (!usuario) return null
              return { id: usuario.id, email: usuario.email, name: usuario.name }
            },
          }),
        ]
      : []),
  ],

  // JWT strategy: no DB hit on every request. Role is cached in the token.
  // Call update() from useSession() after onboarding to refresh the token.
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/sign-in',
  },

  callbacks: {
    /**
     * signIn: Fired once per login. Upserts the user and account link in our DB.
     * The user.id provided by NextAuth for Google without a DB adapter is not
     * the Google sub — we use account.providerAccountId as the stable user ID.
     */
    async signIn({ user, account }) {
      if (!account || !user.email) return false

      const userId = account.providerAccountId

      try {
        // One-time migration guard: if an old row exists with this email but
        // a different ID (e.g. a Clerk ID from before), delete it so the upsert
        // below can proceed. The DELETE cascades to quiz_attempts, mastery, etc.
        await sql`
          DELETE FROM users
          WHERE email = ${user.email} AND id != ${userId}
        `

        // Upsert user — first login creates the row; subsequent logins update
        // mutable fields (name, image) but never overwrite role or is_onboarded.
        const [fila] = (await sql`
          INSERT INTO users (id, email, name, image, created_at, updated_at)
          VALUES (
            ${userId},
            ${user.email},
            ${user.name ?? null},
            ${user.image ?? null},
            NOW(),
            NOW()
          )
          ON CONFLICT (id) DO UPDATE
          SET
            email      = EXCLUDED.email,
            name       = EXCLUDED.name,
            image      = EXCLUDED.image,
            updated_at = NOW()
          RETURNING (xmax = 0) AS nuevo
        `) as { nuevo?: boolean }[]

        // V1: si se acaba de registrar, el canal del link de su primera visita.
        if (fila?.nuevo) await registrarOrigen(userId)

        // Upsert OAuth account link (needed for provider tracking)
        await sql`
          INSERT INTO accounts (
            user_id, type, provider, provider_account_id,
            access_token, expires_at, id_token, scope, token_type
          )
          VALUES (
            ${userId},
            ${account.type},
            ${account.provider},
            ${account.providerAccountId},
            ${account.access_token   ?? null},
            ${account.expires_at     ?? null},
            ${account.id_token       ?? null},
            ${account.scope          ?? null},
            ${account.token_type     ?? null}
          )
          ON CONFLICT (provider, provider_account_id) DO UPDATE
          SET
            access_token = EXCLUDED.access_token,
            expires_at   = EXCLUDED.expires_at,
            id_token     = EXCLUDED.id_token
        `
      } catch (err) {
        console.error('[auth] signIn DB error:', err)
        return false
      }

      return true
    },

    /**
     * jwt: Builds/refreshes the JWT token.
     * - On initial sign-in (account is present): loads role + isOnboarded from DB.
     * - On explicit session update (trigger === 'update'): re-fetches from DB.
     *   Call useSession().update() on the client after role assignment.
     * - On every other request: uses the cached values in the token (no DB hit).
     */
    async jwt({ token, account, trigger }) {
      if (account) {
        // Initial sign-in: set the stable user ID and load profile
        token.id = account.providerAccountId
        const rows = await sql`
          SELECT role, is_onboarded, nivel, grado
          FROM users
          WHERE id = ${token.id}
          LIMIT 1
        `
        token.role = (rows[0]?.role ?? null) as 'ALUMNO' | 'DOCENTE' | null
        token.isOnboarded = rows[0]?.is_onboarded ?? false
        token.nivel = rows[0]?.nivel ?? null
        token.grado = rows[0]?.grado ?? null
      }

      if (trigger === 'update' && token.id) {
        // Client called update() — re-read role from DB (e.g., after onboarding)
        const rows = await sql`
          SELECT role, is_onboarded, nivel, grado
          FROM users
          WHERE id = ${token.id}
          LIMIT 1
        `
        token.role = (rows[0]?.role ?? null) as 'ALUMNO' | 'DOCENTE' | null
        token.isOnboarded = rows[0]?.is_onboarded ?? false
        token.nivel = rows[0]?.nivel ?? null
        token.grado = rows[0]?.grado ?? null
      }

      return token
    },

    /**
     * session: Maps JWT claims onto the session object exposed to the client.
     */
    async session({ session, token }) {
      session.user.id          = token.id as string
      session.user.role        = token.role as 'ALUMNO' | 'DOCENTE' | null
      session.user.isOnboarded = token.isOnboarded as boolean
      session.user.nivel       = token.nivel as string | null
      session.user.grado       = token.grado as string | null
      return session
    },
  },
})
