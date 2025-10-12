/**
 * Test OpenAI API Connection
 */
import OpenAI from 'openai';
import { config } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

console.log('🔑 API Key:', process.env.OPENAI_API_KEY ? `✅ Found (${process.env.OPENAI_API_KEY.substring(0, 10)}...)` : '❌ Missing');

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 10000
});

(async () => {
  try {
    console.log('\n🧪 Testing OpenAI API with simple request...');
    const start = Date.now();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Hello from OpenAI!" and nothing else.' }],
      max_tokens: 50
    });
    
    const duration = Date.now() - start;
    console.log(`\n✅ SUCCESS in ${duration}ms`);
    console.log('📝 Response:', response.choices[0].message.content);
    console.log('💰 Tokens used:', response.usage);
    
  } catch (error: any) {
    console.error('\n❌ FAILED');
    console.error('Error:', error.message);
    console.error('Type:', error.constructor.name);
    if (error.code) console.error('Code:', error.code);
    if (error.status) console.error('Status:', error.status);
    if (error.response) console.error('Response:', JSON.stringify(error.response.data, null, 2));
    process.exit(1);
  }
})();
