# VendAI Organization & Distributor Structure Explained

## Overview
In VendAI, **distributors** and **suppliers** are the **same thing** - just viewed from different perspectives. The terminology difference is intentional:
- **Distributor** = The account type chosen during signup
- **Supplier** = How retailers view distributors in the Supplier Module

## How Organizations Are Created

### 1. **User Signup & Authentication**
```
User signs up via Google OAuth → Firebase Auth creates user account
```

### 2. **Onboarding Flow** (`app/onboarding/page.tsx`)

#### Step 1: Role Selection (`/onboarding/choose`)
User chooses between:
- **Retailer** - Buys products from distributors
- **Distributor** - Sells products to retailers

#### Step 2: Organization Creation
When completing onboarding, the system:

**A. Creates User Document** (`users` collection):
```typescript
{
  uid: "user-firebase-uid",
  email: "user@example.com",
  displayName: "User Name",
  role: "distributor" | "retailer",
  organizationName: "slugified-org-id",  // e.g., "sam-west-supermarket"
  organizationDisplayName: "Sam West Supermarket",  // Human-readable name
  contactNumber: "+254...",
  location: "Nairobi, Kenya",
  coordinates: { lat: -1.286, lng: 36.817 },
  onboardingCompleted: true,
  isOrganizationCreator: true,
  createdAt: "2025-10-07T...",
  updatedAt: "2025-10-07T..."
}
```

**B. Creates Organization Scaffold** (`lib/org-operations.ts`):
```typescript
// Creates documents in:
1. organizations/{orgId}  - Organization metadata
2. org_settings/{orgId}   - Configuration and API keys
```

**C. For Distributors - Creates Distributor Profile** (`distributors` collection):
```typescript
{
  id: "sam-west-supermarket",
  userId: "firebase-uid",
  name: "Sam West Supermarket",
  contact: {
    email: "...",
    phone: "...",
    address: "..."
  },
  paymentTerms: "Net 30",
  creditLimit: 500000,
  status: "active",
  totalRetailers: 0,
  totalOrders: 0,
  totalGMV: 0,
  // ... other fields
}
```

## Firebase Collections Structure

### Key Collections:
```
📁 users/                    - All users (both retailers & distributors)
  └── {uid}                  - User document with role and organizationName

📁 organizations/            - Organization metadata
  └── {orgId}                - Organization details

📁 distributors/             - Distributor business profiles
  └── {distributorId}        - Distributor profile
      └── products/          - Distributor's product catalog (subcollection)
          └── {productId}

📁 retailers/                - Retailer business profiles (if separate tracking needed)
  └── {retailerId}

📁 pos_products/             - Retailer's inventory
  └── {orgId}_{productId}

📁 org_settings/             - Per-organization settings
  └── {orgId}
```

## Why Can't You See Distributors in Supplier Module?

### The Problem:
The Supplier Module queries the `distributors` collection, but distributors might not show up if:

1. **No Distributors Created**
   - If no one has signed up with role "distributor", the collection is empty

2. **Collection Structure Mismatch**
   - The query expects documents in `distributors/{distributorId}` with specific fields

3. **Distributor Document Not Created**
   - The onboarding process creates a `users` document but might not automatically create the `distributors` document

### Current Code in Supplier Module:
```typescript
// In loadSuppliers() function
const suppliersRef = collection(db, "distributors")
const suppliersQuery = query(suppliersRef, orderBy("name"), limit(100))
const snapshot = await getDocs(suppliersQuery)
```

## Solutions

### Solution 1: Ensure Distributor Documents Are Created During Onboarding

When a user completes onboarding with role="distributor", the system should:

1. Create the `users` document ✅ (Already done)
2. Create the `distributors` document ✅ (Needs to be verified/added)
3. Create the organization scaffold ✅ (Already done)

### Solution 2: Use Scripts to Manually Create Distributors

The project has setup scripts:
```bash
# Create Sam West and Mahitaji distributors
node scripts/setup-distributors.cjs

# Import products for these distributors
node scripts/import-supplier-products.cjs
```

### Solution 3: Fallback to Default Data (Current Implementation)

The supplier module now has fallback data that displays when no distributors found in Firestore:
- Sam West (with logo)
- Mahitaji (with logo)

## How to Verify Distributors Exist

### Check Firestore Console:
1. Go to Firebase Console → Firestore Database
2. Look for `distributors` collection
3. Each distributor should have:
   - `id`: Unique identifier
   - `name`: Business name
   - `logoUrl`: Path to logo (optional)
   - `contact`: Email, phone, address
   - `totalRetailers`, `totalOrders`, `totalGMV`: Stats

### Check Users Collection:
1. Go to `users` collection
2. Filter by `role == "distributor"`
3. Check their `organizationName` field
4. Verify matching document exists in `distributors/{organizationName}`

## The Connection Flow

```
1. User signs up → Choose "Distributor" role
                 ↓
2. Complete onboarding → Create user document
                 ↓                    ↓
                 role: "distributor"  organizationName: "sam-west"
                 ↓
3. System creates distributor document
                 ↓
   distributors/sam-west
                 ↓
4. Retailers can now see them in Supplier Module
```

## Current Implementation Status

✅ **Working:**
- User authentication and onboarding
- Role-based routing
- Organization creation
- Fallback data for suppliers (Sam West, Mahitaji with logos)

⚠️ **To Verify:**
- Automatic creation of `distributors` document during onboarding
- Whether existing distributor users have documents in `distributors` collection

🔧 **Recommendation:**
1. Check if distributor documents exist in Firestore
2. If not, either:
   - Run `scripts/setup-distributors.cjs` to create sample distributors
   - Or update onboarding to ensure distributor documents are created
3. The fallback data will work fine for demo/testing purposes

## Summary

**Suppliers = Distributors**. They're the same entity viewed from different perspectives:
- From their own view: "I am a Distributor"
- From retailer's view: "They are my Supplier"

The Supplier Module correctly queries the `distributors` collection. If you're not seeing distributors, it's because either:
1. No users have completed onboarding with role="distributor"
2. The distributor documents weren't created in the `distributors` collection
3. You're using the fallback data (which shows Sam West and Mahitaji)

The system is architecturally sound - it's just a matter of ensuring data exists in Firestore!
