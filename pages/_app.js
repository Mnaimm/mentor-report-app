// pages/_app.js
import '../styles/globals.css';
import Head from 'next/head';
import { SessionProvider, useSession } from 'next-auth/react';
import Layout from '../components/Layout';

import { useEffect, useState } from 'react';
import LogRocket from 'logrocket';

// Component to initialize and track LogRocket
const LogRocketWatcher = () => {
  const { data: session } = useSession();
  const [logRocketInitialized, setLogRocketInitialized] = useState(false);

  // Initialize LogRocket once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_LOGROCKET_APP_ID && !logRocketInitialized) {
      try {
        console.log('🚀 Initializing LogRocket with App ID:', process.env.NEXT_PUBLIC_LOGROCKET_APP_ID);
        LogRocket.init(process.env.NEXT_PUBLIC_LOGROCKET_APP_ID, {
          network: {
            requestSanitizer: request => {
              // Sanitize sensitive data if needed
              return request;
            }
          }
        });
        setLogRocketInitialized(true);
        console.log('✅ LogRocket initialized successfully');
      } catch (error) {
        console.error('❌ LogRocket initialization failed:', error);
      }
    }
  }, [logRocketInitialized]);

  // Identify user when session is available
  useEffect(() => {
    if (logRocketInitialized && session?.user) {
      try {
        LogRocket.identify(session.user.email, {
          name: session.user.name,
          email: session.user.email,
          description: 'Mentor',
        });
        console.log('👤 LogRocket user identified:', session.user.email);
      } catch (error) {
        console.error('❌ LogRocket identify failed:', error);
      }
    }
  }, [logRocketInitialized, session]);

  return null;
};

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <LogRocketWatcher />
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SessionProvider>
  );
}

export default MyApp;