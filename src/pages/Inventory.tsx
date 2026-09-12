import { useState, useEffect, useCallback } from 'react';
import { Warehouse, Search, ArrowUp, ArrowDown, AlertTriangle, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, StockMovement } from '@/lib/supabase';
import { Card, Modal, Input, Select, Textarea, Button, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

type ProductWithCategory = Product & { categories?: { name: string } | null };

export default function Inventory() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'in', quantity: 0, notes: '' });

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
    const { data } = await supabase
      .from('stock_movements')
      .select('*, products(name, sku, unit)')
      .order('created_at', { ascending: false })
      .limit(50);
    setMovements((data || []) as unknown as StockMovement[]);
  }, []);

  useEffect(() => {
    if (tab === 'stock') loadProducts();
    else loadMovements();
  }, [tab, loadProducts, loadMovements]);

  function openAdjust(product: Product) {
    setAdjustProduct(product);
    setAdjustForm({ type: 'in', quantity: 0, notes: '' });
    setAdjustModal(true);
  }

  async function saveAdjust() {
    if (!adjustProduct || adjustForm.quantity <= 0) return;
    const qty = adjustForm.type === 'in' ? adjustForm.quantity : -adjustForm.quantity;
    const newStock = adjustProduct.current_stock + qty;

    await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', adjustProduct.id);
    await supabase.from('stock_movements').insert({
      product_id: adjustProduct.id,
      movement_type: adjustForm.type,
      quantity: Math.abs(qty),
      reference_type: 'adjustment',
      notes: adjustForm.notes || (adjustForm.type === 'in' ? 'Stock added' : 'Stock removed'),
    });

    setAdjustModal(false);
    loadProducts();
  }

  const totalStockValue = products.reduce((s, p) => s + p.current_stock * p.purchase_price, 0);
  const lowStockCount = products.filter((p) => p.current_stock <= p.minimum_stock && p.minimum_stock > 0).length;
  const outOfStockCount = products.filter((p) => p.current_stock <= 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500 mt-1">Track and manage stock levels</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total Stock Value</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalStockValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Low Stock Items</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{lowStockCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Out of Stock</p>
          <p className="text-xl font-bold text-red-500 mt-1">{outOfStockCount}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
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
          Stock History
        </button>
      </div>

      {tab === 'stock' ? (
        <>
          <Card className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                placeholder="Search products..."
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
                      <th className="text-right px-4 py-3 font-medium">Current Stock</th>
                      <th className="text-right px-4 py-3 font-medium">Min Stock</th>
                      <th className="text-right px-4 py-3 font-medium">Value</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Adjust</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => {
                      const lowStock = p.current_stock <= p.minimum_stock && p.minimum_stock > 0;
                      const outOfStock = p.current_stock <= 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{p.name}</div>
                            <div className="text-xs text-slate-400">{p.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.categories?.name || '-'}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">{p.current_stock} {p.unit}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{p.minimum_stock} {p.unit}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(p.current_stock * p.purchase_price)}</td>
                          <td className="px-4 py-3 text-center">
                            {outOfStock ? <Badge color="red">Out of Stock</Badge> : lowStock ? <Badge color="amber">Low Stock</Badge> : <Badge color="green">In Stock</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => openAdjust(p)}>Adjust</Button>
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
      ) : (
        <Card className="overflow-hidden">
          {movements.length === 0 ? (
            <EmptyState icon={<History className="w-8 h-8" />} title="No stock movements yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Quantity</th>
                    <th className="text-left px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(movements as unknown as Array<StockMovement & { products: { name: string; sku: string; unit: string } }>).map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{formatDate(m.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{m.products?.name || '-'}</td>
                      <td className="px-4 py-3">
                        {m.movement_type === 'in' ? (
                          <Badge color="green"><ArrowUp className="w-3 h-3 inline mr-1" />Stock In</Badge>
                        ) : m.movement_type === 'out' ? (
                          <Badge color="red"><ArrowDown className="w-3 h-3 inline mr-1" />Stock Out</Badge>
                        ) : m.movement_type === 'adjustment' ? (
                          <Badge color="blue">Adjustment</Badge>
                        ) : m.movement_type === 'damage' ? (
                          <Badge color="red">Damaged</Badge>
                        ) : (
                          <Badge color="slate">{m.movement_type}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{m.quantity} {m.products?.unit || ''}</td>
                      <td className="px-4 py-3 text-slate-500">{m.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Adjust Modal */}
      <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="Adjust Stock" size="sm">
        {adjustProduct && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-900">{adjustProduct.name}</p>
              <p className="text-sm text-slate-500">Current stock: {adjustProduct.current_stock} {adjustProduct.unit}</p>
            </div>
            <Select label="Adjustment Type" value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
              <option value="in">Stock In (+)</option>
              <option value="out">Stock Out (-)</option>
              <option value="damage">Damaged (-)</option>
            </Select>
            <Input label="Quantity" type="number" value={adjustForm.quantity || ''} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })} />
            <Textarea label="Notes" rows={2} value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setAdjustModal(false)}>Cancel</Button>
              <Button onClick={saveAdjust}>Save Adjustment</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
