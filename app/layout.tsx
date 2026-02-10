import '../styles/globals.css';
import { Inter } from 'next/font/google';
import { clsx } from 'clsx';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'iTEKAD Entrepreneur Management',
    description: 'Manage iTEKAD entrepreneurs and sessions',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={clsx(inter.className, 'bg-slate-50 min-h-screen text-slate-900')}>
                {children}
            </body>
        </html>
    );
}
