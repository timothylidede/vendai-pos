'use client'
import dynamic from 'next/dynamic'

const InventoryModule = dynamic(() => import('@/components/modules/inventory-module').then(m => m.InventoryModule), {
  ssr: false,
  loading: () => (
    <div className="min-h-[50vh] flex items-center justify-center text-slate-300">Loading Inventory…</div>
  ),
})

export default function InventoryPage() {
  return <InventoryModule />
}
