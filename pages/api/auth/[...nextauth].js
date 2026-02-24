import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS for authentication checks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      // Allow only if user exists in mentors table or user_roles table
      const { email } = user;

      try {
        // Check if user exists in mentors table
        const { data: mentor, error: mentorError } = await supabaseAdmin
          .from('mentors')
          .select('email')
          .eq('email', email)
          .single();

        if (mentor) {
          console.log(`✅ Login allowed for ${email} (found in mentors table)`);
          return true;
        }

        // Check if user exists in user_roles table (admins, etc)
        // We limit to 1 because we just need to know if they have ANY role
        const { data: roles, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .select('email')
          .eq('email', email)
          .limit(1);

        if (rolesError) {
          console.error(`❌ Error checking user_roles for ${email}:`, rolesError);
          return false;
        }

        if (roles && roles.length > 0) {
          console.log(`✅ Login allowed for ${email} (found in user_roles table)`);
          return true;
        }

        console.log(`❌ Login denied for ${email}: User not found in mentors or user_roles.`);
        return false;
      } catch (error) {
        console.error('❌ SignIn callback error:', error);
        return false;
      }
    },
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token, user }) {
      // Send properties to the client, like an access_token from a provider.
      session.accessToken = token.accessToken;
      return session;
    },
  },
};

export default NextAuth(authOptions);
