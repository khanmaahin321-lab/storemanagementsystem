import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Plus, Trash2, Minus, Receipt, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Customer, Sale, SaleItem, Settings as SettingsType } from '@/lib/supabase';
import { Card, Modal, Input, Select, Button, Badge } from '@/components/ui';
import { formatCurrency, generateSKU } from '@/lib/utils';

type CartItem = {
  product: Product;
  quantity: number;
  rate: number;
  gst_percent: number;
};

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [discount, setDiscount] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [customerModal, setCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', address: '' });
  const [successModal, setSuccessModal] = useState(false);
  const [lastInvoice, setLastInvoice] = useState('');

  useEffect(() => {
    supabase.from('products').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
    supabase.from('customers').select('*').order('name').then(({ data }) => {
      if (data) setCustomers(data as Customer[]);
    });
    supabase.from('settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SettingsType);
    });
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()),
    );
  }, [products, search]);

  const subtotal = cart.reduce((s, item) => s + item.quantity * item.rate, 0);
  const gstAmount = cart.reduce((s, item) => s + (item.quantity * item.rate * item.gst_percent) / 100, 0);
  const totalAmount = subtotal - discount + gstAmount + deliveryCharge;
  const amountDue = totalAmount - amountPaid;

  function addToCart(product: Product) {
    const existing = cart.find((c) => c.product.id === product.id);
    if (existing) {
      setCart(cart.map((c) => (c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { product, quantity: 1, rate: product.selling_price, gst_percent: product.gst_percent }]);
    }
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, quantity: Math.max(0, qty) } : c)));
  }

  function setRate(productId: string, rate: number) {
    setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, rate } : c)));
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((c) => c.product.id !== productId));
  }

  async function addCustomer() {
    if (!newCustomer.name) return;
    const { data } = await supabase.from('customers').insert(newCustomer).select('*').single();
    if (data) {
      const cust = data as Customer;
      setCustomers([...customers, cust]);
      setSelectedCustomer(cust.id);
    }
    setCustomerModal(false);
    setNewCustomer({ name: '', mobile: '', address: '' });
  }

  async function checkout() {
    if (cart.length === 0) return;

    const prefix = settings?.invoice_prefix || 'INV';
    const counter = settings?.invoice_counter || 1;
    const invoiceNumber = `${prefix}-${String(counter).padStart(5, '0')}`;

    const saleData: Omit<Sale, 'id' | 'created_at'> = {
      invoice_number: invoiceNumber,
      customer_id: selectedCustomer || null,
      sale_date: new Date().toISOString().split('T')[0],
      subtotal,
      discount_amount: discount,
      gst_amount: gstAmount,
      delivery_charge: deliveryCharge,
      total_amount: totalAmount,
      amount_paid: amountPaid || totalAmount,
      amount_due: amountDue,
      payment_method: paymentMethod,
      status: 'completed',
      payment_status: amountDue > 0 ? (amountPaid > 0 ? 'partial' : 'unpaid') : 'completed',
      notes,
    };

    const { data: sale } = await supabase.from('sales').insert(saleData).select('*').single();
    if (!sale) return;

    const saleId = (sale as Sale).id;

    // Insert sale items
    const items: Omit<SaleItem, 'id' | 'created_at'>[] = cart.map((item) => ({
      sale_id: saleId,
      product_id: item.product.id,
      quantity: item.quantity,
      rate: item.rate,
      gst_percent: item.gst_percent,
      gst_amount: (item.quantity * item.rate * item.gst_percent) / 100,
      total: item.quantity * item.rate + (item.quantity * item.rate * item.gst_percent) / 100,
    }));
    await supabase.from('sale_items').insert(items);

    // Update product stock
    for (const item of cart) {
      const newStock = item.product.current_stock - item.quantity;
      await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', item.product.id);
      await supabase.from('stock_movements').insert({
        product_id: item.product.id,
        movement_type: 'out',
        quantity: item.quantity,
        reference_type: 'sale',
        reference_id: saleId,
        notes: `Sale ${invoiceNumber}`,
      });
    }

    // Update customer outstanding
    if (selectedCustomer && amountDue > 0) {
      const customer = customers.find((c) => c.id === selectedCustomer);
      if (customer) {
        await supabase
          .from('customers')
          .update({
            outstanding_balance: customer.outstanding_balance + amountDue,
            total_purchases: customer.total_purchases + totalAmount,
          })
          .eq('id', selectedCustomer);
      }
    } else if (selectedCustomer) {
      const customer = customers.find((c) => c.id === selectedCustomer);
      if (customer) {
        await supabase
          .from('customers')
          .update({ total_purchases: customer.total_purchases + totalAmount })
          .eq('id', selectedCustomer);
      }
    }

    // Update invoice counter
    if (settings) {
      await supabase.from('settings').update({ invoice_counter: counter + 1 }).eq('id', settings.id);
    }

    setLastInvoice(invoiceNumber);
    setSuccessModal(true);
    setCart([]);
    setSelectedCustomer('');
    setDiscount(0);
    setDeliveryCharge(0);
    setAmountPaid(0);
    setNotes('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">POS / Billing</h1>
        <p className="text-sm text-slate-500 mt-1">Create a new sale invoice</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product selection */}
        <div className="lg:col-span-2 space-y-4">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="text-left p-3 bg-white rounded-lg border border-slate-200 hover:border-amber-500 hover:shadow-sm transition-all overflow-hidden"
              >
                {p.image_url ? (
                  <div className="w-full h-20 mb-2 rounded-md overflow-hidden bg-slate-100">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-20 mb-2 rounded-md bg-slate-100 flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-slate-300" />
                  </div>
                )}
                <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{p.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-amber-600">{formatCurrency(p.selling_price)}</span>
                  <Badge color={p.current_stock <= 0 ? 'red' : p.current_stock <= p.minimum_stock ? 'amber' : 'green'}>
                    {p.current_stock} {p.unit}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">Cart ({cart.length})</h3>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600">Clear</button>
              )}
            </div>

            {/* Customer */}
            <div className="flex gap-2 mb-3">
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={() => setCustomerModal(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Cart items */}
            {cart.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No items in cart</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex flex-col gap-1 p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900 truncate flex-1">{item.product.name}</span>
                      <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500 ml-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => setQty(item.product.id, Number(e.target.value))}
                        className="w-14 px-1 py-0.5 text-center text-sm border border-slate-300 rounded"
                      />
                      <span className="text-xs text-slate-400">{item.product.unit}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => setRate(item.product.id, Number(e.target.value))}
                        className="w-20 px-1 py-0.5 text-right text-sm border border-slate-300 rounded ml-auto"
                      />
                    </div>
                    <div className="text-right text-sm font-medium text-slate-700">
                      {formatCurrency(item.quantity * item.rate)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            {cart.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Discount</span>
                  <input
                    type="number"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-24 px-2 py-1 text-right text-sm border border-slate-300 rounded"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">GST</span>
                  <span className="font-medium">{formatCurrency(gstAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Delivery</span>
                  <input
                    type="number"
                    value={deliveryCharge || ''}
                    onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                    className="w-24 px-2 py-1 text-right text-sm border border-slate-300 rounded"
                  />
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span className="text-amber-600">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Amount Paid</span>
                  <input
                    type="number"
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-24 px-2 py-1 text-right text-sm border border-slate-300 rounded"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Due</span>
                  <span className={amountDue > 0 ? 'font-medium text-red-500' : 'font-medium text-green-600'}>
                    {formatCurrency(Math.max(0, amountDue))}
                  </span>
                </div>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="credit">Credit</option>
                </select>
                <Button onClick={checkout} className="w-full" size="lg">
                  <Receipt className="w-5 h-5 inline mr-2" />
                  Complete Sale
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal open={customerModal} onClose={() => setCustomerModal(false)} title="Quick Add Customer" size="sm">
        <div className="space-y-4">
          <Input label="Name *" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
          <Input label="Mobile" value={newCustomer.mobile} onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })} />
          <Input label="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCustomerModal(false)}>Cancel</Button>
            <Button onClick={addCustomer}>Add</Button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal open={successModal} onClose={() => setSuccessModal(false)} title="Sale Completed" size="sm">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-lg font-bold text-slate-900">Invoice {lastInvoice}</p>
          <p className="text-sm text-slate-500 mt-1">Sale completed successfully</p>
          <Button onClick={() => setSuccessModal(false)} className="mt-4">Done</Button>
        </div>
      </Modal>
    </div>
  );
}
