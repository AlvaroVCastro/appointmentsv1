'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="h-full flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-red-600">Something went wrong!</CardTitle>
          <CardDescription>
            An unexpected error occurred in the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Error Details:</p>
            <div className="bg-slate-100 p-3 rounded text-xs font-mono text-slate-700 break-all">
              {error.message || 'Unknown error occurred'}
            </div>
            {error.digest && (
              <p className="text-xs text-slate-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset}>
              Try Again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/appointments">Go to Appointments</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

