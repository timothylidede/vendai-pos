'use client'

import dynamic from 'next/dynamic'

const SupplierModule = dynamic(
  () => import('@/components/modules/supplier-module').then(m => m.SupplierModule),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-300">Loading Suppliers…</div>
    )
  }
)

export default function SupplierPage() {
  return <SupplierModule />
}
