/**
 * Firestore Index Auto-Creation Script
 * Run this to automatically generate index creation links for webhook collections
 * 
 * Usage: node scripts/create-webhook-indexes.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../vendai-fa58c-firebase-adminsdk-3hdjr-02de9697a7.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createWebhookIndexes() {
  console.log('🔥 Starting webhook index creation...\n');

  try {
    // Test Query 1: pos_webhook_configs with orgId + enabled + events
    console.log('1️⃣ Testing pos_webhook_configs query (orgId + enabled + events)...');
    try {
      const webhookQuery = await db.collection('pos_webhook_configs')
        .where('orgId', '==', 'test-org')
        .where('enabled', '==', true)
        .where('events', 'array-contains', 'stock.updated')
        .limit(1)
        .get();
      
      console.log('   ✅ Index already exists or query succeeded');
    } catch (error) {
      if (error.message.includes('index')) {
        console.log('   ⚠️  Index needed. Firebase will show creation link in console.');
        console.log('   📋 Index details:');
        console.log('      Collection: pos_webhook_configs');
        console.log('      Fields: orgId (ASC), enabled (ASC), events (ARRAY_CONTAINS)');
        console.log('');
      } else {
        throw error;
      }
    }

    // Test Query 2: pos_sync_logs with orgId + createdAt
    console.log('2️⃣ Testing pos_sync_logs query (orgId + createdAt)...');
    try {
      const logsQuery = await db.collection('pos_sync_logs')
        .where('orgId', '==', 'test-org')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      console.log('   ✅ Index already exists or query succeeded');
    } catch (error) {
      if (error.message.includes('index')) {
        console.log('   ⚠️  Index needed. Firebase will show creation link in console.');
        console.log('   📋 Index details:');
        console.log('      Collection: pos_sync_logs');
        console.log('      Fields: orgId (ASC), createdAt (DESC)');
        console.log('');
      } else {
        throw error;
      }
    }

    // Test Query 3: pos_sync_logs with status + nextRetryAt
    console.log('3️⃣ Testing pos_sync_logs query (status + nextRetryAt)...');
    try {
      const retryQuery = await db.collection('pos_sync_logs')
        .where('status', '==', 'retrying')
        .where('nextRetryAt', '<=', new Date())
        .orderBy('nextRetryAt', 'asc')
        .limit(1)
        .get();
      
      console.log('   ✅ Index already exists or query succeeded');
    } catch (error) {
      if (error.message.includes('index')) {
        console.log('   ⚠️  Index needed. Firebase will show creation link in console.');
        console.log('   📋 Index details:');
        console.log('      Collection: pos_sync_logs');
        console.log('      Fields: status (ASC), nextRetryAt (ASC)');
        console.log('');
      } else {
        throw error;
      }
    }

    console.log('\n✨ Index check complete!');
    console.log('\n📌 Next Steps:');
    console.log('1. If you see index creation links above, click them to create indexes');
    console.log('2. Or check the Firebase Console for automatic index creation prompts');
    console.log('3. Indexes typically build in 1-5 minutes');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

createWebhookIndexes();
