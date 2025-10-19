# SOLUTION: Enable Identity Toolkit API

## The Error
```
GET https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig 403 (Forbidden)
Unable to verify that the app domain is authorized
```

## Root Cause
The **Identity Toolkit API** is disabled or restricted for your Firebase project.

## Fix Steps

### Step 1: Enable Identity Toolkit API

1. Go to: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=vendai-fa58c

2. Click **"ENABLE"** button

3. Wait for it to activate (takes 10-30 seconds)

### Step 2: Check API Key Restrictions

1. Go to: https://console.cloud.google.com/apis/credentials?project=vendai-fa58c

2. Find your API key: `AIzaSyDAH3xcghGGn1pQez0fczy6rBP9qqBWfx0`

3. Click on it to edit

4. Check **"API restrictions"** section:
   - If it says "Restrict key" → Make sure **"Identity Toolkit API"** is in the list
   - OR set to **"Don't restrict key"** (less secure but works for testing)

5. Check **"Website restrictions"** section:
   - Should include:
     - `http://localhost:3000/*`
     - `https://app.vendai.digital/*`
     - `https://vendai-fa58c.firebaseapp.com/*`

### Step 3: Test Again

1. Clear browser cache (Ctrl+Shift+Delete)
2. Go to `http://localhost:3000/`
3. Click "Continue with Google"
4. Should work now!

## Alternative Quick Fix

If enabling APIs is complicated, you can also:

1. Create a **NEW API key** without restrictions
2. Use it in your `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-new-unrestricted-key
   ```
3. Restart dev server

---

## After Fix

The flow should be:
1. Click "Continue with Google"
2. Redirects to `accounts.google.com`
3. Select your Google account
4. Redirects to `vendai-fa58c.firebaseapp.com/__/auth/handler`
5. Handler verifies and redirects back to `localhost:3000`
6. You're signed in ✅
