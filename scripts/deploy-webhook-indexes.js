/**
 * Direct Firestore Index Creation using REST API
 * This script uses Firebase's REST API to create indexes programmatically
 * 
 * Usage: node scripts/deploy-webhook-indexes.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getAccessToken() {
  try {
    const { stdout } = await execPromise('npx firebase login:ci --no-localhost');
    return stdout.trim();
  } catch (error) {
    // Try to get token from gcloud
    try {
      const { stdout } = await execPromise('gcloud auth print-access-token');
      return stdout.trim();
    } catch (gcloudError) {
      throw new Error('Could not get access token. Please run: firebase login');
    }
  }
}

const indexes = {
  indexes: [
    // pos_webhook_configs: orgId + enabled
    {
      queryScope: 'COLLECTION',
      collectionGroup: 'pos_webhook_configs',
      fields: [
        { fieldPath: 'orgId', order: 'ASCENDING' },
        { fieldPath: 'enabled', order: 'ASCENDING' }
      ]
    },
    // pos_sync_logs: orgId + createdAt
    {
      queryScope: 'COLLECTION',
      collectionGroup: 'pos_sync_logs',
      fields: [
        { fieldPath: 'orgId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ]
    },
    // pos_sync_logs: status + nextRetryAt
    {
      queryScope: 'COLLECTION',
      collectionGroup: 'pos_sync_logs',
      fields: [
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'nextRetryAt', order: 'ASCENDING' }
      ]
    }
  ],
  fieldOverrides: [
    // pos_webhook_configs: events array field
    {
      collectionGroup: 'pos_webhook_configs',
      fieldPath: 'events',
      indexes: [
        {
          queryScope: 'COLLECTION',
          arrayConfig: 'CONTAINS'
        }
      ]
    }
  ]
};

async function createIndexes() {
  console.log('🔥 Creating webhook indexes programmatically...\n');

  // Simply update firestore.indexes.json and redeploy
  const indexPath = path.join(__dirname, '..', 'firestore.indexes.json');
  let currentIndexes = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  // Add our indexes to the end of the indexes array
  console.log('📝 Adding webhook indexes to firestore.indexes.json...');
  
  // Add composite indexes
  indexes.indexes.forEach(index => {
    // Check if index already exists
    const exists = currentIndexes.indexes.some(existing => 
      existing.collectionGroup === index.collectionGroup &&
      JSON.stringify(existing.fields) === JSON.stringify(index.fields)
    );
    
    if (!exists) {
      currentIndexes.indexes.push(index);
      console.log(`   ✅ Added index for ${index.collectionGroup}`);
    }
  });

  // Add field overrides
  indexes.fieldOverrides.forEach(override => {
    const exists = currentIndexes.fieldOverrides.some(existing =>
      existing.collectionGroup === override.collectionGroup &&
      existing.fieldPath === override.fieldPath
    );
    
    if (!exists) {
      currentIndexes.fieldOverrides.push(override);
      console.log(`   ✅ Added field override for ${override.collectionGroup}.${override.fieldPath}`);
    }
  });

  // Write back to file
  fs.writeFileSync(indexPath, JSON.stringify(currentIndexes, null, 2));
  console.log('\n💾 Updated firestore.indexes.json');

  // Deploy indexes
  console.log('\n🚀 Deploying indexes to Firebase...\n');
  
  try {
    const { stdout, stderr } = await execPromise('npx firebase deploy --only firestore:indexes --force');
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('\n✅ Webhook indexes deployed successfully!');
    console.log('\n⏳ Indexes are now building. This typically takes 1-5 minutes.');
    console.log('📊 Check status: https://console.firebase.google.com/project/vendai-fa58c/firestore/indexes');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.log('\n💡 Manual deployment option:');
    console.log('   Run: npx firebase deploy --only firestore:indexes');
  }
}

createIndexes().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
