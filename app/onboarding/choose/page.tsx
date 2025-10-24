'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building, Mail, Sparkles, ClipboardList, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getInvitationsForEmail, InvitationData, acceptInvitation } from '@/lib/invitation-operations'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

export default function ChooseOnboardingPage() {
  const router = useRouter()
  const { user, userData, loading } = useAuth()
  const [invites, setInvites] = useState<(InvitationData & { id: string })[] | null>(null)
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/')
        return
      }
      // If already onboarded, go to modules
      if (userData?.onboardingCompleted) {
        router.push('/modules')
        return
      }
      // Fetch invites for this email
      if (user?.email) {
        setLoadingInvites(true)
        getInvitationsForEmail(user.email)
          .then(res => setInvites(res.success ? (res.invitations || []) : []))
          .finally(() => setLoadingInvites(false))
      }
    }
  }, [user, userData, loading, router])

  const hasInvites = (invites?.length || 0) > 0

  const onLogout = async () => {
    try {
      if (auth) {
        await signOut(auth)
      }
    } finally {
      router.replace('/')
    }
  }

  const onAccept = async (inv: InvitationData & { id: string }) => {
    if (!user || !db) {
      console.error('Missing auth context while accepting invitation')
      return
    }
    setAcceptingId(inv.id)
    try {
      // Update/merge user profile to join the org immediately
      const userDocRef = doc(db, 'users', user.uid)
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        role: inv.role,
        organizationName: inv.organizationName,
        onboardingCompleted: true,
        isOrganizationCreator: false,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true })

      // Mark invitation accepted
      await acceptInvitation(inv.id, user.uid)

      // Go straight to modules
      router.push('/modules')
    } catch (e) {
      console.error('Failed to accept invitation:', e)
    } finally {
      setAcceptingId(null)
    }
  }

  return (
    <div className="module-background relative flex min-h-screen w-full overflow-hidden lg:h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[120px]" />
        <div className="absolute -top-36 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/18 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-96 w-96 rounded-full bg-indigo-500/18 blur-[140px]" />
        <div className="absolute top-1/3 -left-32 h-64 w-64 rounded-full bg-cyan-400/14 blur-[120px]" />
      </div>

      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-0">
        <div className="relative h-full w-full lg:h-screen">
          <img
            src="/woman-onboarding.jpg"
            alt="Onboarding"
            className="h-full w-full object-cover"
          />
          <a
            href="https://vendai.digital"
            target="_blank"
            rel="noopener noreferrer"
            className="group absolute left-10 top-10 inline-flex items-center justify-center transition active:scale-95"
          >
            <img
              src="/images/logo-icon-remove-black.png"
              alt="Vendai logo"
              className="h-16 w-16 transition-transform duration-700 group-hover:rotate-180"
            />
          </a>
        </div>
      </div>

      {/* Right side - Form content */}
      <div className="flex-1 flex items-stretch justify-center px-4 py-8 lg:px-8 lg:py-12">
  <div className="scrollbar-thin relative z-10 flex w-full max-w-2xl flex-col gap-8 pr-3 lg:h-full lg:overflow-y-auto lg:pr-2">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.35em] text-slate-200/80 backdrop-blur-md">
              onboarding
            </span>
            <h1 className="text-3xl font-semibold text-slate-100 md:text-4xl">Let&rsquo;s get started</h1>
            <p className="text-sm text-slate-300/80 md:text-base">Spin up a fresh workspace or join your team in one tap.</p>
          </div>

          <div className="flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <Card className="group relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] px-8 py-9 shadow-[0_30px_90px_-45px_rgba(10,17,31,0.9)] backdrop-blur-3xl transition-all duration-500 hover:border-sky-200/30 hover:bg-white/[0.09]">
                <div className="pointer-events-none absolute inset-px rounded-[calc(1.5rem-1px)] bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.22),transparent_60%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative z-10 flex flex-col gap-8">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-200/30 bg-sky-500/15 text-sky-200">
                      <Building className="h-7 w-7" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-xl font-semibold text-slate-100">Setup a new organization</h2>
                      <p className="text-sm text-slate-300/75">Set your team up with a clean slate and tailor Vendai to your workflows.</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => router.push('/onboarding')}
                    className="group/button inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500/80 px-6 py-3 text-sm font-medium text-slate-950 shadow-[0_10px_30px_-12px_rgba(56,189,248,0.8)] transition hover:bg-sky-400"
                  >
                    <Sparkles className="h-4 w-4 transition-transform group-hover/button:translate-x-0.5" />
                    <span>Setup organization</span>
                  </Button>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            >
              <Card className="group relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] px-8 py-9 shadow-[0_30px_90px_-45px_rgba(10,17,31,0.9)] backdrop-blur-3xl transition-all duration-500 hover:border-sky-200/30 hover:bg-white/[0.09]">
                <div className="pointer-events-none absolute inset-px rounded-[calc(1.5rem-1px)] bg-[radial-gradient(circle_at_top_right,rgba(165,243,252,0.25),transparent_60%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-500/15 text-cyan-100">
                      <Mail className="h-7 w-7" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-xl font-semibold text-slate-100">Join an organization</h2>
                      <p className="text-sm text-slate-300/75">Accept an invite to jump into the workspace your team already set up.</p>
                    </div>
                  </div>

                  {loadingInvites ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200/80">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200/30 border-t-transparent" />
                      Loading invitations…
                    </div>
                  ) : hasInvites ? (
                    <div className="thin-scroll space-y-3">
                      {invites!.map((inv) => (
                        <div key={inv.id} className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/10 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-100">{inv.organizationName}</div>
                            <div className="text-xs text-slate-300/70">Role: {inv.role} • Invited by {inv.inviterName}</div>
                          </div>
                          <Button
                            onClick={() => onAccept(inv)}
                            disabled={acceptingId === inv.id}
                            className="h-9 shrink-0 rounded-xl bg-cyan-500/80 px-4 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-70"
                          >
                            {acceptingId === inv.id ? 'Accepting…' : 'Accept invite'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-300/75">
                      <ClipboardList className="mx-auto mb-3 h-5 w-5 text-slate-300/60" />
                      No invitations found for your account yet.
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Logout link */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
              className="text-center"
            >
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 text-sm text-slate-300/70 transition hover:text-sky-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
