'use client'

import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/loading-spinner'

const POSPage = dynamic(() => import('@/components/modules/pos-page').then(m => m.POSPage), {
  ssr: false,
  loading: () => (
    <div className="min-h-[calc(100vh-160px)] w-full flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  ),
})

export default function Page() {
  return <POSPage />
}
