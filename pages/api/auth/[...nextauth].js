import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export default NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            const allowedDomains = ['mohsyn.com', 'humantek.com'];
            const emailDomain = user.email.split('@')[1];

            if (allowedDomains.includes(emailDomain)) {
                return true;
            } else {
                // Return false to deny access
                return false;
            }
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: 'jwt',
    },
    cookies: {
        sessionToken: {
            name: `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                // BY OMITTING maxAge here, it becomes a SESSION COOKIE (expires on browser close)
            },
        },
    },
    pages: {
        signIn: '/',
        error: '/',
    }
});
