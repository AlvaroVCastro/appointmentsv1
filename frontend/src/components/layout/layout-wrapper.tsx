"use client";

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';

// Routes where the sidebar should be hidden
const noSidebarRoutes = ['/login', '/auth/callback'];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const showSidebar = !noSidebarRoutes.some(route => pathname.startsWith(route));

  if (!showSidebar) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        {children}
      </main>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </>
  );
}
