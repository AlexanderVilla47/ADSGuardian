import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

const navItems = [
  { path: '/dashboard', label: 'Panel de Control', icon: LayoutDashboard },
  { path: '/contracts', label: 'Influencers', icon: Users },
  { path: '/history', label: 'Historial Operativo', icon: History },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-secondary border-r border-border">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center px-6 border-b border-border">
        <img src="/logo.png" alt="AdsKiller" className="h-12 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === '/dashboard' && location.pathname === '/');
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-accent text-primary font-semibold'
                      : 'text-accent-foreground hover:bg-accent/50 hover:text-primary'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Theme Toggle - abajo a la izquierda */}
      <div className="p-4 border-t border-border flex justify-start">
        <ThemeToggle />
      </div>
    </aside>
  );
}