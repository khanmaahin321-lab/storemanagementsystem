import { useState } from 'react';
import Layout, { type PageId } from '@/components/Layout';
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

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard');

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
