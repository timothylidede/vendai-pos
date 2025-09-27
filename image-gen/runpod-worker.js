// Minimal RunPod-style worker loop for Stable Diffusion image generation
// This is a template you can adapt into a RunPod container. It polls Firestore for queued jobs,
// calls your SD endpoint, uploads result URLs to product docs, and updates job status.

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fetch from 'node-fetch'

// Environment variables required:
// - FIREBASE_PROJECT_ID
// - FIREBASE_CLIENT_EMAIL
// - FIREBASE_PRIVATE_KEY (replace \n with actual newlines)
// - SD_API_URL (Stable Diffusion HTTP endpoint)
// - SD_API_KEY (optional)

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase admin env vars')
  privateKey = privateKey.replace(/\\n/g, '\n')
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  return getFirestore()
}

async function takeNextJob(db) {
  const snap = await db.collection('image_jobs').where('status', '==', 'queued').limit(1).get()
  if (snap.empty) return null
  const docRef = snap.docs[0].ref
  await docRef.update({ status: 'processing', updatedAt: new Date().toISOString() })
  return docRef
}

async function callSD(prompt) {
  const url = process.env.SD_API_URL
  if (!url) throw new Error('SD_API_URL not set')
  const headers = { 'Content-Type': 'application/json' }
  if (process.env.SD_API_KEY) headers['Authorization'] = `Bearer ${process.env.SD_API_KEY}`
  const body = JSON.stringify({ prompt, steps: 30, guidance: 7.5, width: 512, height: 512 })
  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`SD error ${res.status}`)
  const json = await res.json()
  // Expect json.imageUrl or similar from your endpoint
  return json.imageUrl || json.url || null
}

async function attachImageToProduct(db, orgId, productId, imageUrl) {
  if (!imageUrl) return
  await db.collection('pos_products').doc(productId).set({ orgId, image: imageUrl, updatedAt: new Date().toISOString() }, { merge: true })
}

async function mainLoop() {
  const db = initAdmin()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const jobRef = await takeNextJob(db)
    if (!jobRef) { await new Promise(r => setTimeout(r, 2000)); continue }
    const job = (await jobRef.get()).data()
    try {
      const imageUrl = await callSD(job.prompt)
      await attachImageToProduct(db, job.orgId, job.productId, imageUrl)
      await jobRef.update({ status: 'done', imageUrl, updatedAt: new Date().toISOString() })
    } catch (e) {
      const attempts = (job.attempts || 0) + 1
      const failed = attempts >= 3
      await jobRef.update({ status: failed ? 'failed' : 'queued', attempts, error: String(e), updatedAt: new Date().toISOString() })
      if (!failed) await new Promise(r => setTimeout(r, 2000))
    }
  }
}

// Only run if invoked directly (not when imported)
if (require.main === module) {
  mainLoop().catch(err => { console.error(err); process.exit(1) })
}
