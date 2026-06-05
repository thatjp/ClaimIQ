import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        // Demo: accept any non-empty email/password combination
        if (credentials?.email && credentials?.password) {
          return {
            id: '1',
            email: credentials.email as string,
            name: 'Demo Adjuster',
          }
        }
        return null
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}

// Export a helper that wraps getServerSession for use in route handlers and server components
export { authOptions as default }
