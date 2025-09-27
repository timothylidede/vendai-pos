'use client'

import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/loading-spinner'

const SupplierModule = dynamic(
  () => import('@/components/modules/supplier-module').then(m => m.SupplierModule),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[calc(100vh-160px)] w-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
)

export default function SupplierPage() {
  return <SupplierModule />
}
