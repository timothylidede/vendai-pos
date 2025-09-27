# RunPod Stable Diffusion Setup (Minimal)

This guide wires the app to a background Stable Diffusion worker running on RunPod (or any container host).

## 1) App-side: Enqueue jobs
- Endpoint: `POST /api/image/enqueue`
- Body: `{ orgId, productId, prompt, variant? }`
- Creates a Firestore doc in `image_jobs` with status `queued`.

## 2) Worker container
- Use `image-gen/runpod-worker.mjs` as a base.
- Responsibilities:
  - Poll Firestore for `image_jobs` with status `queued`.
  - Call your SD endpoint (`SD_API_URL`), get an image URL.
  - Update `pos_products.{productId}.image` with the URL.
  - Mark the job as `done` (or `failed`).

### Required environment variables
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY (escape newlines as \n)
- SD_API_URL (your Stable Diffusion HTTP endpoint)
- SD_API_KEY (optional)

## 3) RunPod container
- Create a Dockerfile that installs node18+, copies this repo folder, and runs:
  - `node image-gen/runpod-worker.mjs`
- Expose no ports; it’s a worker.
- Configure the above env vars in RunPod template.

## 4) Prompts
- Use `/api/image/generate` or your own logic to build prompts.
- Then call `/api/image/enqueue` with the chosen prompt.

## 5) Observability
- Jobs collection: `image_jobs`
  - Fields: id, orgId, productId, prompt, status, attempts, imageUrl?, error?
- Extend to push in-app notifications when status changes.

## Notes
- This approach is vendor-agnostic: any SD endpoint behind `SD_API_URL` works (Automatic1111, Invoke, Stability, Replicate, etc.).
- For RunPod Serverless, adapt the loop to handle single job executions and return quickly.
