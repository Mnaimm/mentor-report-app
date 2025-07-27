// pages/index.js
import Link from 'next/link';

// Icon components for the cards
const FormIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const ChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-white"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>;

const NavCard = ({ href, icon, title, description }) => (
    <Link href={href} legacyBehavior>
        <a className="block p-8 bg-white rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-600 mb-6">
                {icon}
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
            <p className="mt-2 text-gray-600">{description}</p>
        </a>
    </Link>
);


export default function HomePage() {
  return (
    <div className="container mx-auto p-4 sm:p-8">
        <div className="max-w-4xl mx-auto text-center py-12 sm:py-20">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight">
                Selamat Datang ke Portal Mentor
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
                Sila pilih borang yang ingin anda isi atau kemaskini. Terima kasih atas sumbangan anda.
            </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <NavCard 
                href="/sesi-report"
                icon={<FormIcon />}
                title="Laporan Sesi iTEKAD"
                description="Isi laporan sesi berterusan untuk usahawan anda di sini."
            />
            <NavCard 
                href="/upward-mobility"
                icon={<ChartIcon />}
                title="Borang Upward Mobility"
                description="Lengkapkan borang khas Upward Mobility untuk Sesi 2 dan Sesi 4."
            />
        </div>
    </div>
  );
}
