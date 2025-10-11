# VendAI Platform Admin Authentication

_Last updated: October 11, 2025_

## Overview

The platform admin dashboard (`/app/admin`) is **restricted to a single super-admin user** for security and control. Only the VendAI founder account can access platform-wide analytics, commission reconciliation, and organization management.

---

## Super-Admin Credentials

### Authorized User
- **Email**: `tim@vendai.digital`
- **Password**: `MayaMulei25*`
- **Firebase UID**: (will be set on first login)
- **Custom Claim**: `isSuperAdmin: true`

### Security Requirements
- ✅ **Single-user access**: Only this email can access `/app/admin`
- ✅ **Custom claims**: Firebase Auth custom claims enforce super-admin role
- ✅ **Environment variable**: `SUPER_ADMIN_EMAIL` stored in `.env.local` and Vercel
- ✅ **Middleware protection**: Route-level middleware blocks unauthorized access
- ✅ **Session validation**: Check user email and custom claims on every request

---

## Implementation Steps

### 1. Create Super-Admin User in Firebase

**Firebase Console**:
1. Go to Firebase Console → Authentication → Users
2. Add user:
   - Email: `tim@vendai.digital`
   - Password: `MayaMulei25*`
   - Email verified: ✅ (check this)
3. Note the UID (e.g., `abc123xyz456`)

**Set Custom Claim (Firebase Admin SDK)**:
```typescript
// Run this script once to set custom claim
import { auth } from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

async function setSuperAdminClaim() {
  const email = 'tim@vendai.digital';
  
  try {
    // Get user by email
    const user = await auth().getUserByEmail(email);
    
    // Set custom claim
    await auth().setCustomUserClaims(user.uid, {
      isSuperAdmin: true,
      role: 'platform_admin'
    });
    
    console.log(`✅ Super-admin claim set for ${email}`);
    console.log(`UID: ${user.uid}`);
  } catch (error) {
    console.error('Error setting super-admin claim:', error);
  }
}

setSuperAdminClaim();
```

**Save script as**: `scripts/set-super-admin.ts`

**Run once**:
```powershell
npx ts-node scripts/set-super-admin.ts
```

---

### 2. Environment Variables

**`.env.local`** (development):
```bash
# Super-Admin Configuration
SUPER_ADMIN_EMAIL=tim@vendai.digital
```

**Vercel Environment Variables** (production):
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add variable:
   - Name: `SUPER_ADMIN_EMAIL`
   - Value: `tim@vendai.digital`
   - Environment: Production, Preview, Development
3. Redeploy after adding

---

### 3. Admin Route Protection

**Create Admin Layout with Middleware**:

`app/admin/layout.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/loading-spinner'
import { toast } from '@/components/ui/use-toast'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkSuperAdmin() {
      // Wait for auth to load
      if (loading) return

      // No user logged in
      if (!user) {
        toast({
          title: 'Access Denied',
          description: 'Please login to continue',
          variant: 'destructive',
        })
        router.push('/login?redirect=/admin')
        return
      }

      try {
        // Check email match
        const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'tim@vendai.digital'
        
        if (user.email !== superAdminEmail) {
          console.error(`Unauthorized access attempt by ${user.email}`)
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to access the admin dashboard',
            variant: 'destructive',
          })
          router.push('/modules')
          return
        }

        // Check custom claim
        const idTokenResult = await user.getIdTokenResult()
        const claims = idTokenResult.claims

        if (!claims.isSuperAdmin) {
          console.error(`User ${user.email} missing isSuperAdmin claim`)
          toast({
            title: 'Access Denied',
            description: 'Super-admin privileges not configured',
            variant: 'destructive',
          })
          router.push('/modules')
          return
        }

        // All checks passed
        setIsSuperAdmin(true)
        setChecking(false)
      } catch (error) {
        console.error('Error checking super-admin status:', error)
        toast({
          title: 'Error',
          description: 'Failed to verify admin access',
          variant: 'destructive',
        })
        router.push('/modules')
      }
    }

    checkSuperAdmin()
  }, [user, loading, router])

  // Show loading while checking
  if (loading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  // Only render children if super-admin
  if (!isSuperAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Admin Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Platform Admin Dashboard
          </h1>
          <p className="text-gray-400">
            Logged in as: <span className="text-emerald-400">{user?.email}</span>
          </p>
        </div>

        {/* Admin Content */}
        {children}
      </div>
    </div>
  )
}
```

---

### 4. API Route Protection

**Protect admin API routes**:

