'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Package, Smartphone, Play, BarChart3, Calendar, FlaskConical } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/test-cases', label: 'Test Cases', icon: FileText },
  { href: '/builds', label: 'Builds', icon: Package },
  { href: '/devices', label: 'Devices', icon: Smartphone },
  { href: '/execution', label: 'Execution', icon: Play },
  { href: '/results', label: 'Results', icon: BarChart3 },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-green-600" />
            <span className="font-bold text-gray-900">QA Platform</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
