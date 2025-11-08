import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Middleware logic can be added here if needed
}

export const config = {
  matcher: '/register',
}