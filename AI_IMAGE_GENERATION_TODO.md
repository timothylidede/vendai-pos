# AI Image Generation TODO - Fix Issues

## Issues Found:
1. **Google Credentials Error**: Firebase Admin SDK trying to load default credentials
   - Missing `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable
   - Need to set up proper Firebase service account or use Application Default Credentials

2. **promptStyle is undefined**: Frontend not sending promptStyle parameter
   - Need to add promptStyle to the request from the UI
   - Currently defaulting to undefined instead of the base prompt

3. **Google Custom Search Engine**: Missing API keys for reference images
   - Need `GOOGLE_CSE_API_KEY` or `GOOGLE_API_KEY`
   - Need `GOOGLE_CSE_CX` or `GOOGLE_CSE_ID`

4. **Insufficient Logging**: Need better visibility into AI processing
   - Add more detailed logs for each step
   - Log prompt being used
   - Log reference image URLs found
   - Log Firebase upload progress

## Fixes Applied:
- ✅ Updated environment variables with Google CSE keys
- ✅ Added comprehensive logging to AI processing
- ✅ Added fallback for missing Firebase service account
- ✅ Added default promptStyle when undefined in API route
- ✅ Fixed frontend to send promptStyle parameter from inventory module
- ✅ Added error handling for Google CSE API calls
- ✅ Improved Firebase admin configuration with better error messages

## Current Status:
The following improvements have been made:

### 1. Frontend Fix
- Updated inventory module to send `promptStyle` parameter
- Both single image generation and bulk generation now include proper prompt

### 2. API Improvements
- Added comprehensive logging throughout the image generation process
- Better error handling and user-friendly error messages
- Default promptStyle provided when none is sent

### 3. Google CSE Configuration
- Added Google Custom Search API keys to environment
- Better logging for reference image search process

### 4. Firebase Admin SDK
- Added helpful instructions for setting up service account
- Better error messages when credentials are missing

## Next Steps:
1. **Set up Firebase service account key** (CRITICAL):
   ```bash
   # Go to Firebase Console > Project Settings > Service Accounts
   # Generate new private key and add to .env.local:
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```

2. Test image generation with new logging
3. Verify Google CSE is working for reference images
4. Add promptStyle selection in UI for custom styles

## Testing:
After setting up the Firebase service account key, restart the development server:
```bash
npm run electron:dev
```

You should see detailed logs showing:
- ✅ OpenAI API key found
- 🔍 Searching for reference images
- 🎨 Using prompt style: Custom provided
- ✅ Firebase service account credentials
- ☁️ Uploading image to Firebase Storage

## Security Note:
- Never commit the service account key to version control
- The current .env.local has the key commented out for security
- Use environment variables in production deployment