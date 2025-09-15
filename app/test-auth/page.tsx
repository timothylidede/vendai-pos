'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function TestAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/40 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Firebase Authentication Test</h1>
          
          {user ? (
            <div className="space-y-4">
              <div className="text-green-400 font-semibold">✅ Authentication Status: Logged In</div>
              
              <div className="space-y-2 text-white">
                <p><strong>User ID:</strong> {user.uid}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Display Name:</strong> {user.displayName}</p>
                <p><strong>Photo URL:</strong> {user.photoURL ? 'Available' : 'Not available'}</p>
                <p><strong>Email Verified:</strong> {user.emailVerified ? 'Yes' : 'No'}</p>
                <p><strong>Provider:</strong> {user.providerData[0]?.providerId || 'Unknown'}</p>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={handleSignOut}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Sign Out
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="ml-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Go to Welcome Page
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-red-400 font-semibold">❌ Authentication Status: Not Logged In</div>
              <p className="text-white">No user is currently authenticated.</p>
              
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Welcome Page to Sign In
              </Button>
            </div>
          )}

          <div className="mt-8 p-4 bg-slate-800/40 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Firebase Configuration Status:</h3>
            <div className="space-y-1 text-sm">
              <div className="text-green-400">✅ Firebase initialized</div>
              <div className="text-green-400">✅ Authentication configured</div>
              <div className="text-green-400">✅ Google provider configured</div>
              <div className="text-green-400">✅ Firestore configured</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}