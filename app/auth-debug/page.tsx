'use client';

import { useEffect, useState } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';

/**
 * Auth Debug Page
 * Visit at: https://app.vendai.digital/auth-debug
 * 
 * This page helps diagnose authentication issues on Vercel
 */
export default function AuthDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [healthCheck, setHealthCheck] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const gatherDebugInfo = async () => {
      const info = {
        timestamp: new Date().toISOString(),
        browser: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          cookiesEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
        },
        window: {
          hostname: window.location.hostname,
          protocol: window.location.protocol,
          href: window.location.href,
        },
        firebase: {
          authInitialized: Boolean(auth),
          dbInitialized: Boolean(db),
          googleProviderInitialized: Boolean(googleProvider),
          authDomain: auth?.app?.options?.authDomain || 'Not initialized',
          projectId: auth?.app?.options?.projectId || 'Not initialized',
          apiKeyLastFour: auth?.app?.options?.apiKey?.slice(-4) || 'Not initialized',
          currentUser: auth?.currentUser ? {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName,
          } : null,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasElectronAPI: Boolean((window as any).electronAPI),
        },
        popupTest: null,
      };

      // Test popup capability
      try {
        const popup = window.open('', '_blank', 'width=1,height=1');
        if (popup) {
          popup.close();
          info.popupTest = 'Popups allowed ✓';
        } else {
          info.popupTest = 'Popups blocked ✗';
        }
      } catch (error) {
        info.popupTest = `Popup test failed: ${error}`;
      }

      setDebugInfo(info);

      // Fetch health check
      try {
        const response = await fetch('/api/auth/health');
        const data = await response.json();
        setHealthCheck(data);
      } catch (error) {
        setHealthCheck({ error: 'Failed to fetch health check', details: String(error) });
      }

      setIsLoading(false);
    };

    gatherDebugInfo();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading debug information...</div>
      </div>
    );
  }

  const expectedAuthDomain = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'auth.vendai.digital').replace(/^https?:\/\//, '');
  const normalizedAuthDomain = (debugInfo?.firebase?.authDomain || '').replace(/^https?:\/\//, '');
  const domainMatchesExpected = normalizedAuthDomain === expectedAuthDomain;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🔍 VendAI Auth Debug Panel</h1>
        <p className="text-slate-400 mb-8">Diagnostic information for authentication issues</p>

        {/* Health Check */}
        <section className="mb-8 bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🏥</span> Server Health Check
          </h2>
          {healthCheck ? (
            <div>
              <div className={`mb-4 p-3 rounded ${healthCheck.status === 'healthy' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                <strong>Status:</strong> {healthCheck.status}
                <br />
                <strong>Message:</strong> {healthCheck.message}
              </div>
              <pre className="bg-slate-950 p-4 rounded overflow-auto text-xs">
                {JSON.stringify(healthCheck, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-slate-400">Loading...</div>
          )}
        </section>

        {/* Browser Info */}
        <section className="mb-8 bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🌐</span> Browser Information
          </h2>
          <div className="space-y-2 text-sm">
            <div><strong>Domain:</strong> {debugInfo?.window?.hostname}</div>
            <div><strong>Protocol:</strong> {debugInfo?.window?.protocol}</div>
            <div><strong>User Agent:</strong> {debugInfo?.browser?.userAgent}</div>
            <div><strong>Cookies Enabled:</strong> {debugInfo?.browser?.cookiesEnabled ? '✓ Yes' : '✗ No'}</div>
            <div><strong>Online:</strong> {debugInfo?.browser?.onLine ? '✓ Yes' : '✗ No'}</div>
            <div className={debugInfo?.popupTest?.includes('allowed') ? 'text-green-400' : 'text-red-400'}>
              <strong>Popup Test:</strong> {debugInfo?.popupTest}
            </div>
          </div>
        </section>

        {/* Firebase Status */}
        <section className="mb-8 bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🔥</span> Firebase Status
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Auth Initialized:</strong>{' '}
              {debugInfo?.firebase?.authInitialized ? (
                <span className="text-green-400">✓ Yes</span>
              ) : (
                <span className="text-red-400">✗ No</span>
              )}
            </div>
            <div>
              <strong>Firestore Initialized:</strong>{' '}
              {debugInfo?.firebase?.dbInitialized ? (
                <span className="text-green-400">✓ Yes</span>
              ) : (
                <span className="text-red-400">✗ No</span>
              )}
            </div>
            <div>
              <strong>Google Provider:</strong>{' '}
              {debugInfo?.firebase?.googleProviderInitialized ? (
                <span className="text-green-400">✓ Yes</span>
              ) : (
                <span className="text-red-400">✗ No</span>
              )}
            </div>
            <div><strong>Auth Domain:</strong> {debugInfo?.firebase?.authDomain}</div>
            <div><strong>Project ID:</strong> {debugInfo?.firebase?.projectId}</div>
            <div><strong>API Key (last 4):</strong> {debugInfo?.firebase?.apiKeyLastFour}</div>
            <div>
              <strong>Current User:</strong>{' '}
              {debugInfo?.firebase?.currentUser ? (
                <span className="text-green-400">
                  ✓ Signed in as {debugInfo.firebase.currentUser.email}
                </span>
              ) : (
                <span className="text-slate-400">Not signed in</span>
              )}
            </div>
          </div>
        </section>

        {/* Common Issues */}
        <section className="mb-8 bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>⚠️</span> Common Issues Checklist
          </h2>
          <div className="space-y-3 text-sm">
            <CheckItem
              condition={domainMatchesExpected}
              pass={`Auth domain matches ${expectedAuthDomain}`}
              fail={`Auth domain mismatch. Expected ${expectedAuthDomain}, found ${normalizedAuthDomain || 'unknown'}`}
            />
            <CheckItem
              condition={debugInfo?.firebase?.authInitialized}
              pass="Firebase Auth is initialized"
              fail="Firebase Auth failed to initialize - check environment variables"
            />
            <CheckItem
              condition={debugInfo?.popupTest?.includes('allowed')}
              pass="Browser allows popups"
              fail="Browser is blocking popups - allow popups for this site"
            />
            <CheckItem
              condition={debugInfo?.browser?.cookiesEnabled}
              pass="Cookies are enabled"
              fail="Cookies are disabled - enable cookies for this site"
            />
            <CheckItem
              condition={debugInfo?.browser?.onLine}
              pass="Internet connection is active"
              fail="No internet connection detected"
            />
            <CheckItem
              condition={healthCheck?.status === 'healthy'}
              pass="Server environment variables are configured"
              fail="Server configuration error - check Vercel environment variables"
            />
          </div>
        </section>

        {/* Actions */}
        <section className="mb-8 bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🛠️</span> Quick Actions
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/'}
              className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
            >
              Go to Login Page
            </button>
            <button
              onClick={() => window.location.reload()}
              className="block w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-medium"
            >
              Refresh Page
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                alert('Debug info copied to clipboard!');
              }}
              className="block w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-medium"
            >
              Copy Debug Info
            </button>
          </div>
        </section>

        {/* Raw Data */}
        <section className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold mb-4">📋 Raw Debug Data</h2>
          <pre className="bg-slate-950 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

function CheckItem({ condition, pass, fail }: { condition: boolean; pass: string; fail: string }) {
  return (
    <div className={`p-3 rounded ${condition ? 'bg-green-900/20 border border-green-700' : 'bg-red-900/20 border border-red-700'}`}>
      <span className="mr-2">{condition ? '✓' : '✗'}</span>
      {condition ? pass : fail}
    </div>
  );
}
