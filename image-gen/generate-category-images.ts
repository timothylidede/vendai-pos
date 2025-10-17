import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import Replicate from 'replicate'

config({ path: path.join(process.cwd(), '.env.local') })
config({ path: path.join(process.cwd(), '.env') })

const replicateToken = process.env.REPLICATE_API_TOKEN
if (!replicateToken) {
  console.error('❌ Missing REPLICATE_API_TOKEN in environment')
  process.exit(1)
}

const modelIdentifier = process.env.REPLICATE_MODEL_ID || 'google/nano-banana'

const replicate = new Replicate({ auth: replicateToken })

interface CategoryPrompt {
  category: string
  prompt: string
}

const aestheticSuffix = [
  'shot on a slate-grey, matte glass display with subtle fog and volumetric glow',
  'dramatic cyberpunk metropolis ambiance with electric magenta and azure rim lighting',
  'ultra high definition cinematic product render, 16:9 composition, crisp focus and balanced contrast',
  'no people, no signage, no logos, no text overlays, no price tags'
].join('. ')

const curatedPrompts: CategoryPrompt[] = [
  {
    category: 'beverages',
    prompt:
      'Chilled artisan beverage bottles and cans arranged on illuminated risers, vapor curling off glass flutes filled with neon liquids'
  },
  {
    category: 'cleaning',
    prompt:
      'Array of futuristic cleaning concentrates, chrome spray bottles, and compact sanitation drones presented on modular display blocks'
  },
  {
    category: 'dairy',
    prompt:
      'Refrigerated dairy spread with levitating milk cartons, yogurt jars, and cheese wheels encased in holographic freshness fields'
  },
  {
    category: 'food',
    prompt:
      'Curated pantry selection featuring preserved meals, condiments, and nutrient capsules arranged like a chef’s cyberpunk tasting menu'
  },
  {
    category: 'general',
    prompt:
      'Futuristic convenience counter showcasing multipurpose household essentials with modular packaging and smart tags'
  },
  {
    category: 'grains',
    prompt:
      'Elevated dispensers pouring radiant grains and cereals into translucent containers surrounded by holographic patterning'
  },
  {
    category: 'meat',
    prompt:
      'Premium cuts displayed within stasis fields, bioluminescent marbling, and temperature-controlled presentation slabs'
  },
  {
    category: 'oils',
    prompt:
      'Collection of gourmet oil decanters with fiber-optic pour spouts, suspended droplets glowing against the background'
  },
  {
    category: 'personal-care',
    prompt:
      'Avant-garde personal care lineup featuring serums, lotions, and grooming tech with holographic interface panels'
  },
  {
    category: 'snacks',
    prompt:
      'Wall of engineered snack packs and nutrient bars, transparent caddies revealing vibrant textures and flavors'
  }
]

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputDir = path.join(process.cwd(), 'image-gen', 'outputs', `categories-${timestamp}`)
fs.mkdirSync(outputDir, { recursive: true })

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'

interface ReplicatePrediction {
  id: string
  status: ReplicateStatus
  output?: unknown
  error?: string | null
}

const terminalStates: ReplicateStatus[] = ['succeeded', 'failed', 'canceled']

const baseNegative = [
  'text, watermark, logo, ui, qr code',
  'people, hands, animals, creatures',
  'distortion, noise, blur, grainy, low resolution',
  'blood, gore, meat preparation, butcher tools',
  'duplicate objects, floating text, heads, limbs'
].join(', ')

function resolveImageUrl(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value.startsWith('http') ? value : undefined
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = resolveImageUrl(entry)
      if (result) return result
    }
    return undefined
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const result = resolveImageUrl((value as Record<string, unknown>)[key])
      if (result) return result
    }
  }
  return undefined
}

async function runPrediction(input: Record<string, unknown>): Promise<string> {
  const prediction = (await (replicate as any).predictions.create({
    model: modelIdentifier,
    input,
    stream: false
  })) as ReplicatePrediction

  const started = Date.now()
  const timeoutMs = 120_000

  let current = prediction
  while (!terminalStates.includes(current.status)) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Replicate prediction timed out')
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    current = (await (replicate as any).predictions.get(current.id)) as ReplicatePrediction
  }

  if (current.status !== 'succeeded') {
    throw new Error(current.error || `Prediction ${current.status}`)
  }

  const url = resolveImageUrl(current.output)
  if (!url) {
    throw new Error('Unable to extract image URL from Replicate output')
  }
  return url
}

async function downloadImage(url: string, filepath: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(filepath, buffer)
}

async function generateCategoryArt() {
  const results: Array<Record<string, string>> = []

  for (const spec of curatedPrompts) {
    const prompt = `${spec.prompt}. ${aestheticSuffix}.` // reinforce unified style
    const baseInput: Record<string, unknown> = {
      prompt,
      output_quality: 'high',
      negative_prompt: `${baseNegative}, text overlay`
    }

    const safeCategory = spec.category.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
    const imagePath = path.join(outputDir, `${safeCategory}.png`)

    console.log(`\n🎨 Generating ${spec.category} visual...`)
    console.log(`   Prompt: ${prompt}`)

    try {
      let imageUrl: string | null = null
      let input = { ...baseInput }
      try {
        imageUrl = await runPrediction(input)
      } catch (error: any) {
        const message = error?.message || String(error)
        if (/invalid|schema|unexpected.*negative/i.test(message)) {
          console.warn('   ⚠️ Negative prompt not accepted, retrying without it...')
          input = { prompt, output_quality: 'high' }
          imageUrl = await runPrediction(input)
        } else {
          throw error
        }
      }

      if (!imageUrl) throw new Error('Replicate did not return an image URL')
      await downloadImage(imageUrl, imagePath)
      console.log(`   ✅ Saved to ${path.relative(process.cwd(), imagePath)}`)
      results.push({
        category: spec.category,
        prompt,
        negative_prompt: (input as Record<string, string>).negative_prompt || (baseInput.negative_prompt as string),
        image_url: imageUrl,
        file: path.relative(process.cwd(), imagePath)
      })
    } catch (error) {
      console.error(`   ❌ Failed for ${spec.category}:`, error instanceof Error ? error.message : error)
      results.push({
        category: spec.category,
        prompt,
        negative_prompt: baseInput.negative_prompt as string,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const metadataPath = path.join(outputDir, 'metadata.json')
  fs.writeFileSync(metadataPath, JSON.stringify({ generatedAt: new Date().toISOString(), model: modelIdentifier, results }, null, 2))
  console.log(`\n📝 Wrote metadata to ${path.relative(process.cwd(), metadataPath)}`)
}

generateCategoryArt().catch((error) => {
  console.error('Unexpected error while generating category art', error)
  process.exit(1)
})