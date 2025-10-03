'use client'
import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/loading-spinner'

const InventoryModule = dynamic(() => import('@/components/modules/inventory-module').then(m => m.InventoryModule), {
  ssr: false,
  loading: () => (
    <div className="module-background flex min-h-[calc(100vh-2.5rem)] w-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  ),
})

export default function InventoryPage() {
  return <InventoryModule />
}
