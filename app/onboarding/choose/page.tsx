'use client'

import { useEffect, useMemo, useState } from 'react'
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
        router.push('/login')
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
      await signOut(auth)
    } finally {
      router.push('/login')
    }
  }

  const onAccept = async (inv: InvitationData & { id: string }) => {
    if (!user) return
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
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900 relative">
      {/* Logout button top-right */}
      <div className="absolute top-6 right-6">
        <Button onClick={onLogout} variant="outline" className="border-slate-600 text-slate-300 hover:text-white">
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create Organization */}
        <Card className="relative overflow-hidden backdrop-blur-xl bg-slate-900/80 border border-slate-600/50 rounded-2xl p-8 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                <Building className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Create a new organization</h2>
            </div>
            <p className="text-slate-300 text-sm mb-6">Start fresh and set up your organization details. You can invite teammates after.</p>
            <Button
              onClick={() => router.push('/onboarding')}
              className="bg-white text-black hover:bg-gray-100"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </div>
        </Card>

        {/* View Invitations */}
        <Card className="relative overflow-hidden backdrop-blur-xl bg-slate-900/80 border border-slate-600/50 rounded-2xl p-8 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <Mail className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Join an organization</h2>
            </div>
            <p className="text-slate-300 text-sm mb-4">Review invitations sent to your email and accept to join.</p>

            {loadingInvites ? (
              <div className="flex items-center text-slate-400 text-sm">
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading invitations...
              </div>
            ) : hasInvites ? (
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
                {invites!.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-white/5">
                    <div>
                      <div className="text-white text-sm font-medium">{inv.organizationName}</div>
                      <div className="text-slate-400 text-xs">Role: {inv.role} • Invited by {inv.inviterName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => onAccept(inv)}
                        disabled={acceptingId === inv.id}
                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-70"
                      >
                        {acceptingId === inv.id ? 'Accepting…' : 'Accept'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-sm mb-4">No invitations found for your account.</div>
            )}

            {/* Removed the "Or create a new organization" button */}
          </div>
        </Card>
      </div>
    </div>
  )
}
