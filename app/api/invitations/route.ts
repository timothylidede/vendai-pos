import { NextRequest, NextResponse } from 'next/server';

// Configure for static export
export const dynamic = 'force-static';

// Placeholder API for future server-side invitation operations
export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Invitation API placeholder - client-side implementation in use',
    status: 'not_implemented'
  }, { status: 501 });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Invitation API placeholder - client-side implementation in use',
    status: 'not_implemented'
  }, { status: 501 });
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Invitation API placeholder - client-side implementation in use',
    status: 'not_implemented'
  }, { status: 501 });
}