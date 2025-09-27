// Simple test to verify OpenAI API connectivity
const testOpenAI = async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment');
    return;
  }
  
  console.log('API key found, testing connectivity...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ OpenAI API connection successful');
      const hasDALLE = data.data.some(model => model.id === 'dall-e-3');
      console.log('DALL-E 3 available:', hasDALLE);
    } else {
      console.error('❌ OpenAI API error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
};

testOpenAI();