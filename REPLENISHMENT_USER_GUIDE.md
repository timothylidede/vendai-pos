# 🎯 Quick Guide: Auto-Replenishment in Supplier Module

## Where to Find It

**Navigation**: Main Dashboard → **Suppliers** → **Auto-Replenishment** tab

```
┌─────────────────────────────────────────┐
│  Suppliers Module                       │
├─────────────────────────────────────────┤
│  [Supplier] [Auto-Replenishment] ← NEW! │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  📊 Summary Cards                 │ │
│  │  • Total: 45 suggestions          │ │
│  │  • Critical: 5 items              │ │
│  │  • Cost: ₹125,000                 │ │
│  └───────────────────────────────────┘ │
│                                         │
│  🔍 Filters: [Status ▼] [Priority ▼]  │
│                                         │
│  📦 Suggestion List:                   │
│  ┌───────────────────────────────────┐ │
│  │ ☐ Product A - 20/50 stock        │ │
│  │   Critical • ₹5,000               │ │
│  │   [Approve] [Reject]              │ │
│  ├───────────────────────────────────┤ │
│  │ ☐ Product B - 35/100 stock       │ │
│  │   High • ₹3,500                   │ │
│  │   [Approve] [Reject]              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Generate Suggestions] [Create PO(2)] │
└─────────────────────────────────────────┘
```

## 3-Step Workflow

### Step 1: Setup Products (One-time)
```
Inventory Module
└── Edit Product
    ├── Set Reorder Point: 50 pieces
    ├── Set Reorder Qty: 100 pieces (optional)
    └── Save
```

### Step 2: Generate Suggestions
```
Suppliers → Auto-Replenishment Tab
└── Click "Generate Suggestions"
    ├── System checks all products
    ├── Compares stock vs reorder point
    └── Creates suggestions with priorities
```

### Step 3: Approve & Order
```
Review Suggestions
├── Check boxes for items to order
├── Click "Create PO" button
└── Purchase order created automatically
```

## What You See

### Summary Cards (Top of Dashboard)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total: 45    │ Critical: 5  │ Cost: ₹125k  │ Approved: 10 │
│ 30 pending   │ Need action  │ Pending      │ Ready for PO │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Filters
```
Status:   [All Status ▼]  → Pending/Approved/Rejected/Ordered
Priority: [All Priority ▼] → Critical/High/Medium/Low
[Select All Pending]       → Quick batch selection
```

### Each Suggestion Shows
```
┌─────────────────────────────────────────────────────────┐
│ ☐ Coca Cola 500ml                                       │
│ SKU: COKE-500 | Supplier: Acme Distributors             │
│                                                          │
│ Current: 20 | Reorder: 50 | Suggested: 75 | Cost: ₹5,000│
│ Lead Time: 5 days | Unit Cost: ₹67                      │
│                                                          │
│ [CRITICAL] ← Priority Badge (color-coded)               │
│                                                          │
│ Reason: Stock below 25% of reorder point                │
│                                                          │
│ [✓ Approve] [✗ Reject]                                  │
└─────────────────────────────────────────────────────────┘
```

## Priority Levels

```
🔴 CRITICAL (≤25% stock)  - Immediate action needed
🟠 HIGH     (≤50% stock)  - Order soon
🟡 MEDIUM   (≤75% stock)  - Monitor closely
🔵 LOW      (>75% stock)  - No rush
```

## Actions Available

### Individual Actions
- **Approve** - Mark suggestion for ordering
- **Reject** - Dismiss suggestion (not needed)

### Batch Actions
- **Select Multiple** - Check boxes on suggestions
- **Create PO** - Generate purchase order from selected items
- **Select All Pending** - Quick select all pending suggestions

### Refresh
- **Generate Suggestions** - Manual trigger for new check
- **Auto-refresh** - Dashboard updates after each action

## Example Workflow

```
1. Morning Check
   ├── Open Suppliers → Auto-Replenishment
   ├── See 5 critical items
   └── Review suggestions

2. Review & Decide
   ├── Critical item: Approve ✓
   ├── High priority: Approve ✓
   ├── Medium: Check stock manually
   └── Low: Reject (supplier changed)

3. Create Order
   ├── Select 2 approved items
   ├── Click "Create PO"
   ├── PO-001 created
   └── Items marked as "ordered"

4. Next Day
   ├── Generate new suggestions
   ├── See 3 new items
   └── Repeat workflow
```

## Tips & Best Practices

### Setting Reorder Points
```
High-velocity items (sell fast):
├── Reorder Point: Higher (e.g., 100 pieces)
└── Check frequency: Daily

Low-velocity items (sell slow):
├── Reorder Point: Lower (e.g., 20 pieces)
└── Check frequency: Weekly

Seasonal items:
├── Adjust reorder points by season
└── Higher in peak season
```

### Safety Stock Multiplier
```
System automatically adds 50% safety stock:
├── Reorder Point: 50
├── Suggested Qty: 75 (50 × 1.5)
└── Prevents immediate re-triggering
```

### Supplier Selection
```
If multiple suppliers for same product:
├── System picks fastest (lowest lead time)
├── Or uses your preferred supplier (if set)
└── Shows supplier name in suggestion
```

## Keyboard Shortcuts

```
Space     - Toggle checkbox selection
Enter     - Approve selected suggestion
Delete    - Reject selected suggestion
Ctrl+A    - Select all pending
Ctrl+G    - Generate new suggestions
```

## Troubleshooting

### No suggestions appearing?
- ✓ Check products have `reorderPoint` set
- ✓ Verify stock levels are below reorder point
- ✓ Click "Generate Suggestions" button
- ✓ Check filters (not filtering out results)

### Can't approve suggestion?
- ✓ Verify you have organization set up
- ✓ Check user permissions
- ✓ Ensure product has supplier mapped

### PO creation fails?
- ✓ Select at least one suggestion
- ✓ Verify suggestions are approved
- ✓ Check supplier data is complete

---

## 🎓 Learn More

- **Full Documentation**: `AUTO_REPLENISHMENT_COMPLETE.md`
- **API Reference**: `REPLENISHMENT_INTEGRATION_GUIDE.md`
- **Technical Details**: `docs/AUTO_REPLENISHMENT_IMPLEMENTATION.md`

---

**Quick Access**: Main Dashboard → Suppliers → Auto-Replenishment Tab

**Status**: ✅ Fully Integrated & Ready to Use!
