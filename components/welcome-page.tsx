'use client';

import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { LogOut } from 'lucide-react';

// Helper: Send email invite (stub, replace with backend/email service)
async function sendInviteEmail(email: string, orgName: string, inviterName: string) {
  // TODO: Replace with actual email service (SendGrid, Firebase Functions, etc.)
  console.log(`Sent invite to ${email} for org ${orgName} from ${inviterName}`);
}

// Helper: Notify admin (stub, replace with backend/notification service)
async function notifyAdmin(adminEmail: string, orgName: string, joinedUser: string) {
  // TODO: Replace with actual notification service
  console.log(`Admin ${adminEmail} notified: ${joinedUser} joined ${orgName}`);
}

export function WelcomePage() {
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [step, setStep] = useState<'onboarding' | 'org'>('onboarding');
  const [orgs, setOrgs] = useState<any[]>([]); // Holds organizations for the user
  const [inviteInput, setInviteInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);

  // Fetch orgs for the current user
  async function fetchUserOrgs() {
    if (!auth.currentUser?.email) return setOrgs([]);
    // Query orgs where createdByEmail == current user's email OR invites includes current user's email
    // Firestore does not support OR queries directly, so we fetch both and merge
    const { getDocs, collection, query, where } = await import('firebase/firestore');
    const orgsCreatedBy = await getDocs(query(collection(db, 'orgs'), where('createdByEmail', '==', auth.currentUser.email)));
    const orgsInvitedTo = await getDocs(query(collection(db, 'orgs'), where('invites', 'array-contains', auth.currentUser.email)));
    const orgsList: any[] = [];
    orgsCreatedBy.forEach(doc => orgsList.push({ id: doc.id, ...doc.data() }));
    orgsInvitedTo.forEach(doc => {
      if (!orgsList.find(o => o.id === doc.id)) orgsList.push({ id: doc.id, ...doc.data() });
    });
    setOrgs(orgsList);
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          name: user.displayName,
          email: user.email,
          phone: user.phoneNumber ?? "",
          createdAt: new Date().toISOString(),
          provider: "google",
          lastLogin: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, "users", user.uid), {
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }
      // After successful login, go to org selection step
      setStep('org');
      await fetchUserOrgs();
    } catch (error) {
      let errorMessage = "Failed to sign in with Google. Please try again.";
      const err = error as any;
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      alert(errorMessage);
      console.error("Google login error:", error);
    } finally {
      setIsGoogleLoading(false);
    }
  };
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save form data
    router.push('/modules');
  };

  // Logout function
  async function handleLogout() {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    setStep('onboarding');
    setOrgs([]);
  }

  // Handle org select: redirect to dashboard with org context
  function handleOrgSelect(org: any) {
    localStorage.setItem('selectedOrg', JSON.stringify(org));
    localStorage.setItem('currentUser', JSON.stringify(auth.currentUser));
    router.push('/modules');
  }

  return (
    <>
      {step === 'onboarding' && (
        <div className="min-h-screen w-full bg-slate-900 flex items-start justify-center pt-24">
          <div className="max-w-md w-full mx-auto">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card className="glass rounded-lg p-8 flex flex-col items-center justify-center">
                <h3 className="text-2xl font-semibold mb-8 text-slate-200 text-center">Let's get started</h3>
                <motion.button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white text-slate-900 font-medium text-base cursor-pointer rounded-xl"
                  whileHover={{ scale: 1.05, boxShadow: "0 4px 24px rgba(66,133,244,0.15)" }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {/* Google icon SVG */}
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>{isGoogleLoading ? "Signing in..." : "Continue with Google"}</span>
                </motion.button>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
      {step === 'org' && (
        <div className="min-h-screen w-full bg-slate-900 flex items-start justify-center pt-24">
          <div className="max-w-lg w-full mx-auto flex flex-col items-center justify-center">
            <Card className="glass rounded-lg p-8 flex flex-col items-center justify-center w-full">
              <Image src="/images/vendai-logo-full.png" alt="Vendai Logo" width={160} height={44} className="mb-6" />
              {orgs.length > 0 && !showOrgForm && (
                <span className="text-lg text-slate-400 mb-6">Choose an organization or create a new one</span>
              )}
              <AnimatePresence mode="wait">
                {!showOrgForm ? (
                  <motion.div
                    key="org-list"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3, type: "spring" }}
                    className="w-full"
                  >
                    {orgs.length > 0 ? (
                      <div className="w-full mb-6 grid gap-4">
                        {orgs.map((org: any) => (
                          <motion.div
                            key={org.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg mb-2 px-5 py-4 flex items-center gap-3 shadow-sm hover:shadow-lg hover:bg-slate-800/80 cursor-pointer"
                            onClick={() => handleOrgSelect(org)}
                          >
                            <div className="flex-1">
                              <span className="text-lg font-semibold text-slate-100">{org.name}</span>
                              {org.createdByEmail && (
                                <span className="block text-xs text-slate-400 mt-1">Created by: {org.createdByEmail}</span>
                              )}
                            </div>
                            {/* Optionally add an icon or chevron */}
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-slate-400">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </motion.div>
                        ))}
                      </div>
                    ) : null}
                    <motion.button
                      whileHover={{ scale: 1.05, boxShadow: "0 4px 24px rgba(66,133,244,0.15)" }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="w-full bg-white text-black font-medium text-base py-3 rounded-lg mt-2 cursor-pointer"
                      onClick={() => setShowOrgForm(true)}
                    >
                      Create New Organization
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="org-form"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3, type: "spring" }}
                    className="w-full flex flex-col items-center"
                    onSubmit={async e => {
                      e.preventDefault();
                      try {
                        // Create org in Firestore
                        const orgRef = doc(db, 'orgs', orgName.replace(/\s+/g, '-').toLowerCase());
                        await setDoc(orgRef, {
                          name: orgName,
                          createdBy: auth.currentUser?.uid,
                          createdByEmail: auth.currentUser?.email,
                          createdAt: new Date().toISOString(),
                          invites: inviteEmails,
                        });
                        // Send invites
                        await Promise.all(inviteEmails.map(email => sendInviteEmail(email, orgName, auth.currentUser?.displayName || '')));
                        // Refresh orgs list so new org appears
                        await fetchUserOrgs();
                        alert('Organization created and invites sent!');
                        setShowOrgForm(false);
                        // Redirect to dashboard after creation
                        router.push('/modules');
                      } catch (err) {
                        alert('Failed to create organization or send invites.');
                        console.error(err);
                      }
                    }}
                  >
                    <h4 className="text-xl font-semibold mb-4 text-slate-200 text-center">Create Organization</h4>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      placeholder="Organization Name"
                      className="w-full mb-4 px-4 py-2 rounded bg-slate-800/40 border border-slate-700/50 text-slate-200"
                    />
                    <div className="w-full mb-6">
                      <label className="block text-slate-400 mb-2 text-sm">Invite Google users (email)</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="email"
                          value={inviteInput}
                          onChange={e => setInviteInput(e.target.value)}
                          placeholder="user@email.com"
                          className="flex-1 px-4 py-2 rounded bg-slate-800/40 border border-slate-700/50 text-slate-200"
                        />
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05, boxShadow: "0 4px 24px rgba(66,133,244,0.15)" }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          className="bg-white text-black font-medium text-base px-4 py-2 rounded-lg cursor-pointer"
                          onClick={() => {
                            if (inviteInput && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteInput)) {
                              setInviteEmails(prev => [...prev, inviteInput]);
                              setInviteInput("");
                            }
                          }}
                        >
                          Add
                        </motion.button>
                      </div>
                      {inviteEmails.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {inviteEmails.map((email, idx) => (
                            <span key={idx} className="bg-slate-700 text-slate-100 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                              {email}
                              <button type="button" className="ml-1 text-red-400 hover:text-red-600" onClick={() => setInviteEmails(inviteEmails.filter(e => e !== email))}>&times;</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.05, boxShadow: "0 4px 24px rgba(66,133,244,0.15)" }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="w-full bg-white text-black font-medium text-base py-3 rounded-lg cursor-pointer"
                    >
                      Create
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05, boxShadow: "0 4px 24px rgba(244,66,66,0.15)" }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="w-full mt-2 bg-black text-white font-medium text-base py-3 rounded-lg cursor-pointer"
                      onClick={() => setShowOrgForm(false)}
                    >
                      Cancel
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </Card>
          </div>
        </div>
      )}
      {/* Logout button, top right below header */}
      {step !== 'onboarding' && (
        <div className="absolute top-15 left-8 z-10">
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow transition-colors flex items-center justify-center"
            title="Logout"
          >
            <LogOut className="w-6 h-6" style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>
      )}
    </>
  )
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

const FeatureCard = (props: FeatureCardProps) => {
  const { title, description, icon } = props;

  return (
  <Card className="p-6 backdrop-blur-sm bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer hover:cursor-pointer">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
