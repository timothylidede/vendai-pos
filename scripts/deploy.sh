#!/bin/bash

# VendAI POS Deployment Script
echo "🚀 Deploying VendAI POS to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Deploy to Vercel
echo "📦 Building and deploying..."
vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the deployment URL from above"
echo "2. Update your vendai-website project to use that URL"
echo "3. Test the API endpoints:"
echo "   - https://YOUR-URL.vercel.app/api/releases/latest"
echo "   - https://YOUR-URL.vercel.app/api/releases/check-update"
echo ""
echo "🔗 Use this URL in your vendai-website project:"
echo "const API_BASE_URL = 'https://YOUR-URL.vercel.app';"