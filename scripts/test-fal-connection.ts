/**
 * Quick FAL.ai Test Script
 * 
 * Tests FAL.ai API connection by generating a single test image
 * No Firebase required - just verifies API key works
 * 
 * Usage: npx tsx scripts/test-fal-connection.ts
 */

import * as fal from '@fal-ai/serverless-client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

console.log('🧪 FAL.ai Connection Test\n');

// Check API key
const apiKey = process.env.FAL_API_KEY;

if (!apiKey) {
  console.error('❌ ERROR: FAL_API_KEY not found in .env.local');
  console.error('\n📝 To fix:');
  console.error('1. Go to https://fal.ai/dashboard/keys');
  console.error('2. Create a new API key');
  console.error('3. Add to .env.local: FAL_API_KEY=your_key_here\n');
  process.exit(1);
}

console.log('✅ FAL_API_KEY found:', apiKey.substring(0, 10) + '...\n');

// Configure FAL client
fal.config({ credentials: apiKey });

async function testConnection() {
  try {
    console.log('🎨 Generating test image with FLUX schnell...');
    console.log('   Prompt: "Professional product photo of Coca-Cola bottle on white background"\n');

    const startTime = Date.now();

    // Generate a simple test image
    const result: any = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: 'Professional studio product photography of a Coca-Cola glass bottle, centered on clean white background, sharp focus, commercial style, high quality',
        image_size: 'square_hd', // 1024x1024
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg'
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log('   ⏳ Generation in progress...');
        } else if (update.status === 'IN_QUEUE') {
          console.log(`   📋 In queue...`);
        }
      }
    });

    const duration = Date.now() - startTime;

    if (result.images && result.images.length > 0) {
      const imageUrl = result.images[0].url;
      
      console.log('\n✅ SUCCESS! Image generated in', duration, 'ms');
      console.log('📊 Details:');
      console.log('   - Image URL:', imageUrl);
      console.log('   - Size:', result.images[0].width, 'x', result.images[0].height);
      console.log('   - Content type:', result.images[0].content_type);
      console.log('   - Seed:', result.seed);
      console.log('   - Has NSFW:', result.has_nsfw_concepts?.[0] || false);
      
      // Download and save test image
      console.log('\n📥 Downloading test image...');
      
      const testDir = path.join(__dirname, '..', 'test-images');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      const testImagePath = path.join(testDir, 'fal-test-coca-cola.jpg');
      const file = fs.createWriteStream(testImagePath);
      
      await new Promise<void>((resolve, reject) => {
        https.get(imageUrl, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(testImagePath, () => {});
          reject(err);
        });
      });
      
      console.log('✅ Test image saved to:', testImagePath);
      console.log('\n💰 Cost: $0.003 (3/10 of a cent)');
      console.log('\n🎉 FAL.ai is working perfectly!');
      console.log('\n📝 Next steps:');
      console.log('   1. Review test image in:', testImagePath);
      console.log('   2. If quality looks good, run:');
      console.log('      npx tsx scripts/generate-images-fal.ts --limit 10 --dry-run');
      console.log('   3. Then generate real images:');
      console.log('      npx tsx scripts/generate-images-fal.ts --limit 10\n');
      
    } else {
      console.error('❌ ERROR: No images in response');
      console.log('Response:', JSON.stringify(result, null, 2));
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('\n🔑 API Key Issue:');
      console.error('   - Your FAL_API_KEY may be invalid or expired');
      console.error('   - Get a new one from: https://fal.ai/dashboard/keys');
      console.error('   - Update .env.local with new key\n');
    } else if (error.message.includes('429') || error.message.includes('rate limit')) {
      console.error('\n⚠️ Rate Limit:');
      console.error('   - You may have exceeded free tier limits');
      console.error('   - Add credits at: https://fal.ai/dashboard/billing');
      console.error('   - Or wait a few minutes and try again\n');
    } else if (error.message.includes('quota')) {
      console.error('\n💳 Quota Exceeded:');
      console.error('   - Your free credits may be exhausted');
      console.error('   - Add credits at: https://fal.ai/dashboard/billing\n');
    } else {
      console.error('\n🐛 Unexpected Error:');
      console.error('   - Check your internet connection');
      console.error('   - Visit https://status.fal.ai/ for service status');
      console.error('   - Join Discord for help: https://discord.gg/fal-ai\n');
    }
    
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run test
testConnection();
