import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, Users, Truck, FileText, IndianRupee } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Select, Input, Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';

type ReportType = 'sales' | 'purchases' | 'profit' | 'stock' | 'lowstock' | 'outofstock' | 'stock_movement' | 'stock_in' | 'stock_out' | 'stock_valuation' | 'stock_adjustment' | 'stock_ledger' | 'sales_return' | 'purchase_return' | 'customer_outstanding' | 'supplier_outstanding' | 'gst';

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
      case 'outofstock': {
        const { data: oosProducts } = await supabase.from('products').select('*, categories(name)').order('name');
        const oosRows = ((oosProducts || []) as any[]).filter((p) => Number(p.current_stock) <= 0);
        setData(oosRows);
        setSummary([
          { label: 'Out of Stock Items', value: String(oosRows.length) },
          { label: 'Total Products', value: String((oosProducts || []).length) },
        ]);
        break;
      }
      case 'stock_valuation': {
        const { data: valProducts } = await supabase.from('products').select('*, categories(name)').order('name');
        const valRows = (valProducts || []) as any[];
        setData(valRows);
        const totalVal = valRows.reduce((s, r) => s + Number(r.current_stock) * Number(r.purchase_price), 0);
        const totalSell = valRows.reduce((s, r) => s + Number(r.current_stock) * Number(r.selling_price), 0);
        setSummary([
          { label: 'Total Purchase Value', value: formatCurrency(totalVal) },
          { label: 'Total Selling Value', value: formatCurrency(totalSell) },
          { label: 'Total Products', value: String(valRows.length) },
          { label: 'Potential Profit', value: formatCurrency(totalSell - totalVal) },
        ]);
        break;
      }
      case 'stock_movement': {
        let mQuery = supabase.from('stock_movements').select('*, products(name, sku, unit), suppliers(name), customers(name)').order('created_at', { ascending: false });
        if (fromDate) mQuery = mQuery.gte('created_at', fromDate + 'T00:00:00');
        if (toDate) mQuery = mQuery.lte('created_at', toDate + 'T23:59:59');
        const { data: movements } = await mQuery;
        const mRows = (movements || []) as any[];
        setData(mRows);
        const inQty = mRows.filter((m) => m.movement_type === 'in' || m.movement_type === 'adjustment_in').reduce((s, m) => s + Number(m.quantity), 0);
        const outQty = mRows.filter((m) => m.movement_type === 'out' || m.movement_type === 'adjustment_out').reduce((s, m) => s + Number(m.quantity), 0);
        setSummary([
          { label: 'Total Movements', value: String(mRows.length) },
          { label: 'Stock In', value: String(inQty) },
          { label: 'Stock Out', value: String(outQty) },
        ]);
        break;
      }
      case 'stock_in': {
        let siQuery = supabase.from('stock_movements').select('*, products(name, sku, unit), suppliers(name)').in('movement_type', ['in', 'adjustment_in']).order('created_at', { ascending: false });
        if (fromDate) siQuery = siQuery.gte('created_at', fromDate + 'T00:00:00');
        if (toDate) siQuery = siQuery.lte('created_at', toDate + 'T23:59:59');
        const { data: inMovements } = await siQuery;
        const siRows = (inMovements || []) as any[];
        setData(siRows);
        const totalIn = siRows.reduce((s, m) => s + Number(m.quantity), 0);
        setSummary([
          { label: 'Total Stock In', value: String(totalIn) },
          { label: 'Entries', value: String(siRows.length) },
        ]);
        break;
      }
      case 'stock_out': {
        let soQuery = supabase.from('stock_movements').select('*, products(name, sku, unit), customers(name)').in('movement_type', ['out', 'adjustment_out']).order('created_at', { ascending: false });
        if (fromDate) soQuery = soQuery.gte('created_at', fromDate + 'T00:00:00');
        if (toDate) soQuery = soQuery.lte('created_at', toDate + 'T23:59:59');
        const { data: outMovements } = await soQuery;
        const soRows = (outMovements || []) as any[];
        setData(soRows);
        const totalOut = soRows.reduce((s, m) => s + Number(m.quantity), 0);
        setSummary([
          { label: 'Total Stock Out', value: String(totalOut) },
          { label: 'Entries', value: String(soRows.length) },
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
    { value: 'stock', label: 'Current Stock', icon: Package },
    { value: 'stock_valuation', label: 'Stock Valuation', icon: IndianRupee },
    { value: 'lowstock', label: 'Low Stock', icon: Package },
    { value: 'outofstock', label: 'Out of Stock', icon: Package },
    { value: 'stock_movement', label: 'Stock Movement', icon: TrendingUp },
    { value: 'stock_in', label: 'Stock In Report', icon: Package },
    { value: 'stock_out', label: 'Stock Out Report', icon: Package },
    { value: 'stock_adjustment', label: 'Stock Adjustment', icon: Package },
    { value: 'stock_ledger', label: 'Stock Ledger', icon: FileText },
    { value: 'sales_return', label: 'Sales Return', icon: Package },
    { value: 'purchase_return', label: 'Purchase Return', icon: Package },
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
      case 'stock_valuation': return ['Product', 'SKU', 'Category', 'Stock', 'Unit', 'Purchase Value', 'Sell Value'];
      case 'lowstock': return ['Product', 'SKU', 'Current', 'Minimum', 'Unit'];
      case 'outofstock': return ['Product', 'SKU', 'Category', 'Unit'];
      case 'stock_movement': return ['Date', 'Product', 'Type', 'Qty', 'Unit', 'Reason', 'User'];
      case 'stock_in': return ['Date', 'Product', 'Qty', 'Unit', 'Supplier', 'Reference'];
      case 'stock_out': return ['Date', 'Product', 'Qty', 'Unit', 'Customer', 'Reference'];
      case 'stock_adjustment': return ['Date', 'Product', 'Type', 'Qty', 'Unit', 'Reason', 'User'];
      case 'stock_ledger': return ['Date', 'Product', 'Type', 'Qty In', 'Qty Out', 'Balance', 'Rate', 'Value', 'Party'];
      case 'sales_return': return ['Return #', 'Date', 'Customer', 'Product', 'Qty', 'Rate', 'Total', 'Reason'];
      case 'purchase_return': return ['Return #', 'Date', 'Supplier', 'Product', 'Qty', 'Rate', 'Total', 'Reason'];
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
      case 'outofstock': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
          <td className="px-4 py-3 text-slate-600">{row.sku}</td>
          <td className="px-4 py-3 text-slate-600">{row.categories?.name || '-'}</td>
          <td className="px-4 py-3 text-slate-500">{row.unit}</td>
        </>
      );
      case 'stock_valuation': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
          <td className="px-4 py-3 text-slate-600">{row.sku}</td>
          <td className="px-4 py-3 text-slate-600">{row.categories?.name || '-'}</td>
          <td className="px-4 py-3 text-right">{row.current_stock}</td>
          <td className="px-4 py-3 text-slate-500">{row.unit}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.current_stock * row.purchase_price)}</td>
          <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(row.current_stock * row.selling_price)}</td>
        </>
      );
      case 'stock_movement': return (
        <>
          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{row.products?.name || '-'}</td>
          <td className="px-4 py-3"><Badge color={row.movement_type === 'in' ? 'green' : row.movement_type === 'out' ? 'red' : 'blue'}>{row.movement_type}</Badge></td>
          <td className="px-4 py-3 text-right font-medium">{row.quantity} {row.products?.unit || ''}</td>
          <td className="px-4 py-3 text-slate-500">{row.reason || row.notes || '-'}</td>
          <td className="px-4 py-3 text-slate-500">{row.user_name || 'admin'}</td>
        </>
      );
      case 'stock_in': return (
        <>
          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{row.products?.name || '-'}</td>
          <td className="px-4 py-3 text-right font-medium">{row.quantity} {row.products?.unit || ''}</td>
          <td className="px-4 py-3 text-slate-500">{row.suppliers?.name || '-'}</td>
          <td className="px-4 py-3 text-slate-500">{row.reference_number || row.reference_type || '-'}</td>
        </>
      );
      case 'stock_out': return (
        <>
          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{row.products?.name || '-'}</td>
          <td className="px-4 py-3 text-right font-medium">{row.quantity} {row.products?.unit || ''}</td>
          <td className="px-4 py-3 text-slate-500">{row.customers?.name || '-'}</td>
          <td className="px-4 py-3 text-slate-500">{row.reference_number || row.reference_type || '-'}</td>
        </>
      );
      case 'stock_adjustment': return (
        <>
          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{row.products?.name || '-'}</td>
          <td className="px-4 py-3"><Badge color={row.movement_type === 'adjustment_in' ? 'green' : 'red'}>{row.movement_type === 'adjustment_in' ? 'Add +' : 'Remove -'}</Badge></td>
          <td className="px-4 py-3 text-right font-medium">{row.quantity} {row.products?.unit || ''}</td>
          <td className="px-4 py-3 text-slate-500">{row.reason || row.notes || '-'}</td>
          <td className="px-4 py-3 text-slate-500">{row.user_name || 'admin'}</td>
        </>
      );
      case 'stock_ledger': return (
        <>
          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{row.products?.name || '-'}</td>
          <td className="px-4 py-3"><Badge color={row.movement_type === 'in' || row.movement_type === 'adjustment_in' || row.movement_type === 'sales_return' || row.movement_type === 'opening' ? 'green' : 'red'}>{row.movement_type}</Badge></td>
          <td className="px-4 py-3 text-right text-green-600 font-medium">{(row.movement_type === 'in' || row.movement_type === 'adjustment_in' || row.movement_type === 'sales_return' || row.movement_type === 'opening') ? `+${row.quantity}` : ''}</td>
          <td className="px-4 py-3 text-right text-red-500 font-medium">{(row.movement_type === 'out' || row.movement_type === 'adjustment_out' || row.movement_type === 'purchase_return') ? `-${row.quantity}` : ''}</td>
          <td className="px-4 py-3 text-right text-slate-600">{row.balance_after || '-'}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.unit_cost || 0)}</td>
          <td className="px-4 py-3 text-right">{formatCurrency((row.unit_cost || 0) * row.quantity)}</td>
          <td className="px-4 py-3 text-slate-500">{row.suppliers?.name || row.customers?.name || '-'}</td>
        </>
      );
      case 'sales_return': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.return_number}</td>
          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.return_date)}</td>
          <td className="px-4 py-3 text-slate-600">{row.customers?.name || '-'}</td>
          <td className="px-4 py-3 text-slate-900">{row.products?.name || row.product_name || '-'}</td>
          <td className="px-4 py-3 text-right">{row.quantity}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.rate)}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total)}</td>
          <td className="px-4 py-3 text-slate-500">{row.reason || '-'}</td>
        </>
      );
      case 'purchase_return': return (
        <>
          <td className="px-4 py-3 font-medium text-slate-900">{row.return_number}</td>
          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.return_date)}</td>
          <td className="px-4 py-3 text-slate-600">{row.suppliers?.name || '-'}</td>
          <td className="px-4 py-3 text-slate-900">{row.products?.name || row.product_name || '-'}</td>
          <td className="px-4 py-3 text-right">{row.quantity}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.rate)}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total)}</td>
          <td className="px-4 py-3 text-slate-500">{row.reason || '-'}</td>
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
