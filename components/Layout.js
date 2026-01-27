// components/Layout.js
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <Navbar />
      <main>
        {children}
      </main>
    </div>
  );
}
