import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  Users,
  Truck,
  IndianRupee,
  Receipt,
  Wallet,
  TrendingDown,
  Eye,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  CalendarDays,
  CreditCard,
  Banknote,
  Clock3,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { Card, StatCard } from '@/components/ui';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';

interface DashboardData {
  todaySales: number;
  todayPurchases: number;
  todayProfit: number;
  todayExpenses: number;
  cashBalance: number;
  totalProducts: number;
  categoryCount: number;
  lowStockCount: number;
  customerDues: number;
  supplierDues: number;
  todayOrders: number;
  monthlySales: { month: string; amount: number }[];
  recentSales: any[];
  lowStockProducts: any[];
  outOfStockProducts: any[];
  recentMovements: any[];
  stockInToday: number;
  stockOutToday: number;
  adjustmentsToday: number;
  totalStockValue: number;
  outOfStockCount: number;
}

const EMPTY_DASHBOARD_DATA: DashboardData = {
  todaySales: 0,
  todayPurchases: 0,
  todayProfit: 0,
  todayExpenses: 0,
  cashBalance: 0,
  totalProducts: 0,
  categoryCount: 0,
  lowStockCount: 0,
  customerDues: 0,
  supplierDues: 0,
  todayOrders: 0,
  monthlySales: [],
  recentSales: [],
  lowStockProducts: [],
  outOfStockProducts: [],
  recentMovements: [],
  stockInToday: 0,
  stockOutToday: 0,
  adjustmentsToday: 0,
  totalStockValue: 0,
  outOfStockCount: 0,
};

