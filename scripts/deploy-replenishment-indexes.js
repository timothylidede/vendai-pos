/**
 * Script to add replenishment indexes to firestore.indexes.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const indexesPath = join(__dirname, '..', 'firestore.indexes.json')

console.log('📖 Reading firestore.indexes.json...')
const indexesContent = readFileSync(indexesPath, 'utf-8')
const indexesData = JSON.parse(indexesContent)

// Indexes to add
const newIndexes = [
  {
    collectionGroup: 'replenishment_suggestions',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'orgId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'replenishment_suggestions',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'orgId', order: 'ASCENDING' },
      { fieldPath: 'productId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'supplier_skus',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'productId', order: 'ASCENDING' },
      { fieldPath: 'availability', order: 'ASCENDING' },
      { fieldPath: 'leadTimeDays', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'supplier_skus',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'supplierId', order: 'ASCENDING' },
      { fieldPath: 'productId', order: 'ASCENDING' }
    ]
  }
]

// Check if indexes already exist
const existingCollections = new Set(
  indexesData.indexes.map((idx) => `${idx.collectionGroup}-${JSON.stringify(idx.fields)}`)
)

let addedCount = 0
for (const newIndex of newIndexes) {
  const key = `${newIndex.collectionGroup}-${JSON.stringify(newIndex.fields)}`
  if (!existingCollections.has(key)) {
    console.log(`✅ Adding index for ${newIndex.collectionGroup}`)
    indexesData.indexes.push(newIndex)
    addedCount++
  } else {
    console.log(`⏭️  Index already exists for ${newIndex.collectionGroup}`)
  }
}

if (addedCount > 0) {
  console.log(`\n💾 Writing updated indexes back to file...`)
  writeFileSync(indexesPath, JSON.stringify(indexesData, null, 2), 'utf-8')
  console.log(`✅ Added ${addedCount} new indexes`)
  console.log('\n🚀 Ready to deploy! Run: npx firebase deploy --only firestore:indexes')
} else {
  console.log('\n✨ All indexes already exist')
}
