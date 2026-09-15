import { useState, useEffect } from 'react';
import Layout, { type PageId } from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import POS from '@/pages/POS';
import Customers from '@/pages/Customers';
import Suppliers from '@/pages/Suppliers';
import Purchases from '@/pages/Purchases';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Expenses from '@/pages/Expenses';
import SalesHistory from '@/pages/SalesHistory';
import { supabase } from '@/lib/supabase';

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <Layout currentPage={page} onPageChange={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'products' && <Products />}
      {page === 'inventory' && <Inventory />}
      {page === 'pos' && <POS />}
      {page === 'sales-history' && <SalesHistory />}
      {page === 'customers' && <Customers />}
      {page === 'suppliers' && <Suppliers />}
      {page === 'purchases' && <Purchases />}
      {page === 'expenses' && <Expenses />}
      {page === 'reports' && <Reports />}
      {page === 'settings' && <Settings />}
    </Layout>
  );
}