function AnimatedNumber({
  value,
  duration = 700,
  prefix = '',
  suffix = '',
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const from = previousValue.current;
    const to = Number(value) || 0;
    const start = performance.now();

    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        previousValue.current = to;
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <>
      {prefix}
      {displayValue.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
      {suffix}
    </>
  );
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div>
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
        {typeof count === 'number' && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
      <span className="text-xs font-medium text-slate-500">
        Page {page} of {totalPages}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page === 1}
          aria-label="Previous page"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page === totalPages}
          aria-label="Next page"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-32 rounded-2xl bg-slate-200" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-24 rounded-2xl bg-slate-200" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="h-80 rounded-2xl bg-slate-200" />
        <div className="h-80 rounded-2xl bg-slate-200" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-200" />
        <div className="h-72 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-200`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [salesPage, setSalesPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);

  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [selectedSaleItems, setSelectedSaleItems] = useState<any[]>([]);
  const [saleDetailsLoading, setSaleDetailsLoading] = useState(false);

  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
  const [selectedOutOfStock, setSelectedOutOfStock] = useState<any | null>(null);

  const requestInFlight = useRef(false);

  const PAGE_SIZE = 5;

  const loadDashboard = async (silent = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const startOfYearISO = startOfYear.toISOString();

      const [
        salesToday,
        purchasesToday,
        products,
        customers,
        suppliers,
        recentSales,
        monthlySalesRaw,
        outOfStockProducts,
        expensesToday,
        categories,
        allSales,
        allPurchases,
        allExpenses,
        stockMovementsToday,
        recentMovements,
      ] = await Promise.all([
        supabase
          .from('sales')
          .select('id,total_amount,amount_paid,payment_method')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString()),

        supabase
          .from('purchases')
          .select('total_amount,amount_paid')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString()),

        supabase
          .from('products')
          .select('id,name,unit,stock_quantity,min_stock,purchase_price,selling_price')
          .order('name')
          .limit(1000),

        supabase.from('customers').select('id,current_balance').limit(1000),

        supabase.from('suppliers').select('id,current_balance').limit(1000),

        supabase
          .from('sales')
          .select('id,invoice_number,customer_name,total_amount,amount_paid,payment_method,created_at')
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('sales')
          .select('total_amount,created_at')
          .gte('created_at', startOfYearISO)
          .order('created_at', { ascending: true })
          .limit(5000),

        supabase
          .from('products')
          .select('id,name,unit,stock_quantity,min_stock,selling_price,purchase_price')
          .lte('stock_quantity', 0)
          .order('name')
          .limit(100),

        supabase
          .from('expenses')
          .select('amount')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString()),

        supabase.from('categories').select('id').limit(1000),

        supabase
          .from('sales')
          .select('id,total_amount,amount_paid')
          .limit(5000),

        supabase
          .from('purchases')
          .select('total_amount,amount_paid')
          .limit(5000),

        supabase.from('expenses').select('amount').limit(5000),

        supabase
          .from('stock_movements')
          .select('id,movement_type,quantity,created_at,product_id,products(name,unit)')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString())
          .order('created_at', { ascending: false })
          .limit(1000),

        supabase
          .from('stock_movements')
          .select('id,movement_type,quantity,reference_type,reference_id,created_at,product_id,products(name,unit)')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const errors = [
        salesToday.error,
        purchasesToday.error,
        products.error,
        customers.error,
        suppliers.error,
        recentSales.error,
        monthlySalesRaw.error,
        outOfStockProducts.error,
        expensesToday.error,
        categories.error,
        allSales.error,
        allPurchases.error,
        allExpenses.error,
        stockMovementsToday.error,
        recentMovements.error,
      ].filter(Boolean);

      if (errors.length) {
        console.error('Dashboard Supabase errors:', errors);
      }

      const productRows = products.data || [];
      const productMap = new Map(productRows.map((product: any) => [product.id, product]));

      // Correct profit calculation: fetch sale_items using ALL sale IDs from today's sales.
      let todayProfit = 0;
      const todaySaleIds = (salesToday.data || []).map((sale: any) => sale.id).filter(Boolean);

      if (todaySaleIds.length) {
        const { data: todaySaleItems, error: saleItemsError } = await supabase
          .from('sale_items')
          .select('product_id,quantity,rate')
          .in('sale_id', todaySaleIds);

        if (saleItemsError) {
          console.error('Dashboard sale_items error:', saleItemsError);
        } else {
          for (const item of todaySaleItems || []) {
            const product: any = productMap.get(item.product_id);
            const rate = Number(item.rate) || 0;
            const purchasePrice = Number(product?.purchase_price) || 0;
            const quantity = Number(item.quantity) || 0;
            todayProfit += (rate - purchasePrice) * quantity;
          }
        }
      }

      const todaySales = (salesToday.data || []).reduce(
        (sum: number, sale: any) => sum + (Number(sale.total_amount) || 0),
        0
      );

      const todayPurchases = (purchasesToday.data || []).reduce(
        (sum: number, purchase: any) => sum + (Number(purchase.total_amount) || 0),
        0
      );

      const todayExpenses = (expensesToday.data || []).reduce(
        (sum: number, expense: any) => sum + (Number(expense.amount) || 0),
        0
      );

      const customerDues = (customers.data || []).reduce(
        (sum: number, customer: any) => sum + Math.max(Number(customer.current_balance) || 0, 0),
        0
      );

      const supplierDues = (suppliers.data || []).reduce(
        (sum: number, supplier: any) => sum + Math.max(Number(supplier.current_balance) || 0, 0),
        0
      );

      const allSalesAmount = (allSales.data || []).reduce(
        (sum: number, sale: any) => sum + (Number(sale.total_amount) || 0),
        0
      );

      const allSalesPaid = (allSales.data || []).reduce(
        (sum: number, sale: any) => sum + (Number(sale.amount_paid) || 0),
        0
      );

      const allPurchasesPaid = (allPurchases.data || []).reduce(
        (sum: number, purchase: any) => sum + (Number(purchase.amount_paid) || 0),
        0
      );

      const allExpensesAmount = (allExpenses.data || []).reduce(
        (sum: number, expense: any) => sum + (Number(expense.amount) || 0),
        0
      );

      const cashBalance = allSalesPaid - allPurchasesPaid - allExpensesAmount;

      const monthlyMap = new Map<number, number>();
      for (let month = 0; month < 12; month += 1) monthlyMap.set(month, 0);

      for (const sale of monthlySalesRaw.data || []) {
        const date = new Date(sale.created_at);
        const month = date.getMonth();
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + (Number(sale.total_amount) || 0));
      }

      const monthlySales = Array.from({ length: 12 }, (_, month) => ({
        month: getMonthName(month),
        amount: monthlyMap.get(month) || 0,
      }));

      const movementRows = stockMovementsToday.data || [];

      const stockInToday = movementRows
        .filter((movement: any) => ['in', 'stock_in', 'purchase', 'return_in'].includes(String(movement.movement_type).toLowerCase()))
        .reduce((sum: number, movement: any) => sum + Math.abs(Number(movement.quantity) || 0), 0);

      const stockOutToday = movementRows
        .filter((movement: any) => ['out', 'stock_out', 'sale', 'return_out'].includes(String(movement.movement_type).toLowerCase()))
        .reduce((sum: number, movement: any) => sum + Math.abs(Number(movement.quantity) || 0), 0);

      const adjustmentsToday = movementRows
        .filter((movement: any) => ['adjustment', 'adjust'].includes(String(movement.movement_type).toLowerCase()))
        .reduce((sum: number, movement: any) => sum + Math.abs(Number(movement.quantity) || 0), 0);

      const lowStockProducts = productRows
        .filter((product: any) => {
          const stock = Number(product.stock_quantity) || 0;
          const minimum = Number(product.min_stock) || 0;
          return stock > 0 && stock <= minimum;
        })
        .sort((a: any, b: any) => (Number(a.stock_quantity) || 0) - (Number(b.stock_quantity) || 0))
        .slice(0, 100);

      const totalStockValue = productRows.reduce((sum: number, product: any) => {
        const stock = Number(product.stock_quantity) || 0;
        const purchasePrice = Number(product.purchase_price) || 0;
        return sum + stock * purchasePrice;
      }, 0);

      const nextData: DashboardData = {
        todaySales,
        todayPurchases,
        todayProfit,
        todayExpenses,
        cashBalance,
        totalProducts: productRows.length,
        categoryCount: categories.data?.length || 0,
        lowStockCount: lowStockProducts.length,
        customerDues,
        supplierDues,
        todayOrders: salesToday.data?.length || 0,
        monthlySales,
        recentSales: recentSales.data || [],
        lowStockProducts,
        outOfStockProducts: outOfStockProducts.data || [],
        recentMovements: recentMovements.data || [],
        stockInToday,
        stockOutToday,
        adjustmentsToday,
        totalStockValue,
        outOfStockCount: outOfStockProducts.data?.length || 0,
      };

      setData(nextData);
      setLastUpdated(new Date());

      if (!silent) {
        setSalesPage(1);
        setMovementsPage(1);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setData((current) => current || EMPTY_DASHBOARD_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInFlight.current = false;
    }
  };

  useEffect(() => {
    loadDashboard();

    const interval = window.setInterval(() => {
      loadDashboard(true);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const viewSale = async (sale: any) => {
    setSelectedSale(sale);
    setSelectedSaleItems([]);
    setSaleDetailsLoading(true);

    try {
      const { data: items, error } = await supabase
        .from('sale_items')
        .select('id,product_id,quantity,rate,products(name,unit)')
        .eq('sale_id', sale.id);

      if (error) {
        console.error('Sale details error:', error);
      }

      setSelectedSaleItems(items || []);
    } finally {
      setSaleDetailsLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-full bg-slate-50 p-4 sm:p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  const dashboard = data || EMPTY_DASHBOARD_DATA;

  const salesTotalPages = Math.max(1, Math.ceil(dashboard.recentSales.length / PAGE_SIZE));
  const movementTotalPages = Math.max(1, Math.ceil(dashboard.recentMovements.length / PAGE_SIZE));

  const paginatedSales = dashboard.recentSales.slice(
    (salesPage - 1) * PAGE_SIZE,
    salesPage * PAGE_SIZE
  );

  const paginatedMovements = dashboard.recentMovements.slice(
    (movementsPage - 1) * PAGE_SIZE,
    movementsPage * PAGE_SIZE
  );

  const maxMonthlySales = Math.max(...dashboard.monthlySales.map((item) => item.amount), 1);

  const paymentIcon = (method: string) => {
    const normalized = String(method || '').toLowerCase();
    if (normalized.includes('cash')) return <Banknote size={14} />;
    if (normalized.includes('upi') || normalized.includes('card')) return <CreditCard size={14} />;
    return <Receipt size={14} />;
  };

  const movementLabel = (type: string) => {
    const normalized = String(type || '').toLowerCase();
    if (['in', 'stock_in', 'purchase', 'return_in'].includes(normalized)) return 'Stock In';
    if (['out', 'stock_out', 'sale', 'return_out'].includes(normalized)) return 'Stock Out';
    if (['adjustment', 'adjust'].includes(normalized)) return 'Adjustment';
    return type || 'Movement';
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="animate-in slide-in-from-left-4 fade-in duration-500">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Overview of your store performance
              {lastUpdated && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Clock3 size={12} />
                  Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Primary stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StatCard
              title="Today's Sales"
              value={
                <AnimatedNumber value={dashboard.todaySales} prefix="₹" />
              }
              icon={<TrendingUp size={22} />}
              color="bg-blue-500"
              subtitle={`${dashboard.todayOrders} orders today`}
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
            <StatCard
              title="Today's Purchases"
              value={<AnimatedNumber value={dashboard.todayPurchases} prefix="₹" />}
              icon={<ShoppingCart size={22} />}
              color="bg-amber-500"
              subtitle="Today's purchase amount"
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
            <StatCard
              title="Today's Profit"
              value={<AnimatedNumber value={dashboard.todayProfit} prefix="₹" />}
              icon={<TrendingUp size={22} />}
              color="bg-green-500"
              subtitle="Estimated gross profit"
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <StatCard
              title="Total Products"
              value={<AnimatedNumber value={dashboard.totalProducts} />}
              icon={<Package size={22} />}
              color="bg-purple-500"
              subtitle={`${dashboard.categoryCount} categories`}
            />
          </div>
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <StatCard
              title="Today's Expenses"
              value={<AnimatedNumber value={dashboard.todayExpenses} prefix="₹" />}
              icon={<Receipt size={20} />}
              color="bg-rose-500"
              subtitle="Business expenses"
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <StatCard
              title="Cash Balance"
              value={<AnimatedNumber value={dashboard.cashBalance} prefix="₹" />}
              icon={<Wallet size={20} />}
              color="bg-emerald-500"
              subtitle="Current calculated balance"
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
            <StatCard
              title="Customer Dues"
              value={<AnimatedNumber value={dashboard.customerDues} prefix="₹" />}
              icon={<Users size={20} />}
              color="bg-cyan-500"
              subtitle="Outstanding receivables"
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200">
            <StatCard
              title="Supplier Dues"
              value={<AnimatedNumber value={dashboard.supplierDues} prefix="₹" />}
              icon={<Truck size={20} />}
              color="bg-orange-500"
              subtitle="Outstanding payables"
            />
          </div>
        </div>

        {/* Tertiary stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="animate-in fade-in duration-500">
            <StatCard
              title="Low Stock"
              value={<AnimatedNumber value={dashboard.lowStockCount} />}
              icon={<AlertTriangle size={20} />}
              color="bg-amber-500"
              subtitle="Products need attention"
            />
          </div>

          <div className="animate-in fade-in duration-500 delay-75">
            <StatCard
              title="Out of Stock"
              value={<AnimatedNumber value={dashboard.outOfStockCount} />}
              icon={<PackageOpen size={20} />}
              color="bg-red-500"
              subtitle="Products unavailable"
            />
          </div>

          <div className="animate-in fade-in duration-500 delay-150">
            <StatCard
              title="Stock In Today"
              value={<AnimatedNumber value={dashboard.stockInToday} />}
              icon={<TrendingUp size={20} />}
              color="bg-teal-500"
              subtitle="Units received"
            />
          </div>

          <div className="animate-in fade-in duration-500 delay-200">
            <StatCard
              title="Stock Out Today"
              value={<AnimatedNumber value={dashboard.stockOutToday} />}
              icon={<TrendingDown size={20} />}
              color="bg-indigo-500"
              subtitle="Units issued"
            />
          </div>
        </div>

        {/* Quaternary stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <div className="animate-in fade-in duration-500">
            <StatCard
              title="Adjustments Today"
              value={<AnimatedNumber value={dashboard.adjustmentsToday} />}
              icon={<Package size={20} />}
              color="bg-slate-600"
              subtitle="Adjusted units"
            />
          </div>

          <div className="animate-in fade-in duration-500 delay-75">
            <StatCard
              title="Total Stock Value"
              value={<AnimatedNumber value={dashboard.totalStockValue} prefix="₹" />}
              icon={<IndianRupee size={20} />}
              color="bg-violet-500"
              subtitle="At purchase price"
            />
          </div>
        </div>

        {/* Monthly sales + Recent sales */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden border-0 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="p-5">
              <SectionHeader
                icon={<TrendingUp size={18} />}
                title="Monthly Sales (This Year)"
              />

              <div className="mt-6 space-y-3">
                {dashboard.monthlySales.map((item, index) => (
                  <div key={`${item.month}-${index}`} className="group">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">{item.month}</span>
                      <span className="font-bold text-slate-800">{formatCurrency(item.amount)}</span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-out group-hover:brightness-110"
                        style={{
                          width: `${Math.max((item.amount / maxMonthlySales) * 100, item.amount > 0 ? 3 : 0)}%`,
                          animationDelay: `${index * 50}ms`,
                        }}
                        title={`${item.month}: ${formatCurrency(item.amount)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border-0 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="p-5">
              <SectionHeader
                icon={<Receipt size={18} />}
                title="Recent Sales"
                count={dashboard.recentSales.length}
              />

              <div className="mt-4 space-y-2">
                {paginatedSales.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                    No recent sales found.
                  </div>
                ) : (
                  paginatedSales.map((sale: any, index: number) => (
                    <div
                      key={sale.id || index}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 transition duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-900">
                            {sale.invoice_number || `Sale #${sale.id?.slice?.(0, 8) || index + 1}`}
                          </span>
                          <span className="hidden items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline-flex">
                            {paymentIcon(sale.payment_method)}
                            {sale.payment_method || 'N/A'}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {sale.customer_name || 'Walk-in Customer'} • {formatDate(sale.created_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {formatCurrency(Number(sale.total_amount) || 0)}
                        </span>

                        <button
                          type="button"
                          onClick={() => viewSale(sale)}
                          aria-label="View sale"
                          className="rounded-lg p-2 text-slate-500 opacity-80 transition hover:bg-slate-200 hover:text-slate-900 group-hover:opacity-100"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Pagination
                page={salesPage}
                totalPages={salesTotalPages}
                onPrevious={() => setSalesPage((page) => Math.max(1, page - 1))}
                onNext={() => setSalesPage((page) => Math.min(salesTotalPages, page + 1))}
              />
            </div>
          </Card>
        </div>

        {/* Low stock + out of stock */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="border-0 shadow-sm transition duration-300 hover:shadow-lg">
            <div className="p-5">
              <SectionHeader
                icon={<AlertTriangle size={18} />}
                title="Low Stock Alert"
                count={dashboard.lowStockProducts.length}
              />

              <div className="mt-4 space-y-3">
                {dashboard.lowStockProducts.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50 p-5 text-center text-sm font-medium text-emerald-700">
                    All products have healthy stock levels.
                  </div>
                ) : (
                  dashboard.lowStockProducts.slice(0, 8).map((product: any) => {
                    const stock = Number(product.stock_quantity) || 0;
                    const minimum = Math.max(Number(product.min_stock) || 1, 1);
                    const percentage = Math.min((stock / minimum) * 100, 100);

                    return (
                      <div
                        key={product.id}
                        className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
                            <p className="text-xs text-slate-500">
                              Minimum: {minimum} {product.unit || ''}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                            {stock} {product.unit || ''}
                          </span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-700"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>

          <Card className="border-0 shadow-sm transition duration-300 hover:shadow-lg">
            <div className="p-5">
              <SectionHeader
                icon={<PackageOpen size={18} />}
                title="Out of Stock Alert"
                count={dashboard.outOfStockProducts.length}
              />

              <div className="mt-4 space-y-2">
                {dashboard.outOfStockProducts.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50 p-5 text-center text-sm font-medium text-emerald-700">
                    No products are currently out of stock.
                  </div>
                ) : (
                  dashboard.outOfStockProducts.slice(0, 8).map((product: any) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/60 p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.unit || 'Unit not specified'}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                          OUT OF STOCK
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedOutOfStock(product)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-100 hover:text-red-700"
                          aria-label="View out of stock product"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Recent stock movements */}
        <Card className="border-0 shadow-sm transition duration-300 hover:shadow-lg">
          <div className="p-5">
            <SectionHeader
              icon={<Package size={18} />}
              title="Recent Stock Movements"
              count={dashboard.recentMovements.length}
            />

            <div className="mt-4 overflow-x-auto">
              {paginatedMovements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                  No recent stock movements found.
                </div>
              ) : (
                <div className="min-w-[620px]">
                  <div className="grid grid-cols-[1.7fr_1fr_0.8fr_1.1fr_0.7fr] gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <span>Product</span>
                    <span>Movement</span>
                    <span>Quantity</span>
                    <span>Date</span>
                    <span className="text-right">View</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {paginatedMovements.map((movement: any, index: number) => {
                      const type = String(movement.movement_type || '').toLowerCase();
                      const isIn = ['in', 'stock_in', 'purchase', 'return_in'].includes(type);
                      const isAdjustment = ['adjustment', 'adjust'].includes(type);

                      return (
                        <div
                          key={movement.id || index}
                          className="grid grid-cols-[1.7fr_1fr_0.8fr_1.1fr_0.7fr] items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {movement.products?.name || 'Unknown Product'}
                            </p>
                            <p className="text-xs text-slate-500">{movement.products?.unit || ''}</p>
                          </div>

                          <span
                            className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              isAdjustment
                                ? 'bg-blue-100 text-blue-700'
                                : isIn
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {movementLabel(movement.movement_type)}
                          </span>

                          <span className="text-sm font-bold text-slate-800">
                            {Math.abs(Number(movement.quantity) || 0)}
                          </span>

                          <span className="text-xs text-slate-500">
                            {formatDate(movement.created_at)}
                          </span>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedMovement(movement)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                              aria-label="View stock movement"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Pagination
              page={movementsPage}
              totalPages={movementTotalPages}
              onPrevious={() => setMovementsPage((page) => Math.max(1, page - 1))}
              onNext={() => setMovementsPage((page) => Math.min(movementTotalPages, page + 1))}
            />
          </div>
        </Card>
      </div>

      {/* Sale details modal */}
      {selectedSale && (
        <Modal
          title={`Sale ${selectedSale.invoice_number || `#${selectedSale.id?.slice?.(0, 8) || ''}`}`}
          onClose={() => setSelectedSale(null)}
          wide
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Customer</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {selectedSale.customer_name || 'Walk-in Customer'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Date</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatDate(selectedSale.created_at)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Payment</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                {paymentIcon(selectedSale.payment_method)}
                {selectedSale.payment_method || 'N/A'}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-900">Items</h4>
              <span className="text-sm font-extrabold text-slate-900">
                {formatCurrency(Number(selectedSale.total_amount) || 0)}
              </span>
            </div>

            {saleDetailsLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : selectedSaleItems.length === 0 ? (
              <p className="p-5 text-center text-sm text-slate-500">
                No sale item details found.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedSaleItems.map((item: any, index: number) => {
                  const quantity = Number(item.quantity) || 0;
                  const rate = Number(item.rate) || 0;

                  return (
                    <div
                      key={item.id || index}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.products?.name || `Product ${item.product_id || ''}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {quantity} {item.products?.unit || 'unit'} × {formatCurrency(rate)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {formatCurrency(quantity * rate)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
            <span className="text-sm font-medium text-slate-300">Total Amount</span>
            <span className="text-lg font-extrabold">
              {formatCurrency(Number(selectedSale.total_amount) || 0)}
            </span>
          </div>
        </Modal>
      )}

      {/* Movement details modal */}
      {selectedMovement && (
        <Modal
          title="Stock Movement Details"
          onClose={() => setSelectedMovement(null)}
        >
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Product</p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {selectedMovement.products?.name || 'Unknown Product'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Movement Type</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {movementLabel(selectedMovement.movement_type)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Quantity</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {Math.abs(Number(selectedMovement.quantity) || 0)} {selectedMovement.products?.unit || ''}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Reference</p>
                <p className="mt-1 break-all text-sm font-bold text-slate-900">
                  {selectedMovement.reference_type || 'N/A'}
                  {selectedMovement.reference_id ? ` • ${selectedMovement.reference_id}` : ''}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Date & Time</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {new Date(selectedMovement.created_at).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Out of stock modal */}
      {selectedOutOfStock && (
        <Modal
          title="Out of Stock Product"
          onClose={() => setSelectedOutOfStock(null)}
        >
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <PackageOpen size={30} />
            </div>

            <h3 className="mt-4 text-lg font-extrabold text-slate-900">
              {selectedOutOfStock.name}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              This product currently has no available stock.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Current Stock</p>
                <p className="mt-1 text-lg font-extrabold text-red-600">
                  {Number(selectedOutOfStock.stock_quantity) || 0} {selectedOutOfStock.unit || ''}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Minimum Stock</p>
                <p className="mt-1 text-lg font-extrabold text-slate-900">
                  {Number(selectedOutOfStock.min_stock) || 0} {selectedOutOfStock.unit || ''}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
