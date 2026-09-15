import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  Truck,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
  Receipt,
  Wallet,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Settings as SettingsType } from '@/lib/supabase';

export type PageId =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'pos'
  | 'sales-history'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'expenses'
  | 'reports'
  | 'settings';

type NavItem = {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Warehouse },
  { id: 'pos', label: 'POS / Billing', icon: ShoppingCart },
  { id: 'sales-history', label: 'Sales History', icon: Receipt },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'purchases', label: 'Purchases', icon: FileText },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

type LayoutProps = {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  children: React.ReactNode;
};

export default function Layout({ currentPage, onPageChange, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shopSettings, setShopSettings] = useState<SettingsType | null>(null);

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setShopSettings(data as SettingsType);
      });
  }, []);

  const shopName = shopSettings?.shop_name || 'Vaishnav Marble Shop';
  const logoSrc = shopSettings?.logo_url || '/vaishnavi-marble-logo.svg';

  const handleNavClick = (page: PageId) => {
    onPageChange(page);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center">
            <img src={logoSrc} alt="Vaishnavi Marble logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate">{shopName}</h1>
            <p className="text-xs text-slate-400">Management System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-slate-700 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          <p className="text-xs text-slate-500">© 2026 Vaishnav Marble</p>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Vaishnavi Marble logo" className="w-7 h-7 rounded-md" />
            <span className="font-bold text-sm">{shopName}</span>
          </div>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
