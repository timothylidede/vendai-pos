# VendAI Roadmap

## Inventory and POS UoM support
- Implemented unit-aware model: baseUom (CTN/BOX/PKT...), retailUom (PCS), unitsPerBase
- POS operates on pieces by default; inventory is held in base+loose
- Orders decrement inventory atomically with base/loose math

## Pricelist ingestion agent (planned)
- Goal: frictionless inventory creation from files (PDF/CSV/Image/Excel)
- Pipeline:
  1) Intake + virus/size/type validation
  2) Document intent check: is it a pricelist? If not, reject with reason and ask for correct file
  3) Extraction: multi-modal OCR (images) + text/structure parsing
  4) Normalization: columns → fields (name, brand, category, size, pack, baseUom, retailUom, unitsPerBase, cartonPrice, piecePrice if given)
  5) Enrichment:
     - Long descriptions, tags, synonyms
     - Similarity to existing catalog (embedding search) and duplicates/variants resolution
     - Cross-market mapping: who else sells it; market price ranges
  6) Images:
     - Google Custom Search to fetch 3-5 references (brand + product)
     - Two best images sent to Replicate FLUX img2img with a strict prompt to match VendAI background (slightly grainy, consistent light angle)
  7) Output: pos_products and inventory docs created per org, with initial qtyBase
- Acceptance: upload → preview parsed items → approve → write to Firestore

## Prompt guidelines (image generation)
- System style: matte, slightly grainy glass look, neutral dark background matching app slate-900, soft top-left light angle
- Subject framing: centered, 5-10% margin, no drop shadow; brand and label legible
- Consistency: same camera FOV, angle, background tone across items
- Example prompt (img2img):
  "Studio product photograph of [Brand] [Product Name], centered on a matte dark-slate background matching Tailwind slate-900, slight film grain, soft top-left key light, minimal reflections, maintain original label colors and typography, remove backgrounds and clutter, maintain true proportions; composition consistent with VendAI product catalog."
