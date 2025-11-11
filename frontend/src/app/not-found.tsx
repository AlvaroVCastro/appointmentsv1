import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">404 - Page Not Found</CardTitle>
          <CardDescription>
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              This could happen if:
            </p>
            <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
              <li>The URL is incorrect or mistyped</li>
              <li>The page has been moved or deleted</li>
              <li>There's a routing configuration issue</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/appointments">Go to Appointments</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

