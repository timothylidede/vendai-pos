import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// Initialize Firebase if not already initialized
function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const app = getFirebaseApp();
    const db = getFirestore(app);
    
    const orgId = context?.organizationName || '';
    const userRole = context?.role || 'user';
    
    // Simple keyword-based response system
    const lowerMessage = message.toLowerCase();
    let responseMessage = '';

    // Check for product-related queries
    if (lowerMessage.includes('product') || lowerMessage.includes('item') || lowerMessage.includes('stock') || lowerMessage.includes('inventory')) {
      try {
        // Try to fetch products from Firebase
        const productsQuery = query(
          collection(db, 'pos_products'),
          where('orgId', '==', orgId),
          limit(5)
        );
        
        const snapshot = await getDocs(productsQuery);
        
        if (!snapshot.empty) {
          const products = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              name: data.name,
              brand: data.brand,
              category: data.category,
              price: data.piecePrice || data.price
            };
          });
          
          if (lowerMessage.includes('how many') || lowerMessage.includes('count')) {
            responseMessage = `You currently have ${products.length} products in your system. Here are a few: ${products.map(p => p.name).join(', ')}.`;
          } else if (lowerMessage.includes('low stock') || lowerMessage.includes('reorder')) {
            responseMessage = `To check low stock items, please navigate to the Inventory module. I can see you have products like ${products.slice(0, 3).map(p => p.name).join(', ')}.`;
          } else {
            responseMessage = `Here are some of your products: ${products.map(p => `${p.name} by ${p.brand} (${p.category})`).slice(0, 3).join(', ')}. Navigate to Inventory for more details.`;
          }
        } else {
          responseMessage = `You don't have any products in your inventory yet. Go to the Inventory module to add products.`;
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        responseMessage = 'I had trouble accessing your inventory. Please check the Inventory module for your products.';
      }
    }
    // Sales queries
    else if (lowerMessage.includes('sale') || lowerMessage.includes('sell') || lowerMessage.includes('revenue')) {
      if (userRole === 'retailer') {
        responseMessage = 'To view your sales, navigate to the Point of Sale module. You can process new sales and view your sales history there.';
      } else {
        responseMessage = 'To view your sales and orders, navigate to the Retailers module to see your partner activities.';
      }
    }
    // Order queries
    else if (lowerMessage.includes('order') || lowerMessage.includes('purchase')) {
      if (userRole === 'retailer') {
        responseMessage = 'You can place orders with your suppliers through the Suppliers module. Navigate there to browse products and create purchase orders.';
      } else {
        responseMessage = 'To view orders from your retail partners, navigate to the Retailers module.';
      }
    }
    // Help queries
    else if (lowerMessage.includes('help') || lowerMessage.includes('how to') || lowerMessage.includes('guide')) {
      if (userRole === 'retailer') {
        responseMessage = 'I can help you with:\n• Managing inventory (Inventory module)\n• Processing sales (POS module)\n• Ordering from suppliers (Suppliers module)\n\nWhat would you like to know more about?';
      } else {
        responseMessage = 'I can help you with:\n• Managing your product catalog (Inventory module)\n• Tracking deliveries (Logistics module)\n• Managing retail partners (Retailers module)\n\nWhat would you like to know more about?';
      }
    }
    // Greeting
    else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      responseMessage = `Hello! I'm your VendAI assistant. I can help you navigate the system and answer questions about your ${userRole === 'retailer' ? 'store operations' : 'distribution business'}. What can I help you with?`;
    }
    // Default response
    else {
      responseMessage = 'I\'m here to help! You can ask me about:\n• Your products and inventory\n• Sales and orders\n• How to use VendAI features\n\nTry asking something like "Show me my products" or "How do I process a sale?"';
    }

    return NextResponse.json({
      message: responseMessage,
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    
    return NextResponse.json(
      { error: 'Failed to process chat request', details: error.message },
      { status: 500 }
    );
  }
}
