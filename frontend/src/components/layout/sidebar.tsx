"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Calendar, CalendarDays, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Calendário',
    href: '/appointments',
    icon: CalendarDays,
  },
  {
    label: 'Slots Livres',
    href: '/appointments/empty-slots',
    icon: Calendar,
  },
  {
    label: 'Gestão de Utilizadores',
    href: '/users',
    icon: Users,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Logo Section */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <img 
            src="/augustalabs_logo.jpeg" 
            alt="Augusta Labs" 
            className="h-10 w-10 rounded-lg object-cover"
          />
          <div>
            <h1 className="font-bold text-slate-900 text-lg tracking-tight">Malo Clinic</h1>
            <p className="text-xs text-slate-500">Agenda Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          // Special handling: /appointments should not match /appointments/empty-slots
          const isActive = item.href === '/appointments' 
            ? pathname === '/appointments'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-slate-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100">
        <div className="px-4 py-3 rounded-xl bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Powered by <span className="font-semibold text-cyan-600">Augusta Labs</span>
          </p>
        </div>
      </div>
    </aside>
  );
}

