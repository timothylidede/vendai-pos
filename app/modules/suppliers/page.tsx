'use client'

import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/loading-spinner'

const SupplierModule = dynamic(
  () => import('@/components/modules/supplier-module').then(m => m.SupplierModule),
  {
    ssr: false,
    loading: () => (
      <div className="module-background flex min-h-[calc(100vh-2.5rem)] w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
)

export default function SupplierPage() {
  return <SupplierModule />
}
