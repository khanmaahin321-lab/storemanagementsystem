import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Calendar, Package, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StockMovement, Product } from '@/lib/supabase';
import { Card, Badge, Button, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

type StockMovementWithRelations = StockMovement & {
  products?: { name: string; unit: string } | null;
  customers?: { name: string } | null;
  suppliers?: { name: string } | null;
};

export default function StockMovements() {
  const [movements, setMovements] = useState<StockMovementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadMovements = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('stock_movements')
      .select('*, products(name, unit), customers(name), suppliers(name)')
      .order('created_at', { ascending: false });

    if (search) {
      // Search in product names or reference numbers
      query = query.or(`reference_number.ilike.%${search}%`);
    }

    if (filterType) {
      query = query.eq('movement_type', filterType);
    }

    if (filterProduct) {
      query = query.eq('product_id', filterProduct);
    }

    if (filterDateFrom) {
      query = query.gte('created_at', `${filterDateFrom}T00:00:00`);
    }

    if (filterDateTo) {
      query = query.lte('created_at', `${filterDateTo}T23:59:59`);
    }

    const { data } = await query;
    setMovements((data || []) as StockMovementWithRelations[]);
    setCurrentPage(1);
    setLoading(false);
  }, [search, filterType, filterProduct, filterDateFrom, filterDateTo]);

  useEffect(() => {
    supabase.from('products').select('id, name').order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'opening':
        return 'bg-blue-100 text-blue-800';
      case 'in':
      case 'adjustment_in':
      case 'sales_return':
      case 'purchase_return':
        return 'bg-green-100 text-green-800';
      case 'out':
      case 'adjustment_out':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getMovementTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      opening: 'Opening Stock',
      in: 'Stock In',
      out: 'Stock Out',
      adjustment_in: 'Adjustment +',
      adjustment_out: 'Adjustment -',
      sales_return: 'Sales Return',
      purchase_return: 'Purchase Return',
    };
    return labels[type] || type;
  };

  const isInMovement = (type: string) => {
    return ['opening', 'in', 'adjustment_in', 'sales_return'].includes(type);
  };

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedMovements = movements.slice(startIdx, endIdx);
  const totalPages = Math.ceil(movements.length / itemsPerPage);

  const exportToCSV = () => {
    const headers = ['Date', 'Product', 'Type', 'Quantity', 'Unit', 'Balance', 'Reference', 'Supplier/Customer', 'Reason'];
    const rows = movements.map((m) => [
      formatDate(m.created_at),
      m.products?.name || '-',
      getMovementTypeLabel(m.movement_type),
      m.quantity,
      m.products?.unit || '-',
      m.balance_after,
      m.reference_number || '-',
      m.supplier_id ? m.suppliers?.name : m.customer_id ? m.customers?.name : '-',
      m.reason || '-',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Movements</h1>
          <p className="text-sm text-slate-500 mt-1">View and analyze all stock transactions</p>
        </div>
        <Button onClick={exportToCSV} variant="secondary">
          <Download className="w-4 h-4 inline mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              placeholder="Search by reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Types</option>
            <option value="opening">Opening Stock</option>
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="adjustment_in">Adjustment +</option>
            <option value="adjustment_out">Adjustment -</option>
            <option value="sales_return">Sales Return</option>
            <option value="purchase_return">Purchase Return</option>
          </select>
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="From"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="To"
            />
          </div>
        </div>
        {(search || filterType || filterProduct || filterDateFrom || filterDateTo) && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {movements.length} result{movements.length !== 1 ? 's' : ''} found
          </div>
        )}
      </Card>

      {/* Movements table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : movements.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No movements found"
            description="Stock movements will appear here as you perform transactions"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-right px-4 py-3 font-medium">Quantity</th>
                  <th className="text-right px-4 py-3 font-medium">Balance</th>
                  <th className="text-left px-4 py-3 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 font-medium">Party</th>
                  <th className="text-left px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedMovements.map((m) => {
                  const isIn = isInMovement(m.movement_type);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(m.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{m.products?.name || '-'}</div>
                        <div className="text-xs text-slate-400">{m.products?.unit || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getMovementTypeColor(m.movement_type)}>
                          {getMovementTypeLabel(m.movement_type)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                          {isIn ? '+' : '-'}{m.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{m.balance_after}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{m.reference_number || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {m.supplier_id ? m.suppliers?.name : m.customer_id ? m.customers?.name : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{m.reason || m.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing {startIdx + 1} to {Math.min(endIdx, movements.length)} of {movements.length} movements
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  currentPage === page
                    ? 'bg-amber-500 text-white'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
