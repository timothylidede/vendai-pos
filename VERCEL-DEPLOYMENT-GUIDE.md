# 🚀 VendAI Dual Deployment Guide
### Deploy to Vercel (app.vendai.digital) + Keep Desktop App Functionality

This guide shows you how to deploy your VendAI POS system to Vercel while maintaining the desktop application capabilities.

## 📋 Overview

After deployment, users will have two options:
1. **Web Access**: Visit `app.vendai.digital` for browser-based access
2. **Desktop App**: Download and install the full desktop application

## 🔧 Step 1: Environment Configuration

### 1.1 Create Google OAuth Clients

You need **TWO** separate Google OAuth clients:

#### Web OAuth Client (for app.vendai.digital)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Credentials > Credentials
3. Click "Create Credentials" > "OAuth 2.0 Client IDs"
4. Choose "Web application"
5. Add authorized domains:
   - `https://app.vendai.digital`
   - `https://your-vercel-url.vercel.app` (backup)
6. Save the **Client ID** - you'll need this

#### Desktop OAuth Client (for Electron app)
1. Create another OAuth 2.0 Client ID
2. Choose "Desktop application"
3. Save the **Client ID** - this is different from web

### 1.2 Configure Environment Variables

Copy `.env.vercel.template` to `.env.local` and fill in your values:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google OAuth - Web (for Vercel)
NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_oauth_client_id

# Google OAuth - Desktop (for Electron)
GOOGLE_OAUTH_CLIENT_ID=your_desktop_oauth_client_id

# Optional but recommended
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_api_key
```

## 🚀 Step 2: Deploy to Vercel

### Option A: Using Our Script (Recommended)
```powershell
# Windows PowerShell
.\scripts\deploy-vercel.ps1

# Or Windows Command Prompt
.\scripts\deploy-vercel.bat
```

### Option B: Manual Deployment
```bash
# Install Vercel CLI if needed
npm install -g vercel

# Deploy to production
vercel --prod
```

## 🌐 Step 3: Configure Custom Domain

1. **In Vercel Dashboard**:
   - Go to your project settings
   - Navigate to "Domains"
   - Add `app.vendai.digital`
   - Follow Vercel's DNS configuration instructions

2. **Update vendai.digital site**:
   - Modify your main site's login button
   - Change the href from local login to: `https://app.vendai.digital`

## 🔐 Step 4: Update Firebase Authentication

1. Go to Firebase Console > Authentication > Settings
2. Add authorized domains:
   - `app.vendai.digital`
   - `your-vercel-url.vercel.app`
3. Update OAuth redirect URIs if needed

## 📱 Step 5: Test Both Environments

### Test Web Version
1. Visit `https://app.vendai.digital`
2. Try Google sign-in
3. Verify all features work in browser
4. Check that desktop download option appears

### Test Desktop Version
1. Build desktop app: `npm run dist:win`
2. Install and run the desktop application
3. Verify Google OAuth still works
4. Test offline capabilities

## 🔄 Step 6: Update Your Main Site

Update your `vendai.digital` website to:

1. **Change Login Button**:
   ```html
   <!-- Before -->
   <a href="/login">Sign In</a>
   
   <!-- After -->
   <a href="https://app.vendai.digital">Sign In</a>
   ```

2. **Add Download Integration** (Optional):
   ```javascript
   // Use your API for download links
   const API_BASE = 'https://app.vendai.digital/api';
   
   // Get latest release
   fetch(`${API_BASE}/releases/latest`)
     .then(r => r.json())
     .then(data => {
       // Update download buttons with real URLs
     });
   ```

## 🎯 Step 7: User Flow

### New User Journey
1. User visits `vendai.digital`
2. Clicks "Sign In" → Redirected to `app.vendai.digital`
3. Sees two options:
   - **Continue in Browser**: Uses web app directly
   - **Download Desktop App**: Gets full offline experience
4. After authentication, they can access their dashboard

### Returning User Journey
1. **Web Users**: Bookmark `app.vendai.digital`, access anytime
2. **Desktop Users**: Launch installed app, auto-updates available

## 🛠️ Maintenance

### Updating Web Version
```bash
# Make changes, then deploy
vercel --prod
```

### Updating Desktop Version
```bash
# Build new version
npm run dist:win

# Release process (GitHub)
git tag v1.0.1
git push origin v1.0.1
# Upload releases to GitHub
```

## 🔍 Troubleshooting

### Common Issues

1. **OAuth Error**: Check that both web and desktop OAuth clients are configured correctly
2. **Firebase Error**: Ensure app.vendai.digital is in authorized domains
3. **Build Error**: Check that all environment variables are set in Vercel dashboard
4. **API Errors**: Verify your GitHub token has proper permissions

### Environment Detection

The app automatically detects the environment:
- **Electron**: Shows desktop-specific features, window controls
- **Web**: Shows download options, web-optimized UI
- **Vercel**: Optimized for production web deployment

## 📊 Monitoring

### Analytics
- Web: Vercel Analytics automatically enabled
- Desktop: Electron usage metrics (if configured)

### API Usage
- Monitor GitHub API limits (releases endpoint)
- Track authentication success rates
- Watch for CORS issues

## 🎉 Success Criteria

✅ **Web Version Works**:
- Users can access app.vendai.digital
- Google sign-in functions properly  
- All features work in browser
- Download option visible for desktop app

✅ **Desktop Version Maintained**:
- Existing users can continue using desktop app
- OAuth authentication still works
- Auto-updates function properly
- Offline capabilities preserved

✅ **Seamless Integration**:
- vendai.digital redirects users properly
- Consistent branding across platforms
- Smooth user experience

## 🚀 Go Live Checklist

- [ ] Environment variables configured in Vercel
- [ ] Google OAuth clients created for both web and desktop
- [ ] Firebase authorized domains updated
- [ ] Custom domain (app.vendai.digital) configured
- [ ] Main vendai.digital site updated with new login URL
- [ ] Both web and desktop versions tested
- [ ] API endpoints responding correctly
- [ ] SSL certificates working
- [ ] Error handling tested

---

**Need Help?** Check the troubleshooting section above or review the individual component files for detailed implementation notes.