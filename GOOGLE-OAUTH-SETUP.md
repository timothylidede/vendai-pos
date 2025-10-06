# Google OAuth Configuration Checker

## Step-by-Step: Verify Google OAuth Settings

### 1. Open Google Cloud Console

Go to: **https://console.cloud.google.com/apis/credentials**

Select project: **vendai-fa58c** (or your Firebase project name)

---

### 2. Locate Your OAuth 2.0 Client ID

Look for a client named something like:
- "Web client (auto created by Google Service)"
- "Web application" 
- Any OAuth 2.0 Client ID with type **"Web application"**

**⚠️ Important:** Do NOT use the "Desktop" client - that's for Electron app!

---

### 3. Check "Authorized JavaScript origins"

Click on your Web OAuth client, then scroll to **"Authorized JavaScript origins"**

**Required URLs:**
```
https://app.vendai.digital
https://vendai-pos.vercel.app
https://vendai-fa58c.firebaseapp.com
```

**How to add:**
1. Click "➕ ADD URI"
2. Paste the URL (include `https://`)
3. Click outside the field
4. Repeat for all URLs
5. Click **SAVE** at the bottom

---

### 4. Check "Authorized redirect URIs"

Scroll to **"Authorized redirect URIs"**

**Required URLs:**
```
https://app.vendai.digital/__/auth/handler
https://vendai-pos.vercel.app/__/auth/handler
https://vendai-fa58c.firebaseapp.com/__/auth/handler
```

**How to add:**
1. Click "➕ ADD URI"
2. Paste the EXACT URL (note the `/__/auth/handler` path!)
3. Click outside the field
4. Repeat for all URLs
5. Click **SAVE** at the bottom

---

### 5. Firebase Authorized Domains

Go to: **https://console.firebase.google.com/project/vendai-fa58c/authentication/settings**

Scroll to **"Authorized domains"**

**Required domains:**
```
app.vendai.digital
vendai-pos.vercel.app
```

**How to add:**
1. Click "Add domain"
2. Enter just the domain (no `https://` or paths)
3. Click "Add"
4. Repeat for both domains

---

## ✅ Verification Checklist

After making changes, verify:

- [ ] Google Cloud OAuth has 3 JavaScript origins
- [ ] Google Cloud OAuth has 3 redirect URIs
- [ ] All URIs start with `https://` (no `http://`)
- [ ] All redirect URIs end with `/__/auth/handler`
- [ ] Firebase has both domains listed
- [ ] You clicked **SAVE** in Google Cloud Console
- [ ] You waited 5-10 minutes for propagation

---

## 🧪 Test After Configuration

1. **Wait 5-10 minutes** for Google's systems to update
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Visit:** https://app.vendai.digital/auth-debug
4. **Check:** All items should be ✓ green
5. **Try signing in**

---

## 📸 Visual Guide

### What it should look like:

**Authorized JavaScript origins:**
```
┌─────────────────────────────────────────────┐
│ https://app.vendai.digital                  │
│ https://vendai-pos.vercel.app              │
│ https://vendai-fa58c.firebaseapp.com       │
└─────────────────────────────────────────────┘
```

**Authorized redirect URIs:**
```
┌─────────────────────────────────────────────────────┐
│ https://app.vendai.digital/__/auth/handler          │
│ https://vendai-pos.vercel.app/__/auth/handler      │
│ https://vendai-fa58c.firebaseapp.com/__/auth/handler│
└─────────────────────────────────────────────────────┘
```

---

## ❌ Common Mistakes

1. **Using the Desktop OAuth client** → Must use Web client
2. **Forgetting `https://`** → Required in JavaScript origins
3. **Wrong redirect path** → Must be `/__/auth/handler` (note double underscore)
4. **Not saving** → Must click SAVE button at bottom
5. **Testing too quickly** → Wait 5-10 minutes after changes

---

## 🔍 How to Find Your OAuth Client

If you can't find the right OAuth client:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Look for "OAuth 2.0 Client IDs" section
3. Find one with:
   - **Type:** Web application
   - **Created:** Auto-created by Firebase or manually created
4. If none exist, create one:
   - Click "➕ CREATE CREDENTIALS"
   - Select "OAuth client ID"
   - Application type: "Web application"
   - Name: "VendAI Web Client"
   - Add the origins and redirects as shown above

---

## 🚨 Still Getting Errors?

Run this in browser console on app.vendai.digital:

```javascript
console.log('Auth Domain:', firebase?.auth().app.options.authDomain);
console.log('Current Domain:', window.location.hostname);
```

Compare the outputs - they should be related!

---

## 📞 Need Help?

1. Visit: https://app.vendai.digital/auth-debug
2. Click "Copy Debug Info"
3. Check which item is ✗ red
4. Share the debug info for specific troubleshooting
