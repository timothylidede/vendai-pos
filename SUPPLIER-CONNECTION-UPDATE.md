# Supplier Connection System Update

## Overview
Updated the supplier module to add real connection tracking with Firebase and improved distributor metadata.

## Changes Made

### 1. **Distributor Metadata Updates**

#### Sam West Distributors Ltd
- **New Display Name**: Sam West Distributors Ltd
- **Updated Location**: 100 Dagoretti Rd, Nairobi
- **Coordinates**: -1.2921, 36.7516
- **Stats Updated**: 
  - `totalProducts` replaces `totalGMV` (20 products)
  - `totalRetailers` now reflects actual Firebase connections (starts at 0)

#### Mahitaji Enterprises Ltd
- **New Display Name**: Mahitaji Enterprises Ltd
- **Updated Location**: Baba Dogo Rd, Nairobi
- **Coordinates**: -1.2297, 36.8831
- **Stats Updated**:
  - `totalProducts` replaces `totalGMV` (20 products)
  - `totalRetailers` now reflects actual Firebase connections (starts at 0)

### 2. **Firebase Connection System**

#### Firebase Collection: `distributorConnections`
Document structure:
```typescript
{
  retailerId: string           // Organization name of the retailer
  retailerName: string        // Display name of the retailer
  distributorId: string       // Distributor ID (sam-west or mahitaji)
  distributorName: string     // Display name of the distributor
  connectedAt: string         // ISO timestamp
  status: "active"            // Connection status
}
```

Document ID format: `{retailerOrganizationName}_{distributorId}`

Example: `"shoprite_sam-west"`

#### Features
- **Real-time Connection Tracking**: Uses Firebase Firestore to track connections
- **Dynamic Retailer Count**: Queries Firebase to count connected retailers per distributor
- **Connection Status**: Each retailer sees their own connection status per distributor

### 3. **UI Updates**

#### Supplier List View
- **Connect/Connected Button**: Added to each supplier card
  - Shows "Connect" button if not connected (purple themed)
  - Shows "Connected" button if already connected (outlined style)
  - Prevents card click when clicking button (stopPropagation)
- **Updated Stats Display**:
  - Retailers: Shows real count from Firebase
  - Orders: Shows total fulfilled orders
  - Products: Shows number of products (replaces GMV)

#### Supplier Detail View
- **Connect/Disconnect Button**: In the action area
  - "Connect" button when not connected (purple themed)
  - "Disconnect" button when connected (rose/red themed)
- **Conditional Product Access**:
  - Products only load if connected
  - Shows informational message if not connected:
    - Icon with package symbol
    - "Connect to view products"
    - Instructions to click Connect button
- **Updated Stats Cards**:
  - Retailers connected (with Users icon)
  - Orders fulfilled (with ShoppingCart icon)
  - Products (with Package icon, replaces GMV)
  - Payment terms (with Building2 icon)

### 4. **Code Changes**

#### New Imports
```typescript
import { doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs, getCountFromServer } from "firebase/firestore"
import { db } from "@/lib/firebase"
```

#### New Function: `handleConnectSupplier`
Handles connecting/disconnecting retailers to/from distributors:
- Creates/deletes documents in `distributorConnections` collection
- Shows toast notifications
- Refreshes supplier list to reflect changes
- Updates selected supplier state if viewing details

#### Updated Function: `loadSuppliers`
- Queries Firebase for connection status per retailer
- Counts total retailers connected to each distributor
- Uses `organizationName` from userData (not organizationId)
- Returns dynamic retailer counts

#### Updated TypeScript Interface
```typescript
// data/distributor-data.ts
export interface DistributorStats {
  totalRetailers: number      // Now dynamically loaded from Firebase
  totalOrders: number
  totalProducts: number        // Replaces totalGMV
  averageOrderValue: number
  onTimeDeliveryRate: number
}

export interface DistributorLocation {
  city: string
  country: string
  address: string              // New field for full address
  coordinates: {
    lat: number
    lng: number
  }
}
```

### 5. **Data Files Updated**

#### `data/distributors/sam-west.json`
```json
{
  "displayName": "Sam West Distributors Ltd",
  "contact": {
    "address": "100 Dagoretti Rd, Nairobi"
  },
  "location": {
    "address": "100 Dagoretti Rd, Nairobi",
    "coordinates": {
      "lat": -1.2921,
      "lng": 36.7516
    }
  },
  "stats": {
    "totalRetailers": 0,
    "totalProducts": 20
  }
}
```

#### `data/distributors/mahitaji.json`
```json
{
  "displayName": "Mahitaji Enterprises Ltd",
  "contact": {
    "address": "Baba Dogo Rd, Nairobi"
  },
  "location": {
    "address": "Baba Dogo Rd, Nairobi",
    "coordinates": {
      "lat": -1.2297,
      "lng": 36.8831
    }
  },
  "stats": {
    "totalRetailers": 0,
    "totalProducts": 20
  }
}
```

## Firebase Rules Required

Add to `firestore.rules`:
```
match /distributorConnections/{connectionId} {
  allow read: if request.auth != null && 
    request.auth.token.role == 'retailer';
  
  allow write: if request.auth != null && 
    request.auth.token.role == 'retailer' &&
    connectionId.matches('^' + get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationName + '_.*$');
}
```

## Testing Checklist

- [ ] Retailer can see all distributors
- [ ] Connect button appears for unconnected distributors
- [ ] Click Connect creates Firebase document
- [ ] Connected button appears after connection
- [ ] Retailer count increases when retailer connects
- [ ] Products are hidden until connected
- [ ] Products load after connecting
- [ ] Disconnect button works
- [ ] Retailer count decreases when retailer disconnects
- [ ] Products are hidden after disconnecting
- [ ] Multiple retailers can connect to same distributor
- [ ] Each retailer sees only their own connection status

## Future Enhancements

1. **Approval Workflow**: Add distributor approval before connection is active
2. **Connection Requests**: Store pending requests for distributor review
3. **Credit Limits**: Track per-connection credit limits
4. **Order History**: Show orders per connection
5. **Notifications**: Notify distributors when retailers connect
6. **Analytics**: Track connection rates and patterns
7. **Bulk Operations**: Allow distributors to bulk approve/reject requests
