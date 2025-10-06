# Debugging Authentication Issues on Vercel (app.vendai.digital)

## Error: "An error occurred during sign in. Please try again."

This error appears when Google Sign-In fails on your Vercel deployment. Here are the most common causes and how to fix them:

---

## 🔍 **Root Causes & Solutions**

### 1. **Authorized Domains Not Configured (MOST COMMON)**

Firebase needs to know which domains are allowed to use authentication.

**Check if app.vendai.digital is authorized:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `vendai-fa58c`
3. Navigate to: **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"** and add:
   - `app.vendai.digital`
   - `vendai-pos.vercel.app` (your Vercel domain)
   - `*.vercel.app` (for preview deployments)

**Current error check:** Look in your browser console - if you see `auth/unauthorized-domain`, this is the issue.

---

### 2. **Google OAuth Client ID Not Configured for Web**

The Google OAuth consent screen needs your production domain.

**Update Google Cloud Console:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to: **APIs & Services** → **Credentials**
4. Find your **Web OAuth 2.0 Client ID** (NOT Desktop client)
5. Under **Authorized JavaScript origins**, add:
   - `https://app.vendai.digital`
   - `https://vendai-pos.vercel.app`
6. Under **Authorized redirect URIs**, add:
   - `https://app.vendai.digital/__/auth/handler`
   - `https://vendai-pos.vercel.app/__/auth/handler`
   - `https://vendai-fa58c.firebaseapp.com/__/auth/handler`

---

### 3. **Missing Environment Variables on Vercel**

Your Firebase config might not be set correctly in Vercel.

**Verify Vercel Environment Variables:**

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Ensure these are set for **Production**, **Preview**, and **Development**:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDAH3xcghGGn1pQez0fczy6rBP9qqBWfx0
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vendai-fa58c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=vendai-fa58c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vendai-fa58c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1002924595563
NEXT_PUBLIC_FIREBASE_APP_ID=1:1002924595563:web:69923ed21eb2d2a075142e
```

**After adding/updating:** Redeploy your application!

---

### 4. **Browser Console Debugging**

**Open your browser console on app.vendai.digital and check for:**

```javascript
// Look for these logs when you click "Sign In with Google"
🚀 Starting authentication process...
- Is Electron: false
- Firebase Config Auth Domain: vendai-fa58c.firebaseapp.com

// Error codes to look for:
auth/unauthorized-domain        → Fix #1: Add domain to Firebase
auth/popup-blocked             → User needs to allow popups
auth/network-request-failed    → Check internet/firewall
auth/invalid-api-key           → Fix #3: Check env vars
```

---

## 🛠️ **Quick Debugging Steps**

### Step 1: Check Browser Console
```bash
1. Open app.vendai.digital
2. Press F12 (DevTools)
3. Go to Console tab
4. Click "Sign In with Google"
5. Look for error codes (auth/...)
```

### Step 2: Test Firebase Config
Add this temporarily to your welcome page to verify config:

```typescript
console.log('Firebase Auth Domain:', auth?.app?.options?.authDomain);
console.log('Current Domain:', window.location.hostname);
```

### Step 3: Test Google OAuth Popup
Try this in console:
```javascript
// Should open Google sign-in popup
firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
```

---

## 🔧 **Immediate Fixes**

### Fix A: Add Better Error Logging

The current error handler is generic. Let's add more specific logging.

**Check `components/welcome-page.tsx` lines 75-124** - I can update this to show:
- Exact Firebase error codes
- Network status
- Current configuration
- Which domain is being used

### Fix B: Add Health Check Endpoint

Create `/api/health` to verify:
- Firebase connection
- Environment variables loaded
- OAuth configuration

---

## 📋 **Checklist for Production**

- [ ] Firebase Authorized Domains includes `app.vendai.digital`
- [ ] Google Cloud OAuth includes `app.vendai.digital` in origins
- [ ] Google Cloud OAuth includes `https://app.vendai.digital/__/auth/handler` in redirects
- [ ] Vercel env variables are set for Production
- [ ] Latest deployment includes all environment variables
- [ ] Browser allows popups for app.vendai.digital
- [ ] User internet connection is stable

---

## 🚀 **Testing After Fixes**

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** the page (Ctrl+F5)
3. **Open in incognito** mode
4. Try sign-in again

---

## 📞 **Still Not Working?**

If you've completed all steps above and still have issues, the error is likely:

1. **DNS propagation delay** (if domain was just added) - wait 5-10 minutes
2. **Popup blocked by browser** - check browser popup settings
3. **AdBlocker interference** - disable for this site
4. **Corporate firewall** blocking Google OAuth

---

## 🔍 **Advanced Debugging**

Run these commands in browser console on app.vendai.digital:

```javascript
// Check if Firebase is initialized
console.log('Auth instance:', window.firebase?.auth);

// Check current auth state
console.log('Current user:', window.firebase?.auth()?.currentUser);

// Check popup ability
window.open('about:blank', '_blank');
```

---

## 📝 **Next Steps**

Would you like me to:

1. ✅ **Add enhanced error logging** to the welcome page
2. ✅ **Create a health check API endpoint** to verify Firebase config
3. ✅ **Add a debug mode** that shows detailed auth information
4. ✅ **Create a test page** specifically for diagnosing auth issues

Let me know which you'd prefer, or I can implement all of them!
