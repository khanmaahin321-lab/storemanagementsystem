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
  X,
  ClipboardCheck,
  Undo2,
  RotateCcw,
  Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, StockMovement, Supplier, Customer, Sale, Purchase, Settings as SettingsType } from '@/lib/supabase';
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

const RETURN_REASONS = [
  'Defective',
  'Wrong Item',
  'Damaged in Transit',
  'Customer Return',
  'Quality Issue',
  'Wrong Quantity',
  'Other',
];

type TabId = 'stock' | 'movements' | 'physical' | 'sales_return' | 'purchase_return';

export default function Inventory() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<(Sale & { customers: { name: string } | null })[]>([]);
  const [purchases, setPurchases] = useState<(Purchase & { suppliers: { name: string } | null })[]>([]);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [tab, setTab] = useState<TabId>('stock');

  // Adjust modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'adjustment_in', quantity: 0, reason: 'Physical Stock Correction', notes: '' });

  // Stock In modal
  const [stockInModal, setStockInModal] = useState(false);
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInForm, setStockInForm] = useState({ quantity: 0, purchasePrice: 0, supplierId: '', purchaseDate: new Date().toISOString().split('T')[0], referenceNumber: '', notes: '' });

  // Movement filters
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Physical stock check
  const [physicalItems, setPhysicalItems] = useState<Array<{ product_id: string; product: ProductWithCategory; system_stock: number; physical_stock: number; difference: number; reason: string }>>([]);
  const [physicalNotes, setPhysicalNotes] = useState('');

  // Sales return
  const [srSaleId, setSrSaleId] = useState('');
  const [srItems, setSrItems] = useState<Array<{ product_id: string; product_name: string; unit: string; max_qty: number; quantity: number; rate: number; reason: string }>>([]);
  const [srNotes, setSrNotes] = useState('');

  // Purchase return
  const [prPurchaseId, setPrPurchaseId] = useState('');
  const [prItems, setPrItems] = useState<Array<{ product_id: string; product_name: string; unit: string; max_qty: number; quantity: number; rate: number; reason: string }>>([]);
  const [prNotes, setPrNotes] = useState('');

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
    supabase.from('settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SettingsType);
    });
    supabase.from('sales').select('*, customers(name)').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      setSales((data || []) as (Sale & { customers: { name: string } | null })[]);
    });
    supabase.from('purchases').select('*, suppliers(name)').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      setPurchases((data || []) as (Purchase & { suppliers: { name: string } | null })[]);
    });
  }, []);

  useEffect(() => {
    if (tab === 'stock' || tab === 'physical' || tab === 'adjust' || tab === 'stockin') loadProducts();
    else if (tab === 'movements') loadMovements();
    else if (tab === 'sales_return' || tab === 'purchase_return') loadProducts();
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

  // Physical stock check: initialize with all products
  function initPhysicalCheck() {
    setPhysicalItems(products.map((p) => ({
      product_id: p.id,
      product: p,
      system_stock: p.current_stock,
      physical_stock: p.current_stock,
      difference: 0,
      reason: '',
    })));
  }

  function updatePhysicalQty(productId: string, qty: number) {
    setPhysicalItems(items => items.map(it => {
      if (it.product_id === productId) {
        const diff = qty - it.system_stock;
        return { ...it, physical_stock: qty, difference: diff };
      }
      return it;
    }));
  }

  async function applyPhysicalAdjustments() {
    const itemsToApply = physicalItems.filter(it => it.difference !== 0);
    if (itemsToApply.length === 0) {
      alert('No differences to apply.');
      return;
    }
    if (!confirm(`Apply ${itemsToApply.length} stock adjustment(s) from physical count?`)) return;

    const checkDate = new Date().toISOString().split('T')[0];
    const { data: check } = await supabase.from('physical_stock_checks').insert({
      check_date: checkDate,
      notes: physicalNotes,
      status: 'completed',
    }).select('*').single();

    const checkId = check?.id;
    const checkItems: Array<{ check_id: string; product_id: string; system_stock: number; physical_stock: number; difference: number; reason: string; applied: boolean }> = [];

    for (const it of itemsToApply) {
      const newStock = it.physical_stock;
      const isAdd = it.difference > 0;
      await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', it.product_id);
      await supabase.from('stock_movements').insert({
        product_id: it.product_id,
        movement_type: isAdd ? 'adjustment_in' : 'adjustment_out',
        quantity: Math.abs(it.difference),
        reference_type: 'physical_check',
        reference_id: checkId || null,
        reason: it.reason || 'Physical Stock Correction',
        notes: `Physical stock check: system=${it.system_stock}, actual=${it.physical_stock}`,
        balance_after: newStock,
        unit_cost: it.product.purchase_price,
        user_name: 'admin',
      });
      if (checkId) {
        checkItems.push({
          check_id: checkId,
          product_id: it.product_id,
          system_stock: it.system_stock,
          physical_stock: it.physical_stock,
          difference: it.difference,
          reason: it.reason || '',
          applied: true,
        });
      }
    }

    if (checkId && checkItems.length > 0) {
      await supabase.from('physical_stock_check_items').insert(checkItems);
    }

    alert(`${itemsToApply.length} adjustment(s) applied successfully.`);
    setPhysicalNotes('');
    setPhysicalItems([]);
    loadProducts();
  }

  // Sales return: load sale items when sale selected
  async function onSrSaleChange(saleId: string) {
    setSrSaleId(saleId);
    if (!saleId) {
      setSrItems([]);
      return;
    }
    const { data } = await supabase
      .from('sale_items')
      .select('*, products(name, unit)')
      .eq('sale_id', saleId);
    setSrItems((data || []).map((it: Record<string, unknown>) => ({
      product_id: it.product_id as string,
      product_name: (it.products as { name: string; unit: string })?.name || 'Unknown',
      unit: (it.products as { name: string; unit: string })?.unit || '',
      max_qty: it.quantity as number,
      quantity: 0,
      rate: it.rate as number,
      reason: 'Customer Return',
    })));
  }

  async function saveSalesReturn() {
    const itemsToReturn = srItems.filter(it => it.quantity > 0);
    if (itemsToReturn.length === 0) {
      alert('Enter at least one quantity to return.');
      return;
    }

    const sale = sales.find(s => s.id === srSaleId);
    const prefix = settings?.sales_return_prefix || 'SR';
    const counter = settings?.sales_return_counter || 1;
    const returnNumber = `${prefix}-${String(counter).padStart(5, '0')}`;

    const totalAmount = itemsToReturn.reduce((s, it) => s + it.quantity * it.rate, 0);

    const { data: returnRec } = await supabase.from('sales_returns').insert({
      return_number: returnNumber,
      sale_id: srSaleId || null,
      customer_id: sale?.customer_id || null,
      return_date: new Date().toISOString().split('T')[0],
      total_amount: totalAmount,
      notes: srNotes,
    }).select('*').single();

    if (!returnRec) return;
    const returnId = (returnRec as { id: string }).id;

    for (const it of itemsToReturn) {
      if (it.quantity > it.max_qty) {
        alert(`Cannot return more than sold quantity for ${it.product_name}. Max: ${it.max_qty}`);
        return;
      }
      const { data: prod } = await supabase.from('products').select('current_stock').eq('id', it.product_id).single();
      const currentStock = (prod as { current_stock: number })?.current_stock || 0;
      const newStock = currentStock + it.quantity;

      await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', it.product_id);
      await supabase.from('stock_movements').insert({
        product_id: it.product_id,
        movement_type: 'sales_return',
        quantity: it.quantity,
        reference_type: 'sales_return',
        reference_id: returnId,
        reference_number: returnNumber,
        customer_id: sale?.customer_id || null,
        reason: it.reason,
        balance_after: newStock,
        unit_cost: it.rate,
        notes: `Sales return ${returnNumber}`,
        user_name: 'admin',
      });
      await supabase.from('sales_return_items').insert({
        return_id: returnId,
        product_id: it.product_id,
        quantity: it.quantity,
        rate: it.rate,
        total: it.quantity * it.rate,
        reason: it.reason,
      });
    }

    if (settings) {
      await supabase.from('settings').update({ sales_return_counter: counter + 1 }).eq('id', settings.id);
    }

    alert(`Sales return ${returnNumber} saved. Stock restored.`);
    setSrSaleId('');
    setSrItems([]);
    setSrNotes('');
    loadProducts();
  }

  // Purchase return
  async function onPrPurchaseChange(purchaseId: string) {
    setPrPurchaseId(purchaseId);
    if (!purchaseId) {
      setPrItems([]);
      return;
    }
    const { data } = await supabase
      .from('purchase_items')
      .select('*, products(name, unit)')
      .eq('purchase_id', purchaseId);
    setPrItems((data || []).map((it: Record<string, unknown>) => ({
      product_id: it.product_id as string,
      product_name: (it.products as { name: string; unit: string })?.name || 'Unknown',
      unit: (it.products as { name: string; unit: string })?.unit || '',
      max_qty: it.quantity as number,
      quantity: 0,
      rate: it.rate as number,
      reason: 'Quality Issue',
    })));
  }

  async function savePurchaseReturn() {
    const itemsToReturn = prItems.filter(it => it.quantity > 0);
    if (itemsToReturn.length === 0) {
      alert('Enter at least one quantity to return.');
      return;
    }

    const purchase = purchases.find(p => p.id === prPurchaseId);
    const prefix = settings?.purchase_return_prefix || 'PR';
    const counter = settings?.purchase_return_counter || 1;
    const returnNumber = `${prefix}-${String(counter).padStart(5, '0')}`;

    const totalAmount = itemsToReturn.reduce((s, it) => s + it.quantity * it.rate, 0);

    const { data: returnRec } = await supabase.from('purchase_returns').insert({
      return_number: returnNumber,
      purchase_id: prPurchaseId || null,
      supplier_id: purchase?.supplier_id || null,
      return_date: new Date().toISOString().split('T')[0],
      total_amount: totalAmount,
      notes: prNotes,
    }).select('*').single();

    if (!returnRec) return;
    const returnId = (returnRec as { id: string }).id;

    for (const it of itemsToReturn) {
      if (it.quantity > it.max_qty) {
        alert(`Cannot return more than purchased quantity for ${it.product_name}. Max: ${it.max_qty}`);
        return;
      }
      const { data: prod } = await supabase.from('products').select('current_stock').eq('id', it.product_id).single();
      const currentStock = (prod as { current_stock: number })?.current_stock || 0;
      const newStock = Math.max(0, currentStock - it.quantity);

      await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', it.product_id);
      await supabase.from('stock_movements').insert({
        product_id: it.product_id,
        movement_type: 'purchase_return',
        quantity: it.quantity,
        reference_type: 'purchase_return',
        reference_id: returnId,
        reference_number: returnNumber,
        supplier_id: purchase?.supplier_id || null,
        reason: it.reason,
        balance_after: newStock,
        unit_cost: it.rate,
        notes: `Purchase return ${returnNumber}`,
        user_name: 'admin',
      });
      await supabase.from('purchase_return_items').insert({
        return_id: returnId,
        product_id: it.product_id,
        quantity: it.quantity,
        rate: it.rate,
        total: it.quantity * it.rate,
        reason: it.reason,
      });
    }

    if (settings) {
      await supabase.from('settings').update({ purchase_return_counter: counter + 1 }).eq('id', settings.id);
    }

    alert(`Purchase return ${returnNumber} saved. Stock deducted.`);
    setPrPurchaseId('');
    setPrItems([]);
    setPrNotes('');
    loadProducts();
  }

  function printTable() {
    window.print();
  }

  const filteredProducts = products.filter(p => {
    if (filterCategory && p.categories?.name !== filterCategory) return false;
    if (filterStatus === 'low' && !(p.current_stock <= p.minimum_stock && p.minimum_stock > 0 && p.current_stock > 0)) return false;
    if (filterStatus === 'out' && p.current_stock > 0) return false;
    if (filterStatus === 'in' && (p.current_stock <= 0 || (p.current_stock <= p.minimum_stock && p.minimum_stock > 0))) return false;
    return true;
  });

  const totalStockValue = products.reduce((s, p) => s + p.current_stock * p.purchase_price, 0);
  const lowStockCount = products.filter((p) => p.current_stock <= p.minimum_stock && p.minimum_stock > 0 && p.current_stock > 0).length;
  const outOfStockCount = products.filter((p) => p.current_stock <= 0).length;
  const totalProducts = products.length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayMovements = movements.filter((m) => m.created_at.startsWith(todayStr));
  const stockInToday = todayMovements.filter((m) => m.movement_type === 'in' || m.movement_type === 'adjustment_in' || m.movement_type === 'sales_return').reduce((s, m) => s + m.quantity, 0);
  const stockOutToday = todayMovements.filter((m) => m.movement_type === 'out' || m.movement_type === 'adjustment_out' || m.movement_type === 'purchase_return').reduce((s, m) => s + m.quantity, 0);
  const adjustmentsToday = todayMovements.filter((m) => m.movement_type === 'adjustment_in' || m.movement_type === 'adjustment_out').length;

  const tabs: { id: TabId; label: string; icon: typeof Package }[] = [
    { id: 'stock', label: 'Current Stock', icon: Package },
    { id: 'movements', label: 'Stock Movement History', icon: History },
    { id: 'physical', label: 'Physical Stock Check', icon: ClipboardCheck },
    { id: 'sales_return', label: 'Sales Return', icon: Undo2 },
    { id: 'purchase_return', label: 'Purchase Return', icon: RotateCcw },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory & Stock Management</h1>
        <p className="text-sm text-slate-500 mt-1">Track stock levels, adjustments, returns, and movement history</p>
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
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <Icon className="w-4 h-4 inline mr-1" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Current Stock Tab */}
      {tab === 'stock' && (
        <>
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  placeholder="Search products by name or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">All Status</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
              <Button variant="secondary" onClick={printTable}><Printer className="w-4 h-4 inline mr-1" />Print</Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
            ) : filteredProducts.length === 0 ? (
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
                      <th className="text-right px-4 py-3 font-medium">Purchase Price</th>
                      <th className="text-right px-4 py-3 font-medium">Sell Price</th>
                      <th className="text-right px-4 py-3 font-medium">Stock Value</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => {
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
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(p.purchase_price)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(p.selling_price)}</td>
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

      {/* Movement History Tab */}
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
                  <option value="sales_return">Sales Return</option>
                  <option value="purchase_return">Purchase Return</option>
                  <option value="adjustment_in">Adjustment (+)</option>
                  <option value="adjustment_out">Adjustment (-)</option>
                  <option value="opening">Opening Stock</option>
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
              <div className="flex items-end gap-2">
                <Button variant="secondary" onClick={() => { setFilterProduct(''); setFilterType(''); setFilterDate(''); }}>
                  <X className="w-4 h-4 inline mr-1" />Clear
                </Button>
                <Button variant="secondary" onClick={printTable}><Printer className="w-4 h-4 inline" /></Button>
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
                      <th className="text-right px-4 py-3 font-medium">Qty In</th>
                      <th className="text-right px-4 py-3 font-medium">Qty Out</th>
                      <th className="text-right px-4 py-3 font-medium">Balance</th>
                      <th className="text-left px-4 py-3 font-medium">Reference</th>
                      <th className="text-left px-4 py-3 font-medium">Supplier/Customer</th>
                      <th className="text-left px-4 py-3 font-medium">Reason</th>
                      <th className="text-left px-4 py-3 font-medium">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => {
                      const isIn = m.movement_type === 'in' || m.movement_type === 'adjustment_in' || m.movement_type === 'sales_return' || m.movement_type === 'opening';
                      return (
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
                            {m.movement_type === 'sales_return' && <Badge color="green"><Undo2 className="w-3 h-3 inline mr-1" />Sales Return</Badge>}
                            {m.movement_type === 'purchase_return' && <Badge color="red"><RotateCcw className="w-3 h-3 inline mr-1" />Purchase Return</Badge>}
                            {m.movement_type === 'opening' && <Badge color="slate">Opening</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">{isIn ? `+${m.quantity}` : ''}</td>
                          <td className="px-4 py-3 text-right font-medium text-red-500">{!isIn ? `-${m.quantity}` : ''}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{m.balance_after || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{m.reference_number || m.reference_type || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{m.suppliers?.name || m.customers?.name || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{m.reason || m.notes || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{m.user_name || 'admin'}</td>
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

      {/* Physical Stock Check Tab */}
      {tab === 'physical' && (
        <>
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Physical Stock Count</h3>
                <p className="text-xs text-slate-500">Compare system stock with actual counted stock and apply adjustments</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={initPhysicalCheck}>Load All Products</Button>
                {physicalItems.length > 0 && (
                  <Button onClick={applyPhysicalAdjustments}>
                    <ClipboardCheck className="w-4 h-4 inline mr-1" />Apply Adjustments
                  </Button>
                )}
              </div>
            </div>
            {physicalItems.length > 0 && (
              <div className="mt-3">
                <Textarea label="Notes" rows={1} value={physicalNotes} onChange={(e) => setPhysicalNotes(e.target.value)} placeholder="Stock take notes..." />
              </div>
            )}
          </Card>

          {physicalItems.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Product</th>
                      <th className="text-right px-4 py-3 font-medium">System Stock</th>
                      <th className="text-right px-4 py-3 font-medium">Physical Stock</th>
                      <th className="text-right px-4 py-3 font-medium">Difference</th>
                      <th className="text-left px-4 py-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {physicalItems.map((it) => (
                      <tr key={it.product_id} className={it.difference !== 0 ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{it.product.name}</div>
                          <div className="text-xs text-slate-400">{it.product.sku} - {it.product.unit}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{it.system_stock}</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            value={it.physical_stock}
                            onChange={(e) => updatePhysicalQty(it.product_id, Number(e.target.value))}
                            className="w-20 px-2 py-1 text-right border border-slate-300 rounded text-sm"
                          />
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${it.difference > 0 ? 'text-green-600' : it.difference < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                          {it.difference > 0 ? `+${it.difference}` : it.difference || ''}
                        </td>
                        <td className="px-4 py-3">
                          {it.difference !== 0 ? (
                            <select
                              value={it.reason}
                              onChange={(e) => setPhysicalItems(items => items.map(i => i.product_id === it.product_id ? { ...i, reason: e.target.value } : i))}
                              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                            >
                              <option value="">Select reason</option>
                              {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-8">
              <EmptyState icon={<ClipboardCheck className="w-8 h-8" />} title="No stock check started" description="Click 'Load All Products' to begin a physical stock count" />
            </Card>
          )}
        </>
      )}

      {/* Sales Return Tab */}
      {tab === 'sales_return' && (
        <>
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3">Sales Return - Restore Stock from Customer Return</h3>
              <Select label="Select Original Sale" value={srSaleId} onChange={(e) => onSrSaleChange(e.target.value)}>
                <option value="">Select an invoice</option>
                {sales.map(s => (
                  <option key={s.id} value={s.id}>{s.invoice_number} - {s.customers?.name || 'Walk-in'} - {formatDate(s.sale_date)}</option>
                ))}
              </Select>
            </div>

            {srItems.length > 0 && (
              <>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Product</th>
                        <th className="text-right px-3 py-2 font-medium">Sold Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Return Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Rate</th>
                        <th className="text-left px-3 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {srItems.map((it, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-slate-900">{it.product_name} <span className="text-xs text-slate-400">({it.unit})</span></td>
                          <td className="px-3 py-2 text-right text-slate-500">{it.max_qty}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              max={it.max_qty}
                              min={0}
                              value={it.quantity || ''}
                              onChange={(e) => setSrItems(items => items.map((i, j) => j === idx ? { ...i, quantity: Math.min(Number(e.target.value), i.max_qty) } : i))}
                              className="w-20 px-2 py-1 text-right border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(it.rate)}</td>
                          <td className="px-3 py-2">
                            <select
                              value={it.reason}
                              onChange={(e) => setSrItems(items => items.map((i, j) => j === idx ? { ...i, reason: e.target.value } : i))}
                              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                            >
                              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Textarea label="Notes" rows={2} value={srNotes} onChange={(e) => setSrNotes(e.target.value)} />
                <Button onClick={saveSalesReturn}><Undo2 className="w-4 h-4 inline mr-1" />Save Sales Return</Button>
              </>
            )}
            {srItems.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Select an invoice to load line items for return</p>
            )}
          </Card>
        </>
      )}

      {/* Purchase Return Tab */}
      {tab === 'purchase_return' && (
        <>
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3">Purchase Return - Return Stock to Supplier</h3>
              <Select label="Select Original Purchase" value={prPurchaseId} onChange={(e) => onPrPurchaseChange(e.target.value)}>
                <option value="">Select a purchase invoice</option>
                {purchases.map(p => (
                  <option key={p.id} value={p.id}>{p.invoice_number} - {p.suppliers?.name || '-'} - {formatDate(p.purchase_date)}</option>
                ))}
              </Select>
            </div>

            {prItems.length > 0 && (
              <>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Product</th>
                        <th className="text-right px-3 py-2 font-medium">Purchased Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Return Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Rate</th>
                        <th className="text-left px-3 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prItems.map((it, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-slate-900">{it.product_name} <span className="text-xs text-slate-400">({it.unit})</span></td>
                          <td className="px-3 py-2 text-right text-slate-500">{it.max_qty}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              max={it.max_qty}
                              min={0}
                              value={it.quantity || ''}
                              onChange={(e) => setPrItems(items => items.map((i, j) => j === idx ? { ...i, quantity: Math.min(Number(e.target.value), i.max_qty) } : i))}
                              className="w-20 px-2 py-1 text-right border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(it.rate)}</td>
                          <td className="px-3 py-2">
                            <select
                              value={it.reason}
                              onChange={(e) => setPrItems(items => items.map((i, j) => j === idx ? { ...i, reason: e.target.value } : i))}
                              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                            >
                              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Textarea label="Notes" rows={2} value={prNotes} onChange={(e) => setPrNotes(e.target.value)} />
                <Button onClick={savePurchaseReturn}><RotateCcw className="w-4 h-4 inline mr-1" />Save Purchase Return</Button>
              </>
            )}
            {prItems.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Select a purchase invoice to load line items for return</p>
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
