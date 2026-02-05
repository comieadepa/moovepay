import { Suspense } from 'react'
import SignUpClient from './signup-client'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpClient />
    </Suspense>
  )
}
