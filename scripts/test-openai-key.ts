import OpenAI from 'openai';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment
config({ path: path.join(process.cwd(), '.env.local') });

console.log('Testing OpenAI API Key...\n');
console.log('API Key starts with:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');
console.log('API Key length:', process.env.OPENAI_API_KEY?.length);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000
});

async function testKey() {
  try {
    console.log('\n🧪 Making a simple API call...');
    const start = Date.now();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Say "Hello"' }
      ],
      max_tokens: 10
    });
    
    const duration = Date.now() - start;
    console.log(`✅ API call successful! (${duration}ms)`);
    console.log('Response:', response.choices[0].message.content);
    console.log('\nTokens used:', response.usage);
    console.log('\n✅ Your OpenAI API key is working correctly!');
    
  } catch (error: any) {
    console.error('❌ API call failed!');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    if (error.status) {
      console.error('HTTP Status:', error.status);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if your API key is valid at https://platform.openai.com/api-keys');
    console.log('2. Make sure you have credits/billing set up');
    console.log('3. Check if the key has expired');
    process.exit(1);
  }
}

testKey();
