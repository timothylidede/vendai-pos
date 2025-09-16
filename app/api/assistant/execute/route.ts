import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
This endpoint is a thin controller that your Copilot/LLM can call into. It does not call an LLM here; it just parses input and returns a suggested plan structure.
*/

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }
  const { orgId, userId, command, context } = body || {}
  if (!orgId || !userId || !command) return NextResponse.json({ ok: false, error: 'orgId, userId, command required' }, { status: 400 })

  // Extremely simple intent hints; replace with LLM routing later
  let action = 'answer'
  if (/reorder/i.test(command)) action = 'place_reorder'
  else if (/regenerate image|image/i.test(command)) action = 'regenerate_image'
  else if (/map.*unmapped/i.test(command)) action = 'open_mapping_ui'

  return NextResponse.json({
    ok: true,
    plan: {
      action,
      steps: action === 'place_reorder' ? [
        'identify_sku_and_qty',
        'choose_supplier_by_lead_time_and_cost',
        'create_purchase_order',
        'notify_supplier'
      ] : action === 'regenerate_image' ? [
        'call_/api/image/generate_with_sku',
        'review_image',
        'update_pos_products.image'
      ] : action === 'open_mapping_ui' ? [
        'fetch_pos_exceptions',
        'show_ai_suggestions',
        'save_pos_mappings'
      ] : [ 'answer_question' ],
      contextEcho: context || null
    }
  })
}
