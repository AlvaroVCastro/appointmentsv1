import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Log requests for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware]', request.method, request.nextUrl.pathname);
  }

  // Handle root path explicitly
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/appointments', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

