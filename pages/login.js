import React, { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { callbackUrl } = router.query;

    // If already authenticated, redirect to callbackUrl or home
    useEffect(() => {
        if (status === 'authenticated') {
            router.replace(callbackUrl || '/');
        }
    }, [status, callbackUrl, router]);

    if (status === 'loading') {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <Head>
                <title>Login - Portal Mentor iTEKAD</title>
            </Head>

            <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center">
                <div className="mb-6 flex justify-center">
                    <img src="/logo1.png" alt="Logo" className="h-16" />
                </div>

                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    Portal Mentor iTEKAD
                </h1>
                <p className="text-gray-600 mb-8">
                    Sila log masuk untuk mengakses sistem laporan.
                </p>

                <button
                    onClick={() => signIn("google", { callbackUrl: callbackUrl || '/' })}
                    className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Log Masuk dengan Google
                </button>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
                &copy; {new Date().getFullYear()} Portal Mentor iTEKAD
            </div>
        </div>
    );
}
