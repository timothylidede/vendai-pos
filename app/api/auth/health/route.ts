import { NextRequest, NextResponse } from 'next/server';

/**
 * Health Check Endpoint for Vercel Deployment
 * Verifies Firebase configuration and authentication setup
 * 
 * Access at: https://app.vendai.digital/api/auth/health
 */
export async function GET(request: NextRequest) {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV,
    deployment: {
      url: request.headers.get('host'),
      userAgent: request.headers.get('user-agent'),
    },
    firebase: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set (***' + process.env.NEXT_PUBLIC_FIREBASE_API_KEY.slice(-4) + ')' : '✗ Missing',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '✗ Missing',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '✗ Missing',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '✗ Missing',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Missing',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ Set' : '✗ Missing',
    },
    envVarsLoaded: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ),
  };

  const allConfigured = 
    checks.firebase.apiKey.includes('✓') &&
    checks.firebase.authDomain !== '✗ Missing' &&
    checks.firebase.projectId !== '✗ Missing';

  return NextResponse.json({
    status: allConfigured ? 'healthy' : 'configuration_error',
    message: allConfigured 
      ? 'Firebase is properly configured' 
      : 'Some Firebase environment variables are missing',
    checks,
    recommendations: allConfigured ? [] : [
      'Verify environment variables are set in Vercel dashboard',
      'Ensure variables are set for Production, Preview, and Development',
      'Redeploy after adding environment variables',
      'Check that variable names match exactly (case-sensitive)',
    ],
  }, {
    status: allConfigured ? 200 : 500,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
