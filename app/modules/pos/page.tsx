'use client'

import dynamic from 'next/dynamic'

const POSPage = dynamic(() => import('@/components/modules/pos-page').then(m => m.POSPage), {
  ssr: false,
  loading: () => (
    <div className="min-h-[50vh] flex items-center justify-center text-slate-300">Loading POS…</div>
  ),
})

export default function Page() {
  return <POSPage />
}
