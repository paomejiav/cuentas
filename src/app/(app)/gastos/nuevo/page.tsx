'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { NuevoGastoScreen } from '@/components/app/NuevoGastoScreen'

function NuevoGastoPageInner() {
  const params = useSearchParams()
  return <NuevoGastoScreen personal={params.get('personal') === '1'} />
}

export default function NuevoGastoPage() {
  return (
    <Suspense>
      <NuevoGastoPageInner />
    </Suspense>
  )
}
