# 🔐 Auth Domain Update & Production Deployment Guide

## ✅ Local Environment Updated
Your local `.env.local` has been updated:
- **OLD**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vendai-fa58c.firebaseapp.com`
- **NEW**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth.vendai.digital`

## 🚀 Update Production Environment Variables

### Option 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `vendai-pos`

2. **Navigate to Environment Variables**
   - Click on **Settings** tab
   - Click on **Environment Variables** in the left sidebar

3. **Update the Variable**
   - Find: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - Click the **⋮** (three dots) → **Edit**
   - Change value to: `auth.vendai.digital`
   - Make sure **Production** is checked
   - Click **Save**

4. **Trigger Redeploy**
   - Go to **Deployments** tab
   - Click on the latest successful deployment
   - Click **⋮** (three dots) → **Redeploy**
   - Select **Use existing Build Cache** (faster) or **Redeploy from scratch**
   - Click **Redeploy**

### Option 2: Vercel CLI (After Installation)

Install Vercel CLI first:
```powershell
npm install -g vercel
```

Then update and deploy:
```powershell
# Login to Vercel
vercel login

# Link your project (first time only)
vercel link

# Update environment variable
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
# When prompted, enter: auth.vendai.digital

# Deploy to production
vercel --prod
```

### Option 3: GitHub Integration (If Connected)

If your Vercel project is connected to GitHub:

1. **Update Environment Variable** in Vercel Dashboard (as in Option 1)
2. **Trigger Deploy via Git**:
   ```powershell
   git add .
   git commit -m "Update auth domain to auth.vendai.digital"
   git push origin master
   ```
   - Vercel will automatically detect the push and deploy

## 🧪 Testing the Deployment

### 1. Wait for Deployment
- Monitor deployment status in Vercel dashboard
- Usually takes 2-5 minutes

### 2. Verify the Update
Once deployment completes, check:

```powershell
# Check the environment variable is exposed
curl https://app.vendai.digital/_next/static/chunks/webpack.js | Select-String -Pattern "auth.vendai.digital"
```

### 3. Test Login Flow

**Web Browser Test:**
1. Open incognito/private window
2. Go to: https://app.vendai.digital
3. Clear cache: Ctrl+Shift+Delete → Clear everything
4. Click "Sign In" or "Log In"
5. **Verify**:
   - URL should redirect to `auth.vendai.digital`
   - Login should complete faster
   - Check browser DevTools → Network tab → Look for requests to `auth.vendai.digital`

**Electron Desktop Test:**
1. Rebuild the Electron app with updated env:
   ```powershell
   npm run build:desktop
   ```
2. Launch the app and test login
3. Verify auth handoff to `auth.vendai.digital`

## 🔍 Verification Checklist

- [ ] Local `.env.local` updated to `auth.vendai.digital`
- [ ] Vercel production env var updated to `auth.vendai.digital`
- [ ] New deployment triggered and completed successfully
- [ ] Web app login redirects to `auth.vendai.digital`
- [ ] Login completes successfully and faster
- [ ] No console errors in browser DevTools
- [ ] Electron app (if rebuilt) uses new auth domain

## 🐛 Troubleshooting

### Issue: Still seeing old auth domain
**Solution**: Hard refresh the browser
```
Chrome/Edge: Ctrl+Shift+R
Firefox: Ctrl+F5
Safari: Cmd+Shift+R
```

### Issue: Authentication errors
**Solution**: 
1. Check Firebase Console → Authentication → Settings → Authorized domains
2. Ensure `auth.vendai.digital` is listed
3. Add if missing

### Issue: CORS errors
**Solution**: 
1. Verify `auth.vendai.digital` DNS is pointing correctly
2. Check Firebase authorized domains
3. Clear browser cache completely

### Issue: Deployment failed
**Solution**:
1. Check Vercel deployment logs
2. Look for build errors
3. Verify all required env vars are set
4. Try redeploying without cache

## 📊 Expected Performance Improvement

- **Before**: Auth redirect to `vendai-fa58c.firebaseapp.com` → slower DNS resolution
- **After**: Auth redirect to `auth.vendai.digital` → custom domain, faster handoff
- **Improvement**: ~200-500ms faster authentication flow

## 🔗 Related Files

- **Local Config**: `.env.local`
- **Template**: `.env.template`
- **Auth Context**: `contexts/auth-context.tsx`
- **Firebase Config**: `lib/firebase.ts`
- **Deployment Config**: `vercel.json`

## 📝 Next Steps

1. ✅ Update local environment (DONE)
2. ⏳ Update Vercel production environment variable
3. ⏳ Trigger production deployment
4. ⏳ Test login flow in production
5. ⏳ Rebuild Electron app if needed
6. ⏳ Monitor for any issues

---

**Status**: Ready to deploy to production! 🚀
**Last Updated**: October 24, 2025
