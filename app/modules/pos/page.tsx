'use client'

import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/loading-spinner'

const POSPage = dynamic(() => import('@/components/modules/pos-page').then(m => m.POSPage), {
  ssr: false,
  loading: () => (
    <div className="module-background flex min-h-[calc(100vh-2.5rem)] w-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  ),
})

export default function Page() {
  return <POSPage />
}
