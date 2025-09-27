# Firebase Service Account Setup Guide

## The Problem
The error `Could not load the default credentials` occurs because the Firebase Admin SDK can't authenticate with Google Cloud Storage to upload generated images.

## Solution Options

### Option 1: Service Account Key (Recommended for Development)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `vendai-fa58c`
3. Click the gear icon (Project Settings)
4. Go to "Service accounts" tab
5. Click "Generate new private key"
6. Download the JSON file
7. Convert the JSON to a string and add to your `.env.local`:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"vendai-fa58c","private_key_id":"...","private_key":"...","client_email":"firebase-adminsdk-...@vendai-fa58c.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'
```

### Option 2: Application Default Credentials (For Production)

1. Install Google Cloud CLI
2. Run `gcloud auth application-default login`
3. This sets up default credentials on your machine

### Option 3: Update Firebase Admin Config

The current config uses the incorrect storage bucket URL. Update `lib/firebase-admin.ts`:

```typescript
// Use the correct storage bucket from your .env.local
storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.firebasestorage.app'
```

## Testing the Fix

After adding the service account key, restart your development server:

```bash
npm run electron:dev
```

You should see:
- ✅ Using Firebase service account credentials
- ✅ Image saved to storage
- ✅ File made public

## Security Note

**Never commit the service account key to version control!** 
- Add `.env.local` to `.gitignore`
- Use environment variables in production (Vercel/Netlify)
- Consider using Firebase App Check for additional security