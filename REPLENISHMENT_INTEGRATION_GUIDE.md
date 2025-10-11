# Auto-Replenishment Dashboard Integration Guide

## Quick Integration Steps

### 1. Add to Admin Navigation

**Option A: Add to existing modules dashboard**

```typescript
// In your modules dashboard or admin panel
import ReplenishmentDashboard from '@/components/modules/replenishment-dashboard'

// Add navigation item
const modules = [
  {
    title: 'Auto-Replenishment',
    description: 'Intelligent stock replenishment',
    icon: 'TrendingUp',
    href: '/modules/replenishment',
    color: 'bg-purple-500'
  },
  // ...other modules
]

// Add route component
<ReplenishmentDashboard orgId={currentOrgId} />
```

**Option B: Create dedicated page**

Create `app/modules/replenishment/page.tsx`:

```typescript
'use client'

import { useAuth } from '@/contexts/auth-context'
import ReplenishmentDashboard from '@/components/modules/replenishment-dashboard'
import { redirect } from 'next/navigation'

export default function ReplenishmentPage() {
  const { user, userData } = useAuth()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto p-6">
      <ReplenishmentDashboard orgId={userData?.orgId || ''} />
    </div>
  )
}
```

### 2. Add to Product Edit Modal (Inventory Module)

```typescript
// In your product edit/create form component

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

function ProductEditModal({ product, suppliers }) {
  const [reorderPoint, setReorderPoint] = useState(product?.reorderPoint || '')
  const [reorderQty, setReorderQty] = useState(product?.reorderQty || '')
  const [preferredSupplierId, setPreferredSupplierId] = useState(product?.preferredSupplierId || '')

  return (
    <form>
      {/* ...existing fields... */}

      {/* Add Replenishment Section */}
      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-3">Auto-Replenishment Settings</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Reorder Point</label>
            <Input
              type="number"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(Number(e.target.value))}
              placeholder="Minimum stock level to trigger reorder"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Alert when stock drops below this level
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Reorder Quantity</label>
            <Input
              type="number"
              value={reorderQty}
              onChange={(e) => setReorderQty(Number(e.target.value))}
              placeholder="How many units to reorder"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for automatic calculation (1.5x reorder point)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Preferred Supplier</label>
            <Select value={preferredSupplierId} onValueChange={setPreferredSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for automatic supplier selection (lowest lead time)
            </p>
          </div>
        </div>
      </div>

      {/* ...existing save button... */}
    </form>
  )
}
```

### 3. Add Notification Badge to Navigation

```typescript
// Show count of pending critical suggestions in navbar

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

function NavbarReplenishmentAlert({ orgId }) {
  const [criticalCount, setCriticalCount] = useState(0)

  useEffect(() => {
    const fetchCritical = async () => {
      const res = await fetch(`/api/replenishment/suggestions?orgId=${orgId}&status=pending&priority=critical`)
      const data = await res.json()
      if (data.success) {
        setCriticalCount(data.summary.criticalCount)
      }
    }

    fetchCritical()
    const interval = setInterval(fetchCritical, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [orgId])

  if (criticalCount === 0) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
      <AlertCircle className="w-4 h-4 text-red-600" />
      <span className="text-sm font-medium text-red-900">
        {criticalCount} Critical Stock Alert{criticalCount > 1 ? 's' : ''}
      </span>
      <Badge variant="destructive">{criticalCount}</Badge>
    </div>
  )
}
```

### 4. Add Background Job (Cloud Function)

**Create `functions/src/scheduled-replenishment.ts`:**

```typescript
import * as functions from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { generateReplenishmentSuggestions } from './lib/replenishment-engine'

export const scheduledReplenishment = functions.pubsub
  .schedule('0 2 * * *') // Every day at 2 AM
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    console.log('🔄 Starting scheduled replenishment check...')
    
    const db = getFirestore()
    
    // Get all organizations with replenishment enabled
    const orgsSnapshot = await db.collection('organizations')
      .where('features.autoReplenishment', '==', true)
      .get()

    let totalSuggestions = 0
    const results = []

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id
      const settings = orgDoc.data().replenishmentSettings || {}

      try {
        console.log(`📦 Checking org: ${orgId}`)
        const suggestions = await generateReplenishmentSuggestions(orgId, settings)
        
        totalSuggestions += suggestions.length
        results.push({
          orgId,
          suggestionsCount: suggestions.length,
          critical: suggestions.filter(s => s.priority === 'critical').length
        })

        // Send notifications if critical items found
        if (suggestions.some(s => s.priority === 'critical')) {
          await sendCriticalStockAlert(orgId, suggestions)
        }

        console.log(`✅ ${orgId}: Generated ${suggestions.length} suggestions`)
      } catch (error) {
        console.error(`❌ Error processing org ${orgId}:`, error)
        results.push({ orgId, error: error.message })
      }
    }

    // Log job result
    await db.collection('replenishment_jobs').add({
      jobType: 'scheduled',
      runAt: new Date().toISOString(),
      orgsProcessed: orgsSnapshot.size,
      totalSuggestions,
      results,
      status: 'completed'
    })

    console.log(`✅ Replenishment check complete: ${totalSuggestions} suggestions across ${orgsSnapshot.size} orgs`)
    return null
  })

async function sendCriticalStockAlert(orgId: string, suggestions: any[]) {
  // TODO: Implement email/notification sending
  const critical = suggestions.filter(s => s.priority === 'critical')
  console.log(`🚨 ALERT: ${critical.length} critical items for org ${orgId}`)
}
```

