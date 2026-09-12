import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Search, Trash2, Eye, ShoppingCart, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Purchase, PurchaseItem, Product, Supplier, Settings as SettingsType } from '@/lib/supabase';
import { Card, Modal, Input, Select, Button, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate, todayISO } from '@/lib/utils';

type CartItem = { product: Product; quantity: number; rate: number; gst_percent: number };

export default function Purchases() {
  const [purchases, setPurchases] = useState<(Purchase & { suppliers: { name: string } | null })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [viewItems, setViewItems] = useState<PurchaseItem[]>([]);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);

  // Create form
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transportCost, setTransportCost] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [productSearch, setProductSearch] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadPurchases();
    supabase.from('products').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
    supabase.from('suppliers').select('*').order('name').then(({ data }) => {
      if (data) setSuppliers(data as Supplier[]);
    });
    supabase.from('settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SettingsType);
    });
  }, []);

  async function loadPurchases() {
    setLoading(true);
    let query = supabase
      .from('purchases')
      .select('*, suppliers(name)')
      .order('created_at', { ascending: false });
    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%`);
    }
    const { data } = await query;
    setPurchases((data || []) as (Purchase & { suppliers: { name: string } | null })[]);
    setLoading(false);
  }

  useEffect(() => { loadPurchases(); }, [search]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 20);
    return products.filter(
      (p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()),
    ).slice(0, 20);
  }, [products, productSearch]);

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.rate, 0);
  const gstAmount = cart.reduce((s, i) => s + (i.quantity * i.rate * i.gst_percent) / 100, 0);
  const totalAmount = subtotal + gstAmount + transportCost + otherExpenses;
  const amountDue = totalAmount - amountPaid;

  function addToCart(product: Product) {
    const existing = cart.find((c) => c.product.id === product.id);
    if (existing) {
      setCart(cart.map((c) => (c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { product, quantity: 1, rate: product.purchase_price, gst_percent: product.gst_percent }]);
    }
  }

  function updateQty(productId: string, qty: number) {
    setCart(cart.map((c) => (c.product.id === productId ? { ...c, quantity: Math.max(0, qty) } : c)).filter((c) => c.quantity > 0));
  }

  function setRate(productId: string, rate: number) {
    setCart(cart.map((c) => (c.product.id === productId ? { ...c, rate } : c)));
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((c) => c.product.id !== productId));
  }

  async function savePurchase() {
    if (cart.length === 0) return;

    const prefix = settings?.purchase_prefix || 'PUR';
    const counter = settings?.purchase_counter || 1;
    const invoiceNumber = `${prefix}-${String(counter).padStart(5, '0')}`;

    const purchaseData: Omit<Purchase, 'id' | 'created_at'> = {
      invoice_number: invoiceNumber,
      supplier_id: supplierId || null,
      purchase_date: purchaseDate,
      subtotal,
      gst_amount: gstAmount,
      transport_cost: transportCost,
      other_expenses: otherExpenses,
      total_amount: totalAmount,
      amount_paid: amountPaid || totalAmount,
      amount_due: amountDue,
      payment_method: paymentMethod,
      notes,
    };

    const { data: purchase } = await supabase.from('purchases').insert(purchaseData).select('*').single();
    if (!purchase) return;
    const purchaseId = (purchase as Purchase).id;

    const items: Omit<PurchaseItem, 'id' | 'created_at'>[] = cart.map((item) => ({
      purchase_id: purchaseId,
      product_id: item.product.id,
      quantity: item.quantity,
      rate: item.rate,
      gst_percent: item.gst_percent,
      gst_amount: (item.quantity * item.rate * item.gst_percent) / 100,
      total: item.quantity * item.rate + (item.quantity * item.rate * item.gst_percent) / 100,
    }));
    await supabase.from('purchase_items').insert(items);

    for (const item of cart) {
      const newStock = item.product.current_stock + item.quantity;
      await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', item.product.id);
      await supabase.from('stock_movements').insert({
        product_id: item.product.id,
        movement_type: 'in',
        quantity: item.quantity,
        reference_type: 'purchase',
        reference_id: purchaseId,
        notes: `Purchase ${invoiceNumber}`,
      });
    }

    if (supplierId && amountDue > 0) {
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (supplier) {
        await supabase.from('suppliers').update({ outstanding_balance: supplier.outstanding_balance + amountDue }).eq('id', supplierId);
      }
    }

    if (settings) {
      await supabase.from('settings').update({ purchase_counter: counter + 1 }).eq('id', settings.id);
    }

    setCreateModal(false);
    setCart([]);
    setSupplierId('');
    setTransportCost(0);
    setOtherExpenses(0);
    setAmountPaid(0);
    setNotes('');
    loadPurchases();
  }

  async function openViewPurchase(p: Purchase) {
    setViewPurchase(p);
    const { data } = await supabase
      .from('purchase_items')
      .select('*, products(name, sku, unit)')
      .eq('purchase_id', p.id);
    setViewItems((data || []) as unknown as (PurchaseItem & { products: { name: string; sku: string; unit: string } })[]);
    setViewModal(true);
  }

  async function removePurchase(id: string) {
    if (!confirm('Delete this purchase? Stock will not be automatically reversed.')) return;
    await supabase.from('purchases').delete().eq('id', id);
    loadPurchases();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
          <p className="text-sm text-slate-500 mt-1">Record supplier purchases</p>
        </div>
        <Button onClick={() => setCreateModal(true)}><Plus className="w-4 h-4 inline mr-1" />New Purchase</Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            placeholder="Search by invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : purchases.length === 0 ? (
          <EmptyState icon={<FileText className="w-8 h-8" />} title="No purchases found" action={<Button onClick={() => setCreateModal(true)}><Plus className="w-4 h-4 inline mr-1" />New Purchase</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Supplier</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Paid</th>
                  <th className="text-right px-4 py-3 font-medium">Due</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(p.purchase_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.suppliers?.name || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(p.amount_paid)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.amount_due > 0 ? <Badge color="red">{formatCurrency(p.amount_due)}</Badge> : <Badge color="green">Paid</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openViewPurchase(p)} className="text-slate-400 hover:text-amber-600 p-1"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => removePurchase(p.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Purchase Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Purchase" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Purchase Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>

          {/* Product search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              placeholder="Search products to add..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {filteredProducts.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left p-2 bg-slate-50 rounded-lg hover:bg-amber-50 text-sm">
                <p className="font-medium text-slate-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{formatCurrency(p.purchase_price)}/{p.unit}</p>
              </button>
            ))}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-900 flex-1 truncate">{item.product.name}</span>
                  <input type="number" value={item.quantity} onChange={(e) => updateQty(item.product.id, Number(e.target.value))} className="w-16 px-2 py-1 text-center text-sm border border-slate-300 rounded" />
                  <span className="text-xs text-slate-400">{item.product.unit}</span>
                  <span className="text-xs text-slate-400">×</span>
                  <input type="number" value={item.rate} onChange={(e) => setRate(item.product.id, Number(e.target.value))} className="w-20 px-2 py-1 text-right text-sm border border-slate-300 rounded" />
                  <span className="text-sm font-medium w-24 text-right">{formatCurrency(item.quantity * item.rate)}</span>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500"><Minus className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Expenses */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Transport Cost" type="number" value={transportCost || ''} onChange={(e) => setTransportCost(Number(e.target.value))} />
            <Input label="Other Expenses" type="number" value={otherExpenses || ''} onChange={(e) => setOtherExpenses(Number(e.target.value))} />
          </div>

          {/* Totals */}
          <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">GST</span><span className="font-medium">{formatCurrency(gstAmount)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Transport + Other</span><span className="font-medium">{formatCurrency(transportCost + otherExpenses)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200"><span>Total</span><span className="text-amber-600">{formatCurrency(totalAmount)}</span></div>
            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Amount Paid</span>
              <input type="number" value={amountPaid || ''} onChange={(e) => setAmountPaid(Number(e.target.value))} className="w-28 px-2 py-1 text-right text-sm border border-slate-300 rounded" />
            </div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Due</span><span className={amountDue > 0 ? 'font-medium text-red-500' : 'font-medium text-green-600'}>{formatCurrency(Math.max(0, amountDue))}</span></div>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank Transfer</option><option value="credit">Credit</option>
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={savePurchase}><ShoppingCart className="w-4 h-4 inline mr-1" />Save Purchase</Button>
          </div>
        </div>
      </Modal>

      {/* View Purchase Modal */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Purchase Details" size="lg">
        {viewPurchase && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div><p className="text-xs text-slate-400">Invoice</p><p className="font-bold text-slate-900">{viewPurchase.invoice_number}</p></div>
              <div><p className="text-xs text-slate-400">Date</p><p className="font-bold text-slate-900">{formatDate(viewPurchase.purchase_date)}</p></div>
              <div><p className="text-xs text-slate-400">Subtotal</p><p className="font-medium">{formatCurrency(viewPurchase.subtotal)}</p></div>
              <div><p className="text-xs text-slate-400">GST</p><p className="font-medium">{formatCurrency(viewPurchase.gst_amount)}</p></div>
              <div><p className="text-xs text-slate-400">Transport</p><p className="font-medium">{formatCurrency(viewPurchase.transport_cost)}</p></div>
              <div><p className="text-xs text-slate-400">Other</p><p className="font-medium">{formatCurrency(viewPurchase.other_expenses)}</p></div>
              <div><p className="text-xs text-slate-400">Total</p><p className="font-bold text-amber-600">{formatCurrency(viewPurchase.total_amount)}</p></div>
              <div><p className="text-xs text-slate-400">Paid / Due</p><p className="font-medium">{formatCurrency(viewPurchase.amount_paid)} / {formatCurrency(viewPurchase.amount_due)}</p></div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr><th className="text-left px-3 py-2 font-medium">Product</th><th className="text-right px-3 py-2 font-medium">Qty</th><th className="text-right px-3 py-2 font-medium">Rate</th><th className="text-right px-3 py-2 font-medium">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(viewItems as unknown as Array<PurchaseItem & { products: { name: string; sku: string; unit: string } }>).map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2"><p className="font-medium text-slate-900">{item.products?.name}</p><p className="text-xs text-slate-400">{item.products?.sku}</p></td>
                    <td className="px-3 py-2 text-right">{item.quantity} {item.products?.unit}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
