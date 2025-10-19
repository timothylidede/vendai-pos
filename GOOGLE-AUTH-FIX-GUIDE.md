# Google Sign-In Fix Guide for app.vendai.digital

## Issues Found from Auth Debug Page

### ✗ Issue 1: Domain Mismatch (CRITICAL)
**Problem:** Your app runs on `app.vendai.digital` but Firebase Auth only allows `vendai-fa58c.firebaseapp.com`

**Fix:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `vendai-fa58c`
3. Click **Authentication** in left sidebar
4. Click **Settings** tab
5. Click **Authorized domains**
6. Click **Add domain** button
7. Enter: `app.vendai.digital`
8. Click **Add**

**Also add these domains for development:**
- `localhost`
- `127.0.0.1`

---

### ✗ Issue 2: Browser Blocking Popups
**Problem:** Browser may block the Google Sign-In popup

**Fix Options:**

#### Option A: Allow Popups (User Side)
1. Look for popup blocker icon in browser address bar
2. Click and select "Always allow popups from app.vendai.digital"
3. Refresh the page

#### Option B: Use Redirect Instead (Already Implemented)
Your code already has a fallback to redirect if popup fails. This should work automatically.

---

### ✓ Issue 3: Cookies Enabled
**Status:** This should already be enabled. If not:
1. Browser Settings → Privacy & Security → Cookies
2. Enable "Allow all cookies" or add exception for `app.vendai.digital`

---

### ✓ Issue 4: Internet Connection
**Status:** Should be working. If not, check your network.

---

### ✗ Issue 5: Server Environment Variables
**Problem:** Vercel environment variables may not be configured

**Fix:**
1. Go to [Vercel Dashboard](https://vercel.com/)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables (if not present):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDAH3xcghGGn1pQez0fczy6rBP9qqBWfx0
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vendai-fa58c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=vendai-fa58c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vendai-fa58c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1002924595563
NEXT_PUBLIC_FIREBASE_APP_ID=1:1002924595563:web:69923ed21eb2d2a075142e
```

5. Redeploy your app after adding variables

---

## Quick Test

After fixing the domain issue:

1. Clear browser cache
2. Go to `https://app.vendai.digital/`
3. Click "Continue with Google"
4. Popup should open showing Google account picker
5. Select your account
6. You should be signed in

---

## Still Not Working?

Visit `https://app.vendai.digital/auth-debug` to see updated diagnostic info.

### Additional Checks:

1. **Check Firebase Console Logs:**
   - Firebase Console → Authentication → Users
   - Check if sign-in attempts are showing up

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for red error messages
   - Share them for debugging

3. **Try Incognito Mode:**
   - Test in browser's incognito/private mode
   - This eliminates cache/extension issues

---

## How the Current Implementation Works

Your app uses **Firebase Authentication SDK v9** (modern, recommended):

```typescript
// In lib/firebase.ts
googleProvider.setCustomParameters({
  prompt: 'select_account'  // Shows account chooser
});

// In welcome-page.tsx
// 1. Try popup (opens new window with Google)
const result = await signInWithPopup(auth, googleProvider);

// 2. If popup blocked, fall back to redirect
await signInWithRedirect(auth, googleProvider);
```

This is the **correct modern approach**, NOT the deprecated `gapi.auth2` library.

---

## Priority Actions (Do These First)

1. ✅ **Add `app.vendai.digital` to Firebase Authorized Domains** (5 minutes)
2. ✅ **Verify environment variables in Vercel** (2 minutes)
3. ✅ **Test sign-in** (1 minute)
4. ✅ **Check auth-debug page** (1 minute)

Total time: ~10 minutes

---

## Need Help?

If still not working after following this guide, please share:
1. Screenshot from `/auth-debug` page
2. Browser console errors (F12 → Console tab)
3. Firebase Console → Authentication → Sign-in method status