`app/api/admin/[...]/route.ts` (example):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify token
    const decodedToken = await auth.verifyIdToken(token)
    
    // Check email
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'tim@vendai.digital'
    if (decodedToken.email !== superAdminEmail) {
      console.error(`Unauthorized API access attempt by ${decodedToken.email}`)
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      )
    }

    // Check custom claim
    if (!decodedToken.isSuperAdmin) {
      console.error(`User ${decodedToken.email} missing isSuperAdmin claim`)
      return NextResponse.json(
        { error: 'Forbidden: Super-admin privileges not configured' },
        { status: 403 }
      )
    }

    // Proceed with admin API logic
    // ... your code here ...

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Create reusable middleware helper**:

`lib/admin-middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'

export async function verifySuperAdmin(req: NextRequest): Promise<{
  authorized: boolean
  user?: any
  error?: string
}> {
  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return { authorized: false, error: 'Missing authorization header' }
    }

    const token = authHeader.substring(7)

    // Verify token
    const decodedToken = await auth.verifyIdToken(token)
    
    // Check email
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'tim@vendai.digital'
    if (decodedToken.email !== superAdminEmail) {
      console.error(`Unauthorized API access attempt by ${decodedToken.email}`)
      return { authorized: false, error: 'Forbidden: Super-admin access required' }
    }

    // Check custom claim
    if (!decodedToken.isSuperAdmin) {
      console.error(`User ${decodedToken.email} missing isSuperAdmin claim`)
      return { authorized: false, error: 'Forbidden: Super-admin privileges not configured' }
    }

    return { authorized: true, user: decodedToken }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, error: 'Invalid token' }
  }
}

// Usage in API routes:
export async function GET(req: NextRequest) {
  const { authorized, error } = await verifySuperAdmin(req)
  
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  // Your admin API logic here
}
```

---

### 5. Firestore Security Rules

**Add super-admin check to Firestore rules**:

`firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check super-admin
    function isSuperAdmin() {
      return request.auth != null && 
             request.auth.token.email == 'tim@vendai.digital' &&
             request.auth.token.isSuperAdmin == true;
    }

    // Platform-wide collections (super-admin only)
    match /commission_transactions/{docId} {
      allow read, write: if isSuperAdmin();
    }

    match /reconciliation_periods/{docId} {
      allow read, write: if isSuperAdmin();
    }

    match /commission_invoices/{docId} {
      allow read, write: if isSuperAdmin();
    }

    match /platform_metrics/{docId} {
      allow read, write: if isSuperAdmin();
    }

    // Organization collections (super-admin can read all)
    match /users/{userId} {
      allow read: if isSuperAdmin() || request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
    }

    match /pos_products/{productId} {
      allow read: if isSuperAdmin() || 
                     request.auth != null && 
                     resource.data.orgId == request.auth.token.orgId;
      allow write: if request.auth != null && 
                      resource.data.orgId == request.auth.token.orgId;
    }

    // ... rest of your rules
  }
}
```

---

## Access Flow

### Super-Admin Login Flow
1. **Navigate to** `https://vendai.com/login`
2. **Enter credentials**:
   - Email: `tim@vendai.digital`
   - Password: `MayaMulei25*`
3. **Firebase authenticates** user
4. **Custom claims loaded** (`isSuperAdmin: true`)
5. **Redirect to** `/app/admin` (or manually navigate)
6. **Layout middleware checks**:
   - User logged in? ✅
   - Email matches? ✅
   - Custom claim present? ✅
7. **Access granted** → Dashboard loads

### Unauthorized User Attempt
1. **User logs in** with different email (e.g., `retailer@example.com`)
2. **Attempts to visit** `/app/admin`
3. **Layout middleware checks**:
   - User logged in? ✅
   - Email matches? ❌ (`retailer@example.com` ≠ `tim@vendai.digital`)
4. **Access denied** → Redirect to `/modules`
5. **Toast notification**: "Access Denied: Super-admin access required"

---

## Security Best Practices

### 1. Never Commit Credentials
- ✅ Add `.env.local` to `.gitignore`
- ✅ Store password in password manager (1Password, LastPass)
- ✅ Use environment variables for super-admin email

### 2. Audit Logging
```typescript
// Log all super-admin actions
async function logAdminAction(action: string, userId: string, details: any) {
  await db.collection('admin_audit_logs').add({
    action,
    userId,
    email: 'tim@vendai.digital',
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
  })
}

// Usage
await logAdminAction('suspend_distributor', user.uid, {
  distributorId: 'dist_123',
  reason: 'Overdue payment >30 days',
})
```

