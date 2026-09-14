import { useState, useEffect, useCallback } from 'react';
import { Receipt, Search, Eye, Printer, Trash2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Sale, SaleItem, Customer, Settings as SettingsType } from '@/lib/supabase';
import { Card, Modal, Button, Badge, EmptyState, Input } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

type SaleWithCustomer = Sale & { customers: { name: string; mobile: string | null; address: string | null; gstin: string | null } | null };
type SaleItemWithProduct = SaleItem & { products: { name: string; sku: string; unit: string } | null };

export default function SalesHistory() {
  const [sales, setSales] = useState<SaleWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewModal, setViewModal] = useState(false);
  const [viewSale, setViewSale] = useState<SaleWithCustomer | null>(null);
  const [viewItems, setViewItems] = useState<SaleItemWithProduct[]>([]);
  const [settings, setSettings] = useState<SettingsType | null>(null);

  useEffect(() => {
    supabase.from('settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SettingsType);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('sales')
      .select('*, customers(name, mobile, address, gstin)')
      .order('created_at', { ascending: false });
    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%`);
    }
    if (filterStatus) {
      query = query.eq('payment_status', filterStatus);
    }
    const { data } = await query;
    setSales((data || []) as SaleWithCustomer[]);
    setLoading(false);
  }, [search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function viewSaleDetails(sale: SaleWithCustomer) {
    setViewSale(sale);
    const { data } = await supabase
      .from('sale_items')
      .select('*, products(name, sku, unit)')
      .eq('sale_id', sale.id);
    setViewItems((data || []) as SaleItemWithProduct[]);
    setViewModal(true);
  }

  async function deleteSale(id: string) {
    if (!confirm('Delete this sale? Stock will be automatically restored.')) return;
    const { data: items } = await supabase
      .from('sale_items')
      .select('product_id, quantity, products(name, unit)')
      .eq('sale_id', id);
    if (items) {
      for (const item of items as unknown as Array<{ product_id: string; quantity: number; products: { name: string; unit: string }[] | null }>) {
        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
        if (prod) {
          const newStock = (prod as { current_stock: number }).current_stock + item.quantity;
          await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', item.product_id);
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            movement_type: 'adjustment_in',
            quantity: item.quantity,
            reference_type: 'sale_delete',
            reference_id: id,
            reason: 'Sale deleted - stock restored',
            balance_after: newStock,
            notes: `Stock restored from deleted sale`,
            user_name: 'admin',
          });
        }
      }
    }
    await supabase.from('sales').delete().eq('id', id);
    load();
  }

  function printInvoice() {
    window.print();
  }

  const shopName = settings?.shop_name || 'Vaishnav Marble Shop';
  const shopAddress = settings?.address || '';
  const shopPhone = settings?.phone || '';
  const shopGstin = settings?.gstin || '';
  const logoSrc = settings?.logo_url || '/vaishnavi-marble-logo.svg';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales History</h1>
        <p className="text-sm text-slate-500 mt-1">View and print past invoices</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              placeholder="Search by invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : sales.length === 0 ? (
          <EmptyState icon={<Receipt className="w-8 h-8" />} title="No sales found" description="Sales will appear here after you create them in POS" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Paid</th>
                  <th className="text-right px-4 py-3 font-medium">Due</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(s.sale_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.customers?.name || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(s.amount_paid)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.amount_due > 0 ? <Badge color="red">{formatCurrency(s.amount_due)}</Badge> : <Badge color="green">Paid</Badge>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.payment_status === 'completed' ? <Badge color="green">Completed</Badge> : s.payment_status === 'partial' ? <Badge color="amber">Partial</Badge> : <Badge color="red">Unpaid</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => viewSaleDetails(s)} className="text-slate-400 hover:text-amber-600 p-1"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => deleteSale(s.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invoice View Modal */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Invoice Details" size="lg">
        {viewSale && (
          <div className="space-y-4">
            {/* Printable invoice */}
            <div id="invoice-print" className="border border-slate-200 rounded-lg p-6 bg-white">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                <div className="flex items-start gap-3">
                  <img src={logoSrc} alt="Vaishnavi Marble logo" className="w-12 h-12 rounded-lg object-cover" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{shopName}</h2>
                    {shopAddress && <p className="text-sm text-slate-500">{shopAddress}</p>}
                    {shopPhone && <p className="text-sm text-slate-500">Phone: {shopPhone}</p>}
                    {shopGstin && <p className="text-sm text-slate-500">GSTIN: {shopGstin}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-slate-900">INVOICE</h3>
                  <p className="text-sm font-medium text-slate-700">{viewSale.invoice_number}</p>
                  <p className="text-sm text-slate-500">{formatDate(viewSale.sale_date)}</p>
                </div>
              </div>

              {/* Customer */}
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-400 uppercase">Bill To</p>
                <p className="text-sm font-bold text-slate-900">{viewSale.customers?.name || 'Walk-in Customer'}</p>
                {viewSale.customers?.mobile && <p className="text-sm text-slate-500">{viewSale.customers.mobile}</p>}
                {viewSale.customers?.address && <p className="text-sm text-slate-500">{viewSale.customers.address}</p>}
                {viewSale.customers?.gstin && <p className="text-sm text-slate-500">GSTIN: {viewSale.customers.gstin}</p>}
              </div>

              {/* Items */}
              <table className="w-full text-sm mt-4">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Product</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 font-medium">Rate</th>
                    <th className="text-right px-3 py-2 font-medium">GST</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{item.products?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">{item.products?.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{item.quantity} {item.products?.unit}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.gst_amount)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mt-4">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatCurrency(viewSale.subtotal)}</span></div>
                  {viewSale.discount_amount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-medium text-green-600">-{formatCurrency(viewSale.discount_amount)}</span></div>}
                  <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="font-medium">{formatCurrency(viewSale.gst_amount)}</span></div>
                  {viewSale.delivery_charge > 0 && <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span className="font-medium">{formatCurrency(viewSale.delivery_charge)}</span></div>}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200"><span>Total</span><span className="text-amber-600">{formatCurrency(viewSale.total_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="font-medium text-green-600">{formatCurrency(viewSale.amount_paid)}</span></div>
                  {viewSale.amount_due > 0 && <div className="flex justify-between"><span className="text-slate-500">Due</span><span className="font-bold text-red-500">{formatCurrency(viewSale.amount_due)}</span></div>}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-400">Thank you for your business!</p>
                <p className="text-xs text-slate-400">Payment Method: {viewSale.payment_method}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setViewModal(false)}>Close</Button>
              <Button onClick={printInvoice}><Printer className="w-4 h-4 inline mr-1" />Print Invoice</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