**Deploy:**
```bash
firebase deploy --only functions:scheduledReplenishment
```

### 5. Add to Vercel Cron (Alternative to Cloud Function)

**Create `app/api/cron/replenishment/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore'
import { generateReplenishmentSuggestions } from '@/lib/replenishment-engine'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getFirestore()
    const orgsRef = collection(db, 'organizations')
    const q = query(orgsRef, where('features.autoReplenishment', '==', true))
    const orgsSnapshot = await getDocs(q)

    let totalSuggestions = 0
    const results = []

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id
      const settings = orgDoc.data().replenishmentSettings || {}

      try {
        const suggestions = await generateReplenishmentSuggestions(orgId, settings)
        totalSuggestions += suggestions.length
        results.push({
          orgId,
          suggestionsCount: suggestions.length,
          critical: suggestions.filter(s => s.priority === 'critical').length
        })
      } catch (error: any) {
        results.push({ orgId, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      orgsProcessed: orgsSnapshot.size,
      totalSuggestions,
      results
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    )
  }
}
```

**Add to `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/replenishment",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 6. Add Permission Checks

```typescript
// In replenishment dashboard or API routes

function checkReplenishmentPermission(user: User) {
  const allowedRoles = ['admin', 'inventory_manager', 'purchase_manager']
  return user.role && allowedRoles.includes(user.role)
}

// In API route
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  
  if (!checkReplenishmentPermission(user)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }
  
  // ...rest of handler
}
```

### 7. Add Organization Settings

**Create settings page or add to existing org settings:**

```typescript
function ReplenishmentSettings({ orgId }) {
  const [settings, setSettings] = useState({
    enabled: false,
    autoApprove: false,
    autoApproveThreshold: 10000,
    safetyStockMultiplier: 1.5,
    notifyEmails: [],
    notifyInApp: true,
    priorityThresholds: {
      critical: 25,
      high: 50,
      medium: 75
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Replenishment Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label>Enable Auto-Replenishment</label>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <label>Auto-Approve Orders Under</label>
            <Input
              type="number"
              value={settings.autoApproveThreshold}
              onChange={(e) => 
                setSettings(prev => ({ ...prev, autoApproveThreshold: Number(e.target.value) }))
              }
              className="w-32"
            />
          </div>

          <div>
            <label>Safety Stock Multiplier</label>
            <Input
              type="number"
              step="0.1"
              value={settings.safetyStockMultiplier}
              onChange={(e) => 
                setSettings(prev => ({ ...prev, safetyStockMultiplier: Number(e.target.value) }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Multiplier for suggested quantities (1.5 = 50% extra safety stock)
            </p>
          </div>

          <div>
            <label>Notification Emails (comma-separated)</label>
            <Input
              value={settings.notifyEmails.join(', ')}
              onChange={(e) => 
                setSettings(prev => ({ 
                  ...prev, 
                  notifyEmails: e.target.value.split(',').map(s => s.trim()) 
                }))
              }
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          <Button onClick={() => saveSettings(orgId, settings)}>
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Testing Checklist

- [ ] Dashboard loads without errors
- [ ] Generate button creates suggestions
- [ ] Filters work (status, priority)
- [ ] Individual approve/reject works
- [ ] Batch selection works
- [ ] Bulk PO creation works
- [ ] Summary cards update after actions
- [ ] Product reorder settings save correctly
- [ ] Background cron job runs daily
- [ ] Notifications sent for critical items
- [ ] Permission checks prevent unauthorized access

---

## Next Steps

1. **Deploy Firestore indexes** (fix purchase_orders issue first)
2. **Add dashboard to navigation** (choose integration method)
3. **Update product forms** (add reorder fields)
4. **Set up cron job** (Cloud Function or Vercel)
5. **Configure org settings** (enable replenishment per org)
6. **Test with real data** (set reorder points on actual products)
7. **Monitor for a week** (adjust safety stock multipliers)
8. **Train users** (show workflow and best practices)

---

## Troubleshooting

**Dashboard doesn't show suggestions:**
- Check orgId is correct
- Verify products have reorderPoint set
- Check inventory is below reorder point
- Run manual generate to test

**Suggestions not generated automatically:**
- Verify cron job is deployed
- Check cron job logs for errors
- Ensure org has `features.autoReplenishment = true`
- Check Firestore indexes are deployed

**Approve/reject not working:**
- Check user authentication
- Verify userId is passed correctly
- Check Firestore permissions
- Look for errors in browser console

**PO creation fails:**
- Verify batchApproveAndCreatePO logic
- Check purchase_orders collection exists
- Ensure supplier data is complete
- Check Firestore transaction limits (max 500 writes)

---

For more details, see `AUTO_REPLENISHMENT_COMPLETE.md`
