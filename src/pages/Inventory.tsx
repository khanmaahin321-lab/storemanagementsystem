import { useState, useEffect, useCallback } from 'react';
import {
  Warehouse,
  Search,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  History,
  Plus,
  Minus,
  Package,
  TrendingUp,
  TrendingDown,
  Sliders,
  Filter,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, StockMovement, Supplier, Customer } from '@/lib/supabase';
import { Card, Modal, Input, Select, Textarea, Button, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

type ProductWithCategory = Product & { categories?: { name: string } | null };
type MovementWithDetails = StockMovement & {
  products?: { name: string; sku: string; unit: string } | null;
  suppliers?: { name: string } | null;
  customers?: { name: string } | null;
};

const ADJUSTMENT_REASONS = [
  'Damaged',
  'Broken',
  'Missing',
  'Extra Stock Found',
  'Wrong Entry',
  'Physical Stock Correction',
  'Other',
];

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  in: 'Stock In',
  out: 'Stock Out',
  adjustment_in: 'Adjustment +',
  adjustment_out: 'Adjustment -',
  opening: 'Opening Stock',
  damage: 'Damaged',
};

export default function Inventory() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'movements' | 'adjust' | 'stockin'>('stock');

  // Modals
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'adjustment_in', quantity: 0, reason: 'Physical Stock Correction', notes: '' });

  const [stockInModal, setStockInModal] = useState(false);
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInForm, setStockInForm] = useState({ quantity: 0, purchasePrice: 0, supplierId: '', purchaseDate: new Date().toISOString().split('T')[0], referenceNumber: '', notes: '' });

  // Filters for movements
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, categories(name)')
      .order('name', { ascending: true });
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    const { data } = await query;
    setProducts((data || []) as ProductWithCategory[]);
    setLoading(false);
  }, [search]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('stock_movements')
      .select('*, products(name, sku, unit), suppliers(name), customers(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filterProduct) query = query.eq('product_id', filterProduct);
    if (filterType) query = query.eq('movement_type', filterType);
    if (filterDate) query = query.gte('created_at', `${filterDate}T00:00:00`).lte('created_at', `${filterDate}T23:59:59`);
    const { data } = await query;
    setMovements((data || []) as MovementWithDetails[]);
    setLoading(false);
  }, [filterProduct, filterType, filterDate]);

  useEffect(() => {
    supabase.from('suppliers').select('*').order('name').then(({ data }) => {
      if (data) setSuppliers(data as Supplier[]);
    });
    supabase.from('customers').select('*').order('name').then(({ data }) => {
      if (data) setCustomers(data as Customer[]);
    });
  }, []);

  useEffect(() => {
    if (tab === 'stock' || tab === 'adjust' || tab === 'stockin') loadProducts();
    else loadMovements();
  }, [tab, loadProducts, loadMovements]);

  function openAdjust(product: Product) {
    setAdjustProduct(product);
    setAdjustForm({ type: 'adjustment_in', quantity: 0, reason: 'Physical Stock Correction', notes: '' });
    setAdjustModal(true);
  }

  function openStockIn(product: Product) {
    setStockInProduct(product);
    setStockInForm({
      quantity: 0,
      purchasePrice: product.purchase_price,
      supplierId: product.supplier_id || '',
      purchaseDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      notes: '',
    });
    setStockInModal(true);
  }

  async function saveAdjust() {
    if (!adjustProduct || adjustForm.quantity <= 0) return;
    const isAdd = adjustForm.type === 'adjustment_in';
    const qty = isAdd ? adjustForm.quantity : -adjustForm.quantity;
    const newStock = adjustProduct.current_stock + qty;

    if (newStock < 0) {
      alert('Stock cannot go negative. Current stock is ' + adjustProduct.current_stock + ' ' + adjustProduct.unit);
      return;
    }

    await supabase
      .from('products')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', adjustProduct.id);

    await supabase.from('stock_movements').insert({
      product_id: adjustProduct.id,
      movement_type: adjustForm.type,
      quantity: adjustForm.quantity,
      reference_type: 'adjustment',
      reason: adjustForm.reason,
      notes: adjustForm.notes || adjustForm.reason,
      balance_after: newStock,
      unit_cost: adjustProduct.purchase_price,
      user_name: 'admin',
    });

    setAdjustModal(false);
    loadProducts();
  }

  async function saveStockIn() {
    if (!stockInProduct || stockInForm.quantity <= 0) return;
    const newStock = stockInProduct.current_stock + stockInForm.quantity;

    await supabase
      .from('products')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', stockInProduct.id);

    await supabase.from('stock_movements').insert({
      product_id: stockInProduct.id,
      movement_type: 'in',
      quantity: stockInForm.quantity,
      reference_type: 'stock_in',
      reference_number: stockInForm.referenceNumber || null,
      supplier_id: stockInForm.supplierId || null,
      unit_cost: stockInForm.purchasePrice,
      balance_after: newStock,
      notes: stockInForm.notes || 'Manual stock in',
      user_name: 'admin',
    });

    setStockInModal(false);
    loadProducts();
  }

  const totalStockValue = products.reduce((s, p) => s + p.current_stock * p.purchase_price, 0);
  const lowStockCount = products.filter((p) => p.current_stock <= p.minimum_stock && p.minimum_stock > 0 && p.current_stock > 0).length;
  const outOfStockCount = products.filter((p) => p.current_stock <= 0).length;
  const totalProducts = products.length;

  // Today's movement stats
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMovements = movements.filter((m) => m.created_at.startsWith(todayStr));
  const stockInToday = todayMovements.filter((m) => m.movement_type === 'in' || m.movement_type === 'adjustment_in').reduce((s, m) => s + m.quantity, 0);
  const stockOutToday = todayMovements.filter((m) => m.movement_type === 'out' || m.movement_type === 'adjustment_out').reduce((s, m) => s + m.quantity, 0);
  const adjustmentsToday = todayMovements.filter((m) => m.movement_type === 'adjustment_in' || m.movement_type === 'adjustment_out').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory & Stock Management</h1>
        <p className="text-sm text-slate-500 mt-1">Track stock levels, adjustments, and movement history</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm text-slate-500">Total Products</p>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">{totalProducts}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-500">Stock Value</p>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">{formatCurrency(totalStockValue)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm text-slate-500">Low Stock</p>
          </div>
          <p className="text-xl font-bold text-amber-600 mt-2">{lowStockCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-sm text-slate-500">Out of Stock</p>
          </div>
          <p className="text-xl font-bold text-red-500 mt-2">{outOfStockCount}</p>
        </Card>
      </div>

      {/* Today's movement stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Stock In Today</p>
            <ArrowUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-600 mt-1">{stockInToday} units</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Stock Out Today</p>
            <ArrowDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-lg font-bold text-red-500 mt-1">{stockOutToday} units</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Adjustments Today</p>
            <Sliders className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-blue-600 mt-1">{adjustmentsToday}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('stock')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'stock' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          Current Stock
        </button>
        <button
          onClick={() => setTab('movements')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'movements' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          <History className="w-4 h-4 inline mr-1" />
          Stock Movement History
        </button>
      </div>

      {tab === 'stock' && (
        <>
          <Card className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                placeholder="Search products by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
            ) : products.length === 0 ? (
              <EmptyState icon={<Warehouse className="w-8 h-8" />} title="No products found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Product</th>
                      <th className="text-left px-4 py-3 font-medium">Category</th>
                      <th className="text-left px-4 py-3 font-medium">Unit</th>
                      <th className="text-right px-4 py-3 font-medium">Opening</th>
                      <th className="text-right px-4 py-3 font-medium">Current</th>
                      <th className="text-right px-4 py-3 font-medium">Min Level</th>
                      <th className="text-right px-4 py-3 font-medium">Stock Value</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => {
                      const lowStock = p.current_stock <= p.minimum_stock && p.minimum_stock > 0 && p.current_stock > 0;
                      const outOfStock = p.current_stock <= 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{p.name}</div>
                            <div className="text-xs text-slate-400">{p.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.categories?.name || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{p.opening_stock}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">{p.current_stock}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{p.minimum_stock}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(p.current_stock * p.purchase_price)}</td>
                          <td className="px-4 py-3 text-center">
                            {outOfStock ? <Badge color="red">Out of Stock</Badge> : lowStock ? <Badge color="amber">Low Stock</Badge> : <Badge color="green">In Stock</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => openStockIn(p)}
                                className="px-2 py-1 text-xs rounded bg-green-50 text-green-600 hover:bg-green-100 font-medium"
                                title="Add Stock"
                              >
                                <Plus className="w-3 h-3 inline" /> Stock In
                              </button>
                              <button
                                onClick={() => openAdjust(p)}
                                className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
                                title="Adjust Stock"
                              >
                                <Sliders className="w-3 h-3 inline" /> Adjust
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'movements' && (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Product</label>
                <select
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">All Products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Movement Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">All Types</option>
                  <option value="in">Stock In / Purchase</option>
                  <option value="out">Stock Out / Sale</option>
                  <option value="adjustment_in">Adjustment (+)</option>
                  <option value="adjustment_out">Adjustment (-)</option>
                  <option value="opening">Opening Stock</option>
                  <option value="damage">Damaged</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Date</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilterProduct('');
                    setFilterType('');
                    setFilterDate('');
                  }}
                >
                  <X className="w-4 h-4 inline mr-1" /> Clear
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
            ) : movements.length === 0 ? (
              <EmptyState icon={<History className="w-8 h-8" />} title="No stock movements found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Product</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-right px-4 py-3 font-medium">Qty</th>
                      <th className="text-right px-4 py-3 font-medium">Balance</th>
                      <th className="text-left px-4 py-3 font-medium">Reference</th>
                      <th className="text-left px-4 py-3 font-medium">Supplier/Customer</th>
                      <th className="text-left px-4 py-3 font-medium">Reason</th>
                      <th className="text-left px-4 py-3 font-medium">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(m.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{m.products?.name || '-'}</div>
                          <div className="text-xs text-slate-400">{m.products?.sku}</div>
                        </td>
                        <td className="px-4 py-3">
                          {m.movement_type === 'in' && <Badge color="green"><ArrowUp className="w-3 h-3 inline mr-1" />Stock In</Badge>}
                          {m.movement_type === 'out' && <Badge color="red"><ArrowDown className="w-3 h-3 inline mr-1" />Stock Out</Badge>}
                          {m.movement_type === 'adjustment_in' && <Badge color="blue"><Plus className="w-3 h-3 inline mr-1" />Adjust +</Badge>}
                          {m.movement_type === 'adjustment_out' && <Badge color="blue"><Minus className="w-3 h-3 inline mr-1" />Adjust -</Badge>}
                          {m.movement_type === 'opening' && <Badge color="slate">Opening</Badge>}
                          {m.movement_type === 'damage' && <Badge color="red">Damaged</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {m.movement_type === 'out' || m.movement_type === 'adjustment_out' || m.movement_type === 'damage' ? '-' : '+'}
                          {m.quantity} {m.products?.unit || ''}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{m.balance_after || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{m.reference_number || m.reference_type || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {m.suppliers?.name || m.customers?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{m.reason || m.notes || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{m.user_name || 'admin'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Adjust Modal */}
      <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="Stock Adjustment" size="md">
        {adjustProduct && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-900">{adjustProduct.name}</p>
              <p className="text-sm text-slate-500">Current stock: {adjustProduct.current_stock} {adjustProduct.unit}</p>
              <p className="text-sm text-slate-500">Stock value: {formatCurrency(adjustProduct.current_stock * adjustProduct.purchase_price)}</p>
            </div>
            <Select label="Adjustment Type" value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
              <option value="adjustment_in">Add Stock (+)</option>
              <option value="adjustment_out">Remove Stock (-)</option>
            </Select>
            <Select label="Reason" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}>
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            <Input
              label="Quantity"
              type="number"
              value={adjustForm.quantity || ''}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
            />
            <Textarea label="Notes" rows={2} value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
            <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
              New stock will be: {adjustForm.type === 'adjustment_in' ? adjustProduct.current_stock + adjustForm.quantity : Math.max(0, adjustProduct.current_stock - adjustForm.quantity)} {adjustProduct.unit}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setAdjustModal(false)}>Cancel</Button>
              <Button onClick={saveAdjust}>Save Adjustment</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock In Modal */}
      <Modal open={stockInModal} onClose={() => setStockInModal(false)} title="Stock In - Add New Stock" size="md">
        {stockInProduct && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-900">{stockInProduct.name}</p>
              <p className="text-sm text-slate-500">Current stock: {stockInProduct.current_stock} {stockInProduct.unit}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Quantity *"
                type="number"
                value={stockInForm.quantity || ''}
                onChange={(e) => setStockInForm({ ...stockInForm, quantity: Number(e.target.value) })}
              />
              <Input
                label="Purchase Price"
                type="number"
                value={stockInForm.purchasePrice || ''}
                onChange={(e) => setStockInForm({ ...stockInForm, purchasePrice: Number(e.target.value) })}
              />
            </div>
            <Select label="Supplier" value={stockInForm.supplierId} onChange={(e) => setStockInForm({ ...stockInForm, supplierId: e.target.value })}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Purchase Date" type="date" value={stockInForm.purchaseDate} onChange={(e) => setStockInForm({ ...stockInForm, purchaseDate: e.target.value })} />
              <Input label="Reference / Invoice #" value={stockInForm.referenceNumber} onChange={(e) => setStockInForm({ ...stockInForm, referenceNumber: e.target.value })} />
            </div>
            <Textarea label="Notes" rows={2} value={stockInForm.notes} onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })} />
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
              New stock will be: {stockInProduct.current_stock + stockInForm.quantity} {stockInProduct.unit}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setStockInModal(false)}>Cancel</Button>
              <Button onClick={saveStockIn}>Save Stock In</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
