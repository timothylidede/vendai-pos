# Onboarding Changes Implementation Plan

## Completed ✅
1. **Images bigger** - Changed from h-16 w-16 to h-24 w-24
2. **Website required for online** - Already implemented (line 1045)
3. **Data structure updated** - Added `phoneNumber` and `facebookHandle` fields
4. **Stacks.jpg added** - Added to payment terms step

## Remaining Changes

### 1. Phone Number Collection Step
- Add after role selection for BOTH retailer and distributor
- Make it step 1 (after role, before other steps)
- Increment all subsequent steps
- Update totalSteps calculation
- Update step validation logic
- Add phone number to backend save

### 2. County/SubCounty for "Set Manually" Option
- Already have kenyanCounties data structure
- Need to add UI for manual selection when user clicks "Set manually" in brick-and-mortar store details
- Add dropdown for county selection
- Add dropdown for subcounty selection (filtered by selected county)

### 3. Change "Organization" to "Brand" for Distributors
- Step 1 title: "What's your brand name and basic details?"
- All "organization" references to "brand" in distributor flow
- Update labels, placeholders, descriptions

### 4. Add Facebook Field for Distributor
- Add optional Facebook field in distributor basic details step (step 1)
- Format: @username or full URL

### 5. Update Distributor Primary Category
- Replace current distributor categories with retailer categories (storeCategories)
- Update the dropdown to use the same categories

### 6. Backend Configuration
- Ensure phoneNumber is saved to Firestore
- Ensure facebookHandle is saved
- Ensure county/subcounty saved for retailers
- Verify all fields are in the profile document

### 7. Distributor Welcome Email
- Create email template (similar to retailer welcome)
- Trigger on distributor account creation
- Location: Check email service/function

### 8. Redirect Distributors to Distributor Dashboard
- Update login redirect logic
- Check current redirect in login/auth flow
- Ensure distributors go to distributor-specific dashboard

## File Locations
- Onboarding: `app/onboarding/page.tsx`
- Auth/Login: Check `contexts/auth-context.tsx` or login page
- Email functions: Check `lib/` or Firebase functions
- Backend save: Lines 300-450 in onboarding page

## Step Order After Phone Number Addition

### Retailers (7 steps total):
0. Role selection
1. Phone number ← NEW
2. Sales channels
3. Store details
4. Category
5. Opening year
6. Payment terms

### Distributors (8 steps total):
0. Role selection  
1. Phone number ← NEW
2. Brand name + website + instagram + facebook
3. Fulfillment email
4. Product count
5. Store count
6. Primary category (use retailer categories)
7. Hear about us
