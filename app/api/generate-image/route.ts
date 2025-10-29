import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fallback in-memory generation (uses a placeholder image service)
async function generatePlaceholderImage(prompt: string): Promise<string> {
  // Use a free placeholder service as fallback
  // In production, you would use fal.ai or Replicate here
  const encodedPrompt = encodeURIComponent(prompt.slice(0, 50));
  return `https://placehold.co/1024x1024/1e293b/38bdf8?text=${encodedPrompt}`;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // For now, use placeholder. In production, integrate with fal.ai or Replicate
    // Example fal.ai integration:
    // const falApiKey = process.env.FAL_KEY;
    // if (falApiKey) {
    //   const response = await fetch('https://fal.run/fal-ai/flux-pro', {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Key ${falApiKey}`,
    //       'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({
    //       prompt,
    //       image_size: 'square_hd',
    //       num_inference_steps: 28,
    //       guidance_scale: 3.5
    //     })
    //   });
    //   const data = await response.json();
    //   return NextResponse.json({ imageUrl: data.images[0].url });
    // }

    // Fallback to placeholder
    const imageUrl = await generatePlaceholderImage(prompt);
    
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}
