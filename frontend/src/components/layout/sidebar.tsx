"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Calendar, CalendarDays, Users, LogOut, ChevronUp, ChevronDown, User, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface UserInfo {
  name: string;
  email: string;
  role: string;
  doctorCode?: string;
  avatarUrl?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        // Get user profile from appointments_app schema
        const { data: profile } = await supabase
          .schema('appointments_app')
          .from('user_profiles')
          .select('full_name, role, avatar_url, doctor_code')
          .eq('id', authUser.id)
          .single();

        setUser({
          name: profile?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Utilizador',
          email: authUser.email || '',
          role: profile?.role || 'user',
          doctorCode: profile?.doctor_code || undefined,
          avatarUrl: profile?.avatar_url || undefined,
        });
      }
    }
    loadUser();
  }, []);

  const isAdmin = user?.role === 'admin';

  // Build navigation items based on user role
  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ];

    // Admin Dashboard - only visible to admins
    if (isAdmin) {
      items.push({
        label: 'Admin Dashboard',
        href: '/admin-dashboard',
        icon: BarChart3,
        adminOnly: true,
      });
    }

    // Calendar and Free Slots - visible to all
    items.push(
      {
        label: 'Calendário',
        href: '/appointments',
        icon: CalendarDays,
      },
      {
        label: 'Slots Livres',
        href: '/appointments/empty-slots',
        icon: Calendar,
      }
    );

    return items;
  }, [isAdmin]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'user': return 'Utilizador';
      default: return role;
    }
  };

  return (
    <aside className="w-52 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0">
      {/* Logo Section */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-8 w-8 rounded-lg object-cover"
          />
          <div>
            <h1 className="font-bold text-slate-900 text-base tracking-tight">Appointments</h1>
            <p className="text-[10px] text-slate-500">Centro de Controlo</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/appointments' 
            ? pathname === '/appointments'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-slate-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-slate-100">
        {/* Expanded Menu */}
        {isUserMenuOpen && (
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="px-2 py-1.5 mb-1">
              <p className="font-medium text-slate-900 text-xs truncate">{user?.name || 'Utilizador'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              {user?.doctorCode && (
                <p className="text-[10px] text-cyan-600 truncate">Código: {user.doctorCode}</p>
              )}
            </div>
            
            {/* User Management - Admin only */}
            {isAdmin && (
              <Link
                href="/users"
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                  pathname === '/users'
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
                onClick={() => setIsUserMenuOpen(false)}
              >
                <Users className="h-3.5 w-3.5" />
                Gestão de Utilizadores
              </Link>
            )}
            
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 w-full transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isLoggingOut ? 'A sair...' : 'Terminar Sessão'}
            </button>
          </div>
        )}

        {/* User Button */}
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="w-full p-3 flex items-center gap-2 hover:bg-slate-50 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-medium text-slate-900 text-xs truncate">{user?.name || 'Utilizador'}</p>
            <p className="text-[10px] text-slate-500">{getRoleLabel(user?.role || 'user')}</p>
          </div>
          {isUserMenuOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          )}
        </button>
      </div>
    </aside>
  );
}
