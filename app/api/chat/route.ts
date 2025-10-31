import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured', details: 'Please set OPENAI_API_KEY in environment variables' },
        { status: 500 }
      );
    }

    // Initialize OpenAI client inside the function
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { message, history, context } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build context-aware system prompt
    const systemPrompt = `You are a helpful AI assistant for VendAI, a point-of-sale and inventory management system. 
The user is a ${context?.role || 'user'} from ${context?.organizationName || 'an organization'}.

You can help with:
- Answering questions about products, inventory, and sales
- Searching for information in the system
- Providing guidance on using VendAI features
- General business and retail advice

Be concise, friendly, and professional. If you don't know something specific about their data, let them know you can help them navigate to the right place.`;

    // Build messages array with history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message },
    ];

    console.log('Calling OpenAI API...');
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    console.log('OpenAI API response received');

    const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return NextResponse.json({
      message: assistantMessage,
      usage: completion.usage,
    });

  } catch (error: any) {
    console.error('OpenAI API error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process chat request';
    let errorDetails = error.message;
    
    if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded';
      errorDetails = 'Please check your OpenAI API usage and billing.';
    } else if (error.code === 'invalid_api_key') {
      errorMessage = 'Invalid OpenAI API key';
      errorDetails = 'Please check your OPENAI_API_KEY configuration.';
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded';
      errorDetails = 'Too many requests. Please try again in a moment.';
    }
    
    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500 }
    );
  }
}
