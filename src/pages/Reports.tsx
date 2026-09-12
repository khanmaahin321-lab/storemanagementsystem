import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, Users, Truck, FileText, IndianRupee } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Select, Input, Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';

type ReportType = 'sales' | 'purchases' | 'profit' | 'stock' | 'lowstock' | 'customer_outstanding' | 'supplier_outstanding' | 'gst';

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    loadReport();
  }, [reportType]);

  async function loadReport() {
    setLoading(true);
    setData([]);
    setSummary([]);

    let dateFilter = '';
    if (fromDate) dateFilter = `&from=${fromDate}`;
    if (toDate) dateFilter += `&to=${toDate}`;

    switch (reportType) {
      case 'sales': {
        let query = supabase
          .from('sales')
          .select('*, customers(name)')
          .order('sale_date', { ascending: false });
        if (fromDate) query = query.gte('sale_date', fromDate);
        if (toDate) query = query.lte('sale_date', toDate);
        const { data: sales } = await query;
        const rows = (sales || []) as any[];
        setData(rows);
        const totalSales = rows.reduce((s, r) => s + Number(r.total_amount), 0);
        const totalDue = rows.reduce((s, r) => s + Number(r.amount_due), 0);
        setSummary([
          { label: 'Total Sales', value: formatCurrency(totalSales) },
          { label: 'Total Collected', value: formatCurrency(totalSales - totalDue) },
          { label: 'Outstanding', value: formatCurrency(totalDue) },
          { label: 'Total Invoices', value: String(rows.length) },
        ]);
        break;
      }
      case 'purchases': {
        let query = supabase
          .from('purchases')
          .select('*, suppliers(name)')
          .order('purchase_date', { ascending: false });
        if (fromDate) query = query.gte('purchase_date', fromDate);
        if (toDate) query = query.lte('purchase_date', toDate);
        const { data: purchases } = await query;
        const rows = (purchases || []) as any[];
        setData(rows);
        const totalPurchases = rows.reduce((s, r) => s + Number(r.total_amount), 0);
        const totalDue = rows.reduce((s, r) => s + Number(r.amount_due), 0);
        setSummary([
          { label: 'Total Purchases', value: formatCurrency(totalPurchases) },
          { label: 'Total Paid', value: formatCurrency(totalPurchases - totalDue) },
          { label: 'Outstanding', value: formatCurrency(totalDue) },
          { label: 'Total Invoices', value: String(rows.length) },
        ]);
        break;
      }
      case 'profit': {
        let query = supabase.from('sale_items').select('quantity, rate, total, products(purchase_price, name, sku)');
        const { data: items } = await query;
        const items2 = (items || []) as any[];
        let totalRevenue = 0;
        let totalCost = 0;
        const productProfit = new Map<string, { name: string; revenue: number; cost: number; qty: number }>();
        items2.forEach((item) => {
          const revenue = Number(item.total);
          const cost = Number(item.products?.purchase_price || 0) * Number(item.quantity);
          totalRevenue += revenue;
          totalCost += cost;
          const key = item.products?.name || 'Unknown';
          const existing = productProfit.get(key) || { name: key, revenue: 0, cost: 0, qty: 0 };
          existing.revenue += revenue;
          existing.cost += cost;
          existing.qty += Number(item.quantity);
          productProfit.set(key, existing);
        });
        const profitRows = Array.from(productProfit.values()).map((p) => ({
          ...p,
          profit: p.revenue - p.cost,
        }));
        setData(profitRows);
        setSummary([
          { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
          { label: 'Total Cost', value: formatCurrency(totalCost) },
          { label: 'Total Profit', value: formatCurrency(totalRevenue - totalCost) },
          { label: 'Margin', value: totalRevenue > 0 ? `${(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%` : '0%' },
        ]);
        break;
      }
      case 'stock': {
        const { data: products } = await supabase.from('products').select('*, categories(name)').order('name');
        const rows = (products || []) as any[];
        setData(rows);
        const totalValue = rows.reduce((s, r) => s + Number(r.current_stock) * Number(r.purchase_price), 0);
        setSummary([
          { label: 'Total Products', value: String(rows.length) },
          { label: 'Total Stock Value', value: formatCurrency(totalValue) },
          { label: 'Out of Stock', value: String(rows.filter((r) => Number(r.current_stock) <= 0).length) },
          { label: 'Low Stock', value: String(rows.filter((r) => Number(r.current_stock) <= Number(r.minimum_stock) && Number(r.minimum_stock) > 0).length) },
        ]);
        break;
      }
      case 'lowstock': {
        const { data: products } = await supabase.from('products').select('*, categories(name)').order('current_stock', { ascending: true });
        const rows = ((products || []) as any[]).filter((p) => Number(p.current_stock) <= Number(p.minimum_stock) && Number(p.minimum_stock) > 0);
        setData(rows);
        setSummary([
          { label: 'Low Stock Items', value: String(rows.length) },
          { label: 'Out of Stock', value: String(rows.filter((r) => Number(r.current_stock) <= 0).length) },
        ]);
        break;
      }
      case 'customer_outstanding': {
        const { data: customers } = await supabase.from('customers').select('*').order('outstanding_balance', { ascending: false });
        const rows = ((customers || []) as any[]).filter((c) => Number(c.outstanding_balance) > 0);
        setData(rows);
        const totalDue = rows.reduce((s, r) => s + Number(r.outstanding_balance), 0);
        setSummary([
          { label: 'Customers with Dues', value: String(rows.length) },
          { label: 'Total Outstanding', value: formatCurrency(totalDue) },
        ]);
        break;
      }
      case 'supplier_outstanding': {
        const { data: suppliers } = await supabase.from('suppliers').select('*').order('outstanding_balance', { ascending: false });
        const rows = ((suppliers || []) as any[]).filter((s) => Number(s.outstanding_balance) > 0);
        setData(rows);
        const totalDue = rows.reduce((s, r) => s + Number(r.outstanding_balance), 0);
        setSummary([
          { label: 'Suppliers with Dues', value: String(rows.length) },
          { label: 'Total Payable', value: formatCurrency(totalDue) },
        ]);
        break;
      }
      case 'gst': {
        let query = supabase.from('sales').select('invoice_number, sale_date, subtotal, gst_amount, total_amount').order('sale_date', { ascending: false });
        if (fromDate) query = query.gte('sale_date', fromDate);
        if (toDate) query = query.lte('sale_date', toDate);
        const { data: sales } = await query;
        const rows = (sales || []) as any[];
        setData(rows);
        const totalGST = rows.reduce((s, r) => s + Number(r.gst_amount), 0);
        const totalSales = rows.reduce((s, r) => s + Number(r.total_amount), 0);
        setSummary([
          { label: 'Total Sales', value: formatCurrency(totalSales) },
          { label: 'Total GST Collected', value: formatCurrency(totalGST) },
          { label: 'Invoices', value: String(rows.length) },
        ]);
        break;
      }
    }
    setLoading(false);
  }

  const reportOptions: { value: ReportType; label: string; icon: typeof BarChart3 }[] = [
    { value: 'sales', label: 'Sales Report', icon: IndianRupee },
    { value: 'purchases', label: 'Purchase Report', icon: FileText },
    { value: 'profit', label: 'Profit & Loss', icon: TrendingUp },
    { value: 'stock', label: 'Stock Report', icon: Package },
    { value: 'lowstock', label: 'Low Stock Report', icon: Package },
    { value: 'customer_outstanding', label: 'Customer Outstanding', icon: Users },
    { value: 'supplier_outstanding', label: 'Supplier Outstanding', icon: Truck },
    { value: 'gst', label: 'GST Report', icon: FileText },
  ];

  function renderTable() {
    if (loading) return <div className="p-8 text-center text-sm text-slate-400">Loading report...</div>;
    if (data.length === 0) return <div className="p-8 text-center text-sm text-slate-400">No data found</div>;

    const headers = getHeaders();
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {renderRow(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function getHeaders(): string[] {
    switch (reportType) {
      case 'sales': return ['Invoice', 'Date', 'Customer', 'Total', 'Paid', 'Due'];
      case 'purchases': return ['Invoice', 'Date', 'Supplier', 'Total', 'Paid', 'Due'];
      case 'profit': return ['Product', 'Qty Sold', 'Revenue', 'Cost', 'Profit'];
      case 'stock': return ['Product', 'SKU', 'Category', 'Stock', 'Unit', 'Value'];
      case 'lowstock': return ['Product', 'SKU', 'Current', 'Minimum', 'Unit'];
      case 'customer_outstanding': return ['Name', 'Mobile', 'Outstanding', 'Total Purchases'];
      case 'supplier_outstanding': return ['Name', 'Mobile', 'Outstanding'];
      case 'gst': return ['Invoice', 'Date', 'Subtotal', 'GST', 'Total'];
      default: return [];
    }
  }

  function renderRow(row: any) {
    switch (reportType) {
      case 'sales': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.invoice_number}</td>
          <td className="px-4 py-3 text-slate-600">{formatDate(row.sale_date)}</td>
          <td className="px-4 py-3 text-slate-600">{row.customers?.name || 'Walk-in'}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total_amount)}</td>
          <td className="px-4 py-3 text-right text-green-600">{formatCurrency(row.amount_paid)}</td>
          <td className="px-4 py-3 text-right">{row.amount_due > 0 ? <Badge color="red">{formatCurrency(row.amount_due)}</Badge> : <Badge color="green">Paid</Badge>}</td>
        </>
      );
      case 'purchases': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.invoice_number}</td>
          <td className="px-4 py-3 text-slate-600">{formatDate(row.purchase_date)}</td>
          <td className="px-4 py-3 text-slate-600">{row.suppliers?.name || '-'}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total_amount)}</td>
          <td className="px-4 py-3 text-right text-green-600">{formatCurrency(row.amount_paid)}</td>
          <td className="px-4 py-3 text-right">{row.amount_due > 0 ? <Badge color="red">{formatCurrency(row.amount_due)}</Badge> : <Badge color="green">Paid</Badge>}</td>
        </>
      );
      case 'profit': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
          <td className="px-4 py-3 text-right">{row.qty}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.revenue)}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.cost)}</td>
          <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(row.profit)}</td>
        </>
      );
      case 'stock': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
          <td className="px-4 py-3 text-slate-600">{row.sku}</td>
          <td className="px-4 py-3 text-slate-600">{row.categories?.name || '-'}</td>
          <td className="px-4 py-3 text-right">{row.current_stock}</td>
          <td className="px-4 py-3 text-slate-500">{row.unit}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.current_stock * row.purchase_price)}</td>
        </>
      );
      case 'lowstock': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
          <td className="px-4 py-3 text-slate-600">{row.sku}</td>
          <td className="px-4 py-3 text-right text-red-600">{row.current_stock}</td>
          <td className="px-4 py-3 text-right">{row.minimum_stock}</td>
          <td className="px-4 py-3 text-slate-500">{row.unit}</td>
        </>
      );
      case 'customer_outstanding': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
          <td className="px-4 py-3 text-slate-600">{row.mobile || '-'}</td>
          <td className="px-4 py-3 text-right font-bold text-red-500">{formatCurrency(row.outstanding_balance)}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.total_purchases)}</td>
        </>
      );
      case 'supplier_outstanding': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
          <td className="px-4 py-3 text-slate-600">{row.mobile || '-'}</td>
          <td className="px-4 py-3 text-right font-bold text-red-500">{formatCurrency(row.outstanding_balance)}</td>
        </>
      );
      case 'gst': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.invoice_number}</td>
          <td className="px-4 py-3 text-slate-600">{formatDate(row.sale_date)}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.subtotal)}</td>
          <td className="px-4 py-3 text-right font-bold text-amber-600">{formatCurrency(row.gst_amount)}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total_amount)}</td>
        </>
      );
      default: return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Analyze your business performance</p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {reportOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = reportType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setReportType(opt.value)}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                isActive ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Date filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button onClick={loadReport}><BarChart3 className="w-4 h-4 inline mr-1" />Generate</Button>
        </div>
      </Card>

      {/* Summary */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summary.map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Report table */}
      <Card className="overflow-hidden">
        {renderTable()}
      </Card>
    </div>
  );
}
