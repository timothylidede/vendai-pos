# 🚀 Quick Guide: Fix "An error occurred during sign in" on app.vendai.digital

## **Most Likely Fix (90% of cases)**

### ✅ **Step 1: Add Authorized Domain to Firebase**

1. Go to: https://console.firebase.google.com/project/vendai-fa58c/authentication/settings
2. Scroll to **"Authorized domains"**
3. Click **"Add domain"**
4. Add these domains:
   ```
   app.vendai.digital
   vendai-pos.vercel.app
   ```
5. Click **Save**

### ✅ **Step 2: Update Google OAuth Settings**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your **Web OAuth 2.0 Client ID**
3. Under **"Authorized JavaScript origins"**, add:
   ```
   https://app.vendai.digital
   https://vendai-pos.vercel.app
   ```
4. Under **"Authorized redirect URIs"**, add:
   ```
   https://app.vendai.digital/__/auth/handler
   https://vendai-pos.vercel.app/__/auth/handler
   https://vendai-fa58c.firebaseapp.com/__/auth/handler
   ```
5. Click **Save**

### ✅ **Step 3: Verify Vercel Environment Variables**

1. Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables
2. Ensure these are set for **Production**:
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDAH3xcghGGn1pQez0fczy6rBP9qqBWfx0
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vendai-fa58c.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=vendai-fa58c
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vendai-fa58c.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1002924595563
   NEXT_PUBLIC_FIREBASE_APP_ID=1:1002924595563:web:69923ed21eb2d2a075142e
   ```
3. **Important**: After adding/changing vars, click **"Redeploy"**

---

## 🔍 **Diagnostic Tools Now Available**

### 1. **Health Check Endpoint**
Visit: `https://app.vendai.digital/api/auth/health`

Shows:
- ✓ Firebase configuration status
- ✓ Environment variables loaded
- ✓ Server health

### 2. **Debug Dashboard**
Visit: `https://app.vendai.digital/auth-debug`

Shows:
- ✓ Browser compatibility
- ✓ Firebase initialization status
- ✓ Popup blocker status
- ✓ Current authentication state
- ✓ Domain configuration
- ✓ Downloadable debug report

---

## 🧪 **Quick Test After Fixes**

1. Clear browser cache (Ctrl+Shift+Delete)
2. Visit: `https://app.vendai.digital/auth-debug`
3. Check all items are ✓ green
4. If all green, try signing in
5. If issues persist, check browser console for error codes

---

## 📊 **What Changed**

### Enhanced Error Logging
`components/welcome-page.tsx` now logs:
- Current domain vs Firebase auth domain
- Firebase configuration status
- Detailed error codes
- Browser compatibility info

### New API Endpoints
- `/api/auth/health` - Server-side config check
- `/auth-debug` - Client-side diagnostic page

---

## 🔴 **Common Error Codes & Fixes**

| Error Code | Meaning | Fix |
|------------|---------|-----|
| `auth/unauthorized-domain` | Domain not in Firebase | Complete Step 1 above |
| `auth/popup-blocked` | Browser blocking popup | Allow popups for this site |
| `auth/network-request-failed` | Network issue | Check internet/firewall |
| `auth/invalid-api-key` | Wrong API key | Check Step 3 above |
| Generic error message | Multiple possible causes | Use `/auth-debug` page |

---

## 💡 **Pro Tips**

1. **Wait 5-10 minutes** after making Firebase/Google Cloud changes
2. **Test in incognito** mode to rule out cache issues
3. **Check DNS propagation** if domain was just added
4. **Disable browser extensions** (especially ad blockers) for testing
5. **Use Chrome DevTools** → Console tab to see real-time errors

---

## 📞 **Still Not Working?**

1. Visit: `https://app.vendai.digital/auth-debug`
2. Click "Copy Debug Info"
3. Check browser console for error codes
4. Share the debug info for support

---

## 🎯 **Expected Behavior After Fixes**

✅ Click "Sign In with Google"
✅ Google popup opens
✅ Select Google account
✅ Popup closes automatically
✅ Redirect to /onboarding or /modules

---

**Estimated fix time: 5-10 minutes + DNS propagation**
