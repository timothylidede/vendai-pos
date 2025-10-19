# Google Auth Test Checklist for Localhost

## Step 1: Verify Google Cloud Console Setup

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your Web OAuth Client ID
3. Check **Authorized JavaScript origins** includes:
   ```
   http://localhost:3000
   http://localhost
   ```

4. Check **Authorized redirect URIs** includes:
   ```
   http://localhost:3000/__/auth/handler
   https://vendai-fa58c.firebaseapp.com/__/auth/handler
   ```

## Step 2: Test the Flow

1. Open browser to `http://localhost:3000/`
2. Open DevTools (F12) → Console tab
3. Click "Continue with Google"
4. Watch the console for:
   - ✅ `🔄 Starting Google sign-in redirect...` (from our code)
   - ✅ Should redirect to `accounts.google.com` (Google's login page)
   - ✅ After selecting account, should redirect to `vendai-fa58c.firebaseapp.com/__/auth/handler`
   - ✅ Then back to `http://localhost:3000/`
   - ✅ `✅ Redirect authentication successful` (from our code)

## Step 3: What to Look For

### If you see: "The requested action is invalid"
- The redirect URI is not configured correctly in Google Cloud Console
- OR the authDomain in Firebase config doesn't match

### If nothing happens:
- Check browser console for errors
- Popup might be blocked (but we're using redirect, so this shouldn't happen)

### If it redirects but comes back with no sign-in:
- Check console for `getRedirectResult` errors
- May be a cookie/CORS issue

## Step 4: Run This Test

In your browser console on `http://localhost:3000/`, paste this:

```javascript
// Test Firebase Auth is initialized
console.log('Auth Domain:', auth?.app?.options?.authDomain);
console.log('Project ID:', auth?.app?.options?.projectId);
console.log('Google Provider:', !!googleProvider);

// Test redirect
import { signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

signInWithRedirect(auth, googleProvider)
  .then(() => console.log('✅ Redirect initiated'))
  .catch(err => console.error('❌ Redirect failed:', err));
```

## Share These Results

After testing, tell me:
1. What errors appear in the console?
2. What URL does it redirect to?
3. Does it come back to localhost?
4. What error message (if any) shows on screen?