### 3. Rate Limiting
```typescript
// Protect admin API routes with stricter rate limits
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
})

export async function POST(req: NextRequest) {
  const { authorized, user } = await verifySuperAdmin(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Rate limit super-admin API calls
  const identifier = `admin:${user.email}`
  const { success } = await ratelimit.limit(identifier)

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // Proceed with API logic
}
```

### 4. Multi-Factor Authentication (Future)
- Add 2FA requirement for super-admin account
- Use Firebase Auth phone verification
- Require 2FA code on every admin login

---

## Testing

### Test Super-Admin Access
```typescript
// Test script: scripts/test-admin-access.ts
import { auth } from 'firebase/auth'
import { app } from '@/lib/firebase'

async function testSuperAdminAccess() {
  try {
    // Sign in
    const userCredential = await signInWithEmailAndPassword(
      auth,
      'tim@vendai.digital',
      'MayaMulei25*'
    )

    // Get token
    const idTokenResult = await userCredential.user.getIdTokenResult()
    
    console.log('✅ Login successful')
    console.log('Email:', userCredential.user.email)
    console.log('UID:', userCredential.user.uid)
    console.log('Custom Claims:', idTokenResult.claims)
    console.log('Is Super-Admin:', idTokenResult.claims.isSuperAdmin)

    // Test API access
    const response = await fetch('/api/admin/commissions/overview', {
      headers: {
        'Authorization': `Bearer ${await userCredential.user.getIdToken()}`,
      },
    })

    if (response.ok) {
      console.log('✅ API access successful')
    } else {
      console.error('❌ API access denied:', response.status)
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testSuperAdminAccess()
```

### Test Unauthorized Access
```typescript
// Try accessing with different account
async function testUnauthorizedAccess() {
  try {
    // Sign in with retailer account
    const userCredential = await signInWithEmailAndPassword(
      auth,
      'retailer@example.com',
      'password123'
    )

    // Attempt API access
    const response = await fetch('/api/admin/commissions/overview', {
      headers: {
        'Authorization': `Bearer ${await userCredential.user.getIdToken()}`,
      },
    })

    if (response.ok) {
      console.error('❌ SECURITY ISSUE: Unauthorized access succeeded!')
    } else {
      console.log('✅ Unauthorized access blocked:', response.status)
    }
  } catch (error) {
    console.log('✅ Access properly denied')
  }
}

testUnauthorizedAccess()
```

---

## Troubleshooting

### Issue: "Super-admin privileges not configured"
**Solution**: Run the set-super-admin script:
```powershell
npx ts-node scripts/set-super-admin.ts
```

### Issue: "Email does not match"
**Solution**: Check environment variable:
```powershell
# PowerShell
$env:NEXT_PUBLIC_SUPER_ADMIN_EMAIL
```

If not set, add to `.env.local`:
```bash
NEXT_PUBLIC_SUPER_ADMIN_EMAIL=tim@vendai.digital
```

### Issue: Redirected to /login immediately
**Solution**: Clear browser cache and cookies, then login again.

### Issue: Custom claim not persisting
**Solution**: Custom claims are cached in the ID token. Force refresh:
```typescript
await user.getIdToken(true) // Force refresh
```

---

## Deployment Checklist

- [ ] Set `SUPER_ADMIN_EMAIL` in Vercel environment variables
- [ ] Run `set-super-admin.ts` script to configure custom claim
- [ ] Test super-admin login on production URL
- [ ] Verify unauthorized users are blocked
- [ ] Enable audit logging for all admin actions
- [ ] Set up rate limiting for admin API routes
- [ ] Update Firestore security rules
- [ ] Document password securely (password manager)
- [ ] Configure 2FA for super-admin account (future)

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Single super-admin user
- ✅ Email + custom claim authentication
- ✅ Route and API protection

### Phase 2
- [ ] Add secondary admin users (with limited permissions)
- [ ] Role hierarchy (super-admin > admin > manager)
- [ ] 2FA requirement for super-admin
- [ ] Session timeout (auto-logout after 1 hour)

### Phase 3
- [ ] Admin activity dashboard
- [ ] Real-time alerts for suspicious activity
- [ ] IP whitelisting for admin portal
- [ ] Automated security reports

---

**For Implementation**: See `TODO.md` Phase 5.0 - Platform Admin Portal
**For Commission System**: See `COMMISSION_RECONCILIATION_SYSTEM.md`
