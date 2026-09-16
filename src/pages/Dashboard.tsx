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
  LayoutDashboard,
  FileBarChart2,
  Scale,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  BookOpen,
  RotateCcw,
  Undo2,
  FileSpreadsheet,
  Printer,
  Download,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { Card, StatCard } from '@/components/ui';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';

/* ============================================================
   TYPES
============================================================ */

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

/* ============================================================
   REPORT CONFIG
============================================================ */

type ReportKey =
  | 'sales'
  | 'purchase'
  | 'pnl'
  | 'current-stock'
  | 'stock-valuation'
  | 'low-stock'
  | 'out-of-stock'
  | 'stock-movement'
  | 'stock-in'
  | 'stock-out'
  | 'stock-adjustment'
  | 'stock-ledger'
  | 'sales-return'
  | 'purchase-return'
  | 'customer-outstanding'
  | 'supplier-outstanding'
  | 'gst';

interface ReportDef {
  key: ReportKey;
  label: string;
  icon: ReactNode;
  group: 'Analytics' | 'Stock' | 'Returns' | 'Outstanding';
}

const REPORTS: ReportDef[] = [
  { key: 'sales', label: 'Sales Report', icon: <TrendingUp size={16} />, group: 'Analytics' },
  { key: 'purchase', label: 'Purchase Report', icon: <ShoppingCart size={16} />, group: 'Analytics' },
  { key: 'pnl', label: 'Profit & Loss', icon: <Scale size={16} />, group: 'Analytics' },
  { key: 'gst', label: 'GST Report', icon: <FileSpreadsheet size={16} />, group: 'Analytics' },

  { key: 'current-stock', label: 'Current Stock', icon: <Package size={16} />, group: 'Stock' },
  { key: 'stock-valuation', label: 'Stock Valuation', icon: <IndianRupee size={16} />, group: 'Stock' },
  { key: 'low-stock', label: 'Low Stock', icon: <AlertTriangle size={16} />, group: 'Stock' },
  { key: 'out-of-stock', label: 'Out of Stock', icon: <PackageOpen size={16} />, group: 'Stock' },
  { key: 'stock-movement', label: 'Stock Movement', icon: <ArrowLeftRight size={16} />, group: 'Stock' },
  { key: 'stock-in', label: 'Stock In Report', icon: <ArrowDownToLine size={16} />, group: 'Stock' },
  { key: 'stock-out', label: 'Stock Out Report', icon: <ArrowUpFromLine size={16} />, group: 'Stock' },
  { key: 'stock-adjustment', label: 'Stock Adjustment', icon: <SlidersHorizontal size={16} />, group: 'Stock' },
  { key: 'stock-ledger', label: 'Stock Ledger', icon: <BookOpen size={16} />, group: 'Stock' },

  { key: 'sales-return', label: 'Sales Return', icon: <RotateCcw size={16} />, group: 'Returns' },
  { key: 'purchase-return', label: 'Purchase Return', icon: <Undo2 size={16} />, group: 'Returns' },

  { key: 'customer-outstanding', label: 'Customer Outstanding', icon: <Users size={16} />, group: 'Outstanding' },
  { key: 'supplier-outstanding', label: 'Supplier Outstanding', icon: <Truck size={16} />, group: 'Outstanding' },
];

const GROUP_ORDER: ReportDef['group'][] = ['Analytics', 'Stock', 'Returns', 'Outstanding'];

/* ============================================================
   HELPERS
============================================================ */

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonthDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/* ============================================================
   SHARED UI COMPONENTS
============================================================ */

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
      if (progress < 1) frame = requestAnimationFrame(animate);
      else previousValue.current = to;
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
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="h-80 rounded-2xl bg-slate-200" />
        <div className="h-80 rounded-2xl bg-slate-200" />
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        className={`w-full ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        } overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-3 duration-200`}
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

function MiniStat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'blue' | 'green' | 'red' | 'amber';
}) {
  const toneMap: Record<string, string> = {
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1.5 text-xl font-extrabold tracking-tight ${toneMap[tone]}`}>
        {value}
      </p>
    </div>
  );
}

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

function ReportTable<T extends { id?: string | number }>({
  columns,
  rows,
  empty = 'No records found for the selected filters.',
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`whitespace-nowrap px-4 py-3 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)} className="transition hover:bg-slate-50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-slate-700 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function Dashboard() {
  const [view, setView] = useState<'dashboard' | 'reports'>('dashboard');

  /* ---------------- Dashboard state ---------------- */
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

  /* ---------------- Report state ---------------- */
  const [activeReport, setActiveReport] = useState<ReportKey>('sales');
  const [reportFrom, setReportFrom] = useState<string>(toISODate(startOfMonthDate(new Date())));
  const [reportTo, setReportTo] = useState<string>(toISODate(new Date()));
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<{
    summary: { label: string; value: string; tone?: any }[];
    rows: any[];
  }>({ summary: [], rows: [] });

  const reportRequestInFlight = useRef(false);

  /* ============================================================
     DASHBOARD LOADER (unchanged logic)
  ============================================================ */
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

        supabase.from('sales').select('id,total_amount,amount_paid').limit(5000),
        supabase.from('purchases').select('total_amount,amount_paid').limit(5000),
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

      if (errors.length) console.error('Dashboard Supabase errors:', errors);

      const productRows = products.data || [];
      const productMap = new Map(productRows.map((p: any) => [p.id, p]));

      /* Correct today's profit via sale_items */
      let todayProfit = 0;
      const todaySaleIds = (salesToday.data || [])
        .map((s: any) => s.id)
        .filter(Boolean);

      if (todaySaleIds.length) {
        const { data: todaySaleItems, error } = await supabase
          .from('sale_items')
          .select('product_id,quantity,rate')
          .in('sale_id', todaySaleIds);

        if (error) console.error('Dashboard sale_items error:', error);
        else {
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
        (s: number, r: any) => s + (Number(r.total_amount) || 0),
        0
      );
      const todayPurchases = (purchasesToday.data || []).reduce(
        (s: number, r: any) => s + (Number(r.total_amount) || 0),
        0
      );
      const todayExpenses = (expensesToday.data || []).reduce(
        (s: number, r: any) => s + (Number(r.amount) || 0),
        0
      );

      const customerDues = (customers.data || []).reduce(
        (s: number, r: any) => s + Math.max(Number(r.current_balance) || 0, 0),
        0
      );
      const supplierDues = (suppliers.data || []).reduce(
        (s: number, r: any) => s + Math.max(Number(r.current_balance) || 0, 0),
        0
      );

      const allSalesPaid = (allSales.data || []).reduce(
        (s: number, r: any) => s + (Number(r.amount_paid) || 0),
        0
      );
      const allPurchasesPaid = (allPurchases.data || []).reduce(
        (s: number, r: any) => s + (Number(r.amount_paid) || 0),
        0
      );
      const allExpensesAmount = (allExpenses.data || []).reduce(
        (s: number, r: any) => s + (Number(r.amount) || 0),
        0
      );
      const cashBalance = allSalesPaid - allPurchasesPaid - allExpensesAmount;

      const monthlyMap = new Map<number, number>();
      for (let m = 0; m < 12; m += 1) monthlyMap.set(m, 0);
      for (const sale of monthlySalesRaw.data || []) {
        const date = new Date(sale.created_at);
        const m = date.getMonth();
        monthlyMap.set(m, (monthlyMap.get(m) || 0) + (Number(sale.total_amount) || 0));
      }

      const monthlySales = Array.from({ length: 12 }, (_, m) => ({
        month: getMonthName(m),
        amount: monthlyMap.get(m) || 0,
      }));

      const movementRows = stockMovementsToday.data || [];
      const stockInToday = movementRows
        .filter((m: any) =>
          ['in', 'stock_in', 'purchase', 'return_in'].includes(
            String(m.movement_type).toLowerCase()
          )
        )
        .reduce((s: number, m: any) => s + Math.abs(Number(m.quantity) || 0), 0);

      const stockOutToday = movementRows
        .filter((m: any) =>
          ['out', 'stock_out', 'sale', 'return_out'].includes(
            String(m.movement_type).toLowerCase()
          )
        )
        .reduce((s: number, m: any) => s + Math.abs(Number(m.quantity) || 0), 0);

      const adjustmentsToday = movementRows
        .filter((m: any) =>
          ['adjustment', 'adjust'].includes(String(m.movement_type).toLowerCase())
        )
        .reduce((s: number, m: any) => s + Math.abs(Number(m.quantity) || 0), 0);

      const lowStockProducts = productRows
        .filter((p: any) => {
          const stock = Number(p.stock_quantity) || 0;
          const min = Number(p.min_stock) || 0;
          return stock > 0 && stock <= min;
        })
        .sort(
          (a: any, b: any) =>
            (Number(a.stock_quantity) || 0) - (Number(b.stock_quantity) || 0)
        )
        .slice(0, 100);

      const totalStockValue = productRows.reduce((s: number, p: any) => {
        const stock = Number(p.stock_quantity) || 0;
        const price = Number(p.purchase_price) || 0;
        return s + stock * price;
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
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setData((c) => c || EMPTY_DASHBOARD_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInFlight.current = false;
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = window.setInterval(() => loadDashboard(true), 60_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (error) console.error('Sale details error:', error);
      setSelectedSaleItems(items || []);
    } finally {
      setSaleDetailsLoading(false);
    }
  };

  /* ============================================================
     REPORT LOADER
  ============================================================ */
  const loadReport = async () => {
    if (reportRequestInFlight.current) return;
    reportRequestInFlight.current = true;
    setReportLoading(true);

    try {
      const fromIso = new Date(`${reportFrom}T00:00:00`).toISOString();
      const toIso = new Date(`${reportTo}T23:59:59.999`).toISOString();

      let result: { summary: any[]; rows: any[] } = { summary: [], rows: [] };

      /* ---------- SALES ---------- */
      if (activeReport === 'sales') {
        const { data: sales } = await supabase
          .from('sales')
          .select('id,invoice_number,customer_name,total_amount,amount_paid,payment_method,created_at')
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false });

        const rows = sales || [];
        const totalSales = rows.reduce((s, r: any) => s + (Number(r.total_amount) || 0), 0);
        const totalCollected = rows.reduce((s, r: any) => s + (Number(r.amount_paid) || 0), 0);

        result = {
          summary: [
            { label: 'Total Sales', value: formatCurrency(totalSales), tone: 'blue' },
            { label: 'Total Collected', value: formatCurrency(totalCollected), tone: 'green' },
            {
              label: 'Outstanding',
              value: formatCurrency(Math.max(totalSales - totalCollected, 0)),
              tone: 'red',
            },
            { label: 'Total Invoices', value: String(rows.length), tone: 'slate' },
          ],
          rows,
        };
      }

      /* ---------- PURCHASE ---------- */
      else if (activeReport === 'purchase') {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('id,bill_number,supplier_name,total_amount,amount_paid,payment_method,created_at')
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false });

        const rows = purchases || [];
        const total = rows.reduce((s, r: any) => s + (Number(r.total_amount) || 0), 0);
        const paid = rows.reduce((s, r: any) => s + (Number(r.amount_paid) || 0), 0);

        result = {
          summary: [
            { label: 'Total Purchases', value: formatCurrency(total), tone: 'amber' },
            { label: 'Total Paid', value: formatCurrency(paid), tone: 'green' },
            {
              label: 'Outstanding',
              value: formatCurrency(Math.max(total - paid, 0)),
              tone: 'red',
            },
            { label: 'Total Bills', value: String(rows.length), tone: 'slate' },
          ],
          rows,
        };
      }

      /* ---------- P&L ---------- */
      else if (activeReport === 'pnl') {
        const [salesRes, purchasesRes, expensesRes] = await Promise.all([
          supabase
            .from('sales')
            .select('total_amount')
            .gte('created_at', fromIso)
            .lte('created_at', toIso),
          supabase
            .from('purchases')
            .select('total_amount')
            .gte('created_at', fromIso)
            .lte('created_at', toIso),
          supabase
            .from('expenses')
            .select('amount')
            .gte('created_at', fromIso)
            .lte('created_at', toIso),
        ]);

        const sales = (salesRes.data || []).reduce(
          (s, r: any) => s + (Number(r.total_amount) || 0),
          0
        );
        const purchases = (purchasesRes.data || []).reduce(
          (s, r: any) => s + (Number(r.total_amount) || 0),
          0
        );
        const expenses = (expensesRes.data || []).reduce(
          (s, r: any) => s + (Number(r.amount) || 0),
          0
        );
        const netProfit = sales - purchases - expenses;

        result = {
          summary: [
            { label: 'Sales', value: formatCurrency(sales), tone: 'blue' },
            { label: 'Purchases', value: formatCurrency(purchases), tone: 'amber' },
            { label: 'Expenses', value: formatCurrency(expenses), tone: 'red' },
            {
              label: netProfit >= 0 ? 'Net Profit' : 'Net Loss',
              value: formatCurrency(Math.abs(netProfit)),
              tone: netProfit >= 0 ? 'green' : 'red',
            },
          ],
          rows: [],
        };
      }

      /* ---------- GST ---------- */
      else if (activeReport === 'gst') {
        const { data: sales } = await supabase
          .from('sales')
          .select('id,invoice_number,total_amount,created_at')
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false });

        const rows = sales || [];
        const total = rows.reduce((s, r: any) => s + (Number(r.total_amount) || 0), 0);
        const taxable = total / 1.18;
        const gst = total - taxable;

        result = {
          summary: [
            { label: 'Taxable Value', value: formatCurrency(taxable), tone: 'slate' },
            { label: 'GST (est. 18%)', value: formatCurrency(gst), tone: 'blue' },
            { label: 'Invoices', value: String(rows.length), tone: 'slate' },
          ],
          rows,
        };
      }

      /* ---------- CUSTOMER OUTSTANDING ---------- */
      else if (activeReport === 'customer-outstanding') {
        const { data: customers } = await supabase
          .from('customers')
          .select('id,name,phone,current_balance')
          .order('current_balance', { ascending: false });

        const rows = (customers || []).filter((c: any) => Number(c.current_balance) > 0);
        const total = rows.reduce((s, r: any) => s + (Number(r.current_balance) || 0), 0);

        result = {
          summary: [
            { label: 'Customers with Dues', value: String(rows.length), tone: 'slate' },
            { label: 'Total Receivable', value: formatCurrency(total), tone: 'red' },
          ],
          rows,
        };
      }

      /* ---------- SUPPLIER OUTSTANDING ---------- */
      else if (activeReport === 'supplier-outstanding') {
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id,name,phone,current_balance')
          .order('current_balance', { ascending: false });

        const rows = (suppliers || []).filter((s: any) => Number(s.current_balance) > 0);
        const total = rows.reduce((s, r: any) => s + (Number(r.current_balance) || 0), 0);

        result = {
          summary: [
            { label: 'Suppliers Payable', value: String(rows.length), tone: 'slate' },
            { label: 'Total Payable', value: formatCurrency(total), tone: 'red' },
          ],
          rows,
        };
      }

      /* ---------- STOCK REPORTS ---------- */
      else if (
        ['current-stock', 'stock-valuation', 'low-stock', 'out-of-stock'].includes(activeReport)
      ) {
        const { data: products } = await supabase
          .from('products')
          .select('id,name,unit,stock_quantity,min_stock,purchase_price,selling_price')
          .order('name');

        const all = products || [];
        let rows: any[] = all;

        if (activeReport === 'low-stock') {
          rows = all.filter((p: any) => {
            const s = Number(p.stock_quantity) || 0;
            const m = Number(p.min_stock) || 0;
            return s > 0 && s <= m;
          });
        }
        if (activeReport === 'out-of-stock') {
          rows = all.filter((p: any) => (Number(p.stock_quantity) || 0) <= 0);
        }

        const totalValue = rows.reduce(
          (s, p: any) =>
            s + (Number(p.stock_quantity) || 0) * (Number(p.purchase_price) || 0),
          0
        );

        result = {
          summary: [
            { label: 'Items', value: String(rows.length), tone: 'slate' },
            { label: 'Stock Value', value: formatCurrency(totalValue), tone: 'green' },
          ],
          rows,
        };
      }

      /* ---------- MOVEMENT REPORTS ---------- */
      else if (
        ['stock-movement', 'stock-in', 'stock-out', 'stock-adjustment', 'stock-ledger'].includes(
          activeReport
        )
      ) {
        let query = supabase
          .from('stock_movements')
          .select(
            'id,movement_type,quantity,reference_type,reference_id,created_at,products(name,unit)'
          )
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (activeReport === 'stock-in') {
          query = query.in('movement_type', ['in', 'stock_in', 'purchase', 'return_in']);
        }
        if (activeReport === 'stock-out') {
          query = query.in('movement_type', ['out', 'stock_out', 'sale', 'return_out']);
        }
        if (activeReport === 'stock-adjustment') {
          query = query.in('movement_type', [
            'adjustment',
            'adjust',
            'adjustment_in',
            'adjustment_out',
          ]);
        }

        const { data: movements } = await query;
        const rows = movements || [];

        const inQty = rows
          .filter((m: any) =>
            ['in', 'stock_in', 'purchase', 'return_in'].includes(
              String(m.movement_type).toLowerCase()
            )
          )
          .reduce((s, m: any) => s + Math.abs(Number(m.quantity) || 0), 0);

        const outQty = rows
          .filter((m: any) =>
            ['out', 'stock_out', 'sale', 'return_out'].includes(
              String(m.movement_type).toLowerCase()
            )
          )
          .reduce((s, m: any) => s + Math.abs(Number(m.quantity) || 0), 0);

        result = {
          summary: [
            { label: 'Movements', value: String(rows.length), tone: 'slate' },
            { label: 'Total In', value: String(inQty), tone: 'green' },
            { label: 'Total Out', value: String(outQty), tone: 'red' },
          ],
          rows,
        };
      }

      setReportData(result);
    } catch (err) {
      console.error('Report load error:', err);
      setReportData({ summary: [], rows: [] });
    } finally {
      setReportLoading(false);
      reportRequestInFlight.current = false;
    }
  };

  useEffect(() => {
    if (view === 'reports') loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, view]);

  /* ============================================================
     EARLY LOADING
  ============================================================ */
  if (loading && !data && view === 'dashboard') {
    return (
      <div className="min-h-full bg-slate-50 p-4 sm:p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  const dashboard = data || EMPTY_DASHBOARD_DATA;
  const salesTotalPages = Math.max(1, Math.ceil(dashboard.recentSales.length / PAGE_SIZE));
  const movementTotalPages = Math.max(
    1,
    Math.ceil(dashboard.recentMovements.length / PAGE_SIZE)
  );

  const paginatedSales = dashboard.recentSales.slice(
    (salesPage - 1) * PAGE_SIZE,
    salesPage * PAGE_SIZE
  );
  const paginatedMovements = dashboard.recentMovements.slice(
    (movementsPage - 1) * PAGE_SIZE,
    movementsPage * PAGE_SIZE
  );

  const maxMonthlySales = Math.max(...dashboard.monthlySales.map((m) => m.amount), 1);

  const paymentIcon = (method: string) => {
    const n = String(method || '').toLowerCase();
    if (n.includes('cash')) return <Banknote size={14} />;
    if (n.includes('upi') || n.includes('card')) return <CreditCard size={14} />;
    return <Receipt size={14} />;
  };

  const movementLabel = (type: string) => {
    const n = String(type || '').toLowerCase();
    if (['in', 'stock_in', 'purchase', 'return_in'].includes(n)) return 'Stock In';
    if (['out', 'stock_out', 'sale', 'return_out'].includes(n)) return 'Stock Out';
    if (['adjustment', 'adjust'].includes(n)) return 'Adjustment';
    return type || 'Movement';
  };

  /* ---------- Report columns ---------- */
  const salesColumns: Column<any>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (r) => (
        <span className="font-semibold text-slate-900">
          {r.invoice_number || `#${String(r.id).slice(0, 8)}`}
        </span>
      ),
    },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.created_at) },
    { key: 'customer', header: 'Customer', render: (r) => r.customer_name || 'Walk-in' },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (r) => (
        <span className="font-semibold">{formatCurrency(Number(r.total_amount) || 0)}</span>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      render: (r) => formatCurrency(Number(r.amount_paid) || 0),
    },
    {
      key: 'due',
      header: 'Due',
      align: 'right',
      render: (r) => {
        const due = (Number(r.total_amount) || 0) - (Number(r.amount_paid) || 0);
        if (due <= 0)
          return (
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
              Paid
            </span>
          );
        return (
          <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
            {formatCurrency(due)}
          </span>
        );
      },
    },
  ];

  const purchaseColumns: Column<any>[] = [
    {
      key: 'bill',
      header: 'Bill',
      render: (r) => (
        <span className="font-semibold text-slate-900">
          {r.bill_number || `#${String(r.id).slice(0, 8)}`}
        </span>
      ),
    },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.created_at) },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier_name || '—' },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (r) => (
        <span className="font-semibold">{formatCurrency(Number(r.total_amount) || 0)}</span>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      render: (r) => formatCurrency(Number(r.amount_paid) || 0),
    },
    {
      key: 'due',
      header: 'Due',
      align: 'right',
      render: (r) => {
        const due = (Number(r.total_amount) || 0) - (Number(r.amount_paid) || 0);
        return due > 0 ? (
          <span className="font-semibold text-red-600">{formatCurrency(due)}</span>
        ) : (
          <span className="text-xs font-bold text-emerald-700">Paid</span>
        );
      },
    },
  ];

  const outstandingColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => <span className="font-semibold text-slate-900">{r.name}</span>,
    },
    { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
    {
      key: 'balance',
      header: 'Outstanding',
      align: 'right',
      render: (r) => (
        <span className="font-bold text-red-600">
          {formatCurrency(Number(r.current_balance) || 0)}
        </span>
      ),
    },
  ];

  const stockColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (r) => <span className="font-semibold text-slate-900">{r.name}</span>,
    },
    { key: 'unit', header: 'Unit', render: (r) => r.unit || '—' },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      render: (r) => String(r.stock_quantity ?? 0),
    },
    { key: 'min', header: 'Min', align: 'right', render: (r) => String(r.min_stock ?? 0) },
    {
      key: 'purchase',
      header: 'Purchase Price',
      align: 'right',
      render: (r) => formatCurrency(Number(r.purchase_price) || 0),
    },
    {
      key: 'value',
      header: 'Stock Value',
      align: 'right',
      render: (r) => (
        <span className="font-semibold">
          {formatCurrency(
            (Number(r.stock_quantity) || 0) * (Number(r.purchase_price) || 0)
          )}
        </span>
      ),
    },
  ];

  const movementColumns: Column<any>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (r) => (
        <span className="font-semibold text-slate-900">
          {r.products?.name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => {
        const t = String(r.movement_type || '').toLowerCase();
        const isIn = ['in', 'stock_in', 'purchase', 'return_in'].includes(t);
        const isAdj = ['adjustment', 'adjust', 'adjustment_in', 'adjustment_out'].includes(t);
        const cls = isAdj
          ? 'bg-blue-50 text-blue-700'
          : isIn
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-700';
        return (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>
            {r.movement_type}
          </span>
        );
      },
    },
    {
      key: 'qty',
      header: 'Quantity',
      align: 'right',
      render: (r) => (
        <span className="font-semibold">{Math.abs(Number(r.quantity) || 0)}</span>
      ),
    },
    { key: 'ref', header: 'Reference', render: (r) => r.reference_type || '—' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.created_at) },
  ];

  const gstColumns: Column<any>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (r) => <span className="font-semibold text-slate-900">{r.invoice_number}</span>,
    },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.created_at) },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (r) => formatCurrency(Number(r.total_amount) || 0),
    },
  ];

  const currentColumns = (() => {
    switch (activeReport) {
      case 'sales':
        return salesColumns;
      case 'purchase':
        return purchaseColumns;
      case 'customer-outstanding':
      case 'supplier-outstanding':
        return outstandingColumns;
      case 'current-stock':
      case 'stock-valuation':
      case 'low-stock':
      case 'out-of-stock':
        return stockColumns;
      case 'stock-movement':
      case 'stock-in':
      case 'stock-out':
      case 'stock-adjustment':
      case 'stock-ledger':
        return movementColumns;
      case 'gst':
        return gstColumns;
      default:
        return [];
    }
  })();

  const activeDef = REPORTS.find((r) => r.key === activeReport)!;

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header + Tabs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="animate-in slide-in-from-left-4 fade-in duration-500">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {view === 'dashboard' ? 'Dashboard' : 'Reports'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {view === 'dashboard' ? (
                <>
                  Overview of your store performance
                  {lastUpdated && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Clock3 size={12} />
                      Updated{' '}
                      {lastUpdated.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </>
              ) : (
                'Analyze your business performance'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  view === 'dashboard'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard size={15} />
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setView('reports')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  view === 'reports'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileBarChart2 size={15} />
                Reports
              </button>
            </div>

            {view === 'dashboard' && (
              <button
                type="button"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
        </div>

        {/* ============================================================
            DASHBOARD VIEW
        ============================================================ */}
        {view === 'dashboard' && (
          <>
            {/* Primary stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatCard
                  title="Today's Sales"
                  value={<AnimatedNumber value={dashboard.todaySales} prefix="₹" />}
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
              <StatCard
                title="Today's Expenses"
                value={<AnimatedNumber value={dashboard.todayExpenses} prefix="₹" />}
                icon={<Receipt size={20} />}
                color="bg-rose-500"
                subtitle="Business expenses"
              />
              <StatCard
                title="Cash Balance"
                value={<AnimatedNumber value={dashboard.cashBalance} prefix="₹" />}
                icon={<Wallet size={20} />}
                color="bg-emerald-500"
                subtitle="Current calculated balance"
              />
              <StatCard
                title="Customer Dues"
                value={<AnimatedNumber value={dashboard.customerDues} prefix="₹" />}
                icon={<Users size={20} />}
                color="bg-cyan-500"
                subtitle="Outstanding receivables"
              />
              <StatCard
                title="Supplier Dues"
                value={<AnimatedNumber value={dashboard.supplierDues} prefix="₹" />}
                icon={<Truck size={20} />}
                color="bg-orange-500"
                subtitle="Outstanding payables"
              />
            </div>

            {/* Tertiary stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Low Stock"
                value={<AnimatedNumber value={dashboard.lowStockCount} />}
                icon={<AlertTriangle size={20} />}
                color="bg-amber-500"
                subtitle="Products need attention"
              />
              <StatCard
                title="Out of Stock"
                value={<AnimatedNumber value={dashboard.outOfStockCount} />}
                icon={<PackageOpen size={20} />}
                color="bg-red-500"
                subtitle="Products unavailable"
              />
              <StatCard
                title="Stock In Today"
                value={<AnimatedNumber value={dashboard.stockInToday} />}
                icon={<TrendingUp size={20} />}
                color="bg-teal-500"
                subtitle="Units received"
              />
              <StatCard
                title="Stock Out Today"
                value={<AnimatedNumber value={dashboard.stockOutToday} />}
                icon={<TrendingDown size={20} />}
                color="bg-indigo-500"
                subtitle="Units issued"
              />
            </div>

            {/* Quaternary stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
              <StatCard
                title="Adjustments Today"
                value={<AnimatedNumber value={dashboard.adjustmentsToday} />}
                icon={<Package size={20} />}
                color="bg-slate-600"
                subtitle="Adjusted units"
              />
              <StatCard
                title="Total Stock Value"
                value={<AnimatedNumber value={dashboard.totalStockValue} prefix="₹" />}
                icon={<IndianRupee size={20} />}
                color="bg-violet-500"
                subtitle="At purchase price"
              />
            </div>

            {/* Monthly + recent sales */}
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
                          <span className="font-bold text-slate-800">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-out group-hover:brightness-110"
                            style={{
                              width: `${Math.max(
                                (item.amount / maxMonthlySales) * 100,
                                item.amount > 0 ? 3 : 0
                              )}%`,
                            }}
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
                          className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-slate-900">
                                {sale.invoice_number ||
                                  `Sale #${sale.id?.slice?.(0, 8) || index + 1}`}
                              </span>
                              <span className="hidden items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline-flex">
                                {paymentIcon(sale.payment_method)}
                                {sale.payment_method || 'N/A'}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {sale.customer_name || 'Walk-in Customer'} •{' '}
                              {formatDate(sale.created_at)}
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
                    onPrevious={() => setSalesPage((p) => Math.max(1, p - 1))}
                    onNext={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))}
                  />
                </div>
              </Card>
            </div>

            {/* Low + out of stock */}
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
                        const pct = Math.min((stock / minimum) * 100, 100);
                        return (
                          <div
                            key={product.id}
                            className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {product.name}
                                </p>
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
                                style={{ width: `${pct}%` }}
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
                            <p className="truncate text-sm font-bold text-slate-900">
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {product.unit || 'Unit not specified'}
                            </p>
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

            {/* Recent movements */}
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
                                <p className="text-xs text-slate-500">
                                  {movement.products?.unit || ''}
                                </p>
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
                  onPrevious={() => setMovementsPage((p) => Math.max(1, p - 1))}
                  onNext={() => setMovementsPage((p) => Math.min(movementTotalPages, p + 1))}
                />
              </div>
            </Card>
          </>
        )}

        {/* ============================================================
            REPORTS VIEW
        ============================================================ */}
        {view === 'reports' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
            {/* Sidebar */}
            <Card className="h-fit border-0 p-3 shadow-sm">
              <nav className="space-y-4">
                {GROUP_ORDER.map((group) => {
                  const items = REPORTS.filter((r) => r.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {group}
                      </p>
                      <div className="space-y-0.5">
                        {items.map((r) => {
                          const isActive = r.key === activeReport;
                          return (
                            <button
                              key={r.key}
                              type="button"
                              onClick={() => setActiveReport(r.key)}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                                isActive
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <span className={isActive ? 'text-white' : 'text-slate-400'}>
                                {r.icon}
                              </span>
                              <span className="truncate">{r.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </Card>

            {/* Main */}
            <div className="space-y-5">
              {/* Filter bar */}
              <Card className="border-0 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        From Date
                      </label>
                      <div className="relative">
                        <CalendarDays
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="date"
                          value={reportFrom}
                          onChange={(e) => setReportFrom(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        To Date
                      </label>
                      <div className="relative">
                        <CalendarDays
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="date"
                          value={reportTo}
                          onChange={(e) => setReportTo(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadReport}
                      disabled={reportLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw size={15} className={reportLoading ? 'animate-spin' : ''} />
                      {reportLoading ? 'Generating...' : 'Generate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      aria-label="Print"
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      aria-label="Export"
                    >
                      <Download size={15} />
                    </button>
                  </div>
                </div>
              </Card>

              {/* Report header */}
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-slate-900 p-2 text-white">{activeDef.icon}</div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                  {activeDef.label}
                </h2>
              </div>

              {/* Summary */}
              {reportData.summary.length > 0 && (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {reportData.summary.map((s) => (
                    <MiniStat key={s.label} label={s.label} value={s.value} tone={s.tone} />
                  ))}
                </div>
              )}

              {/* Table */}
              <Card className="border-0 p-5 shadow-sm">
                {reportLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                  </div>
                ) : (
                  <ReportTable
                    columns={currentColumns as Column<any>[]}
                    rows={reportData.rows}
                    empty={`No ${activeDef.label.toLowerCase()} data for the selected date range.`}
                  />
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Modals (dashboard) ---------- */}
      {selectedSale && (
        <Modal
          title={`Sale ${
            selectedSale.invoice_number || `#${selectedSale.id?.slice?.(0, 8) || ''}`
          }`}
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
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : selectedSaleItems.length === 0 ? (
              <p className="p-5 text-center text-sm text-slate-500">
                No sale item details found.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedSaleItems.map((item: any, index: number) => {
                  const q = Number(item.quantity) || 0;
                  const r = Number(item.rate) || 0;
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
                          {q} {item.products?.unit || 'unit'} × {formatCurrency(r)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {formatCurrency(q * r)}
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

      {selectedMovement && (
        <Modal title="Stock Movement Details" onClose={() => setSelectedMovement(null)}>
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
                  {Math.abs(Number(selectedMovement.quantity) || 0)}{' '}
                  {selectedMovement.products?.unit || ''}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Reference</p>
                <p className="mt-1 break-all text-sm font-bold text-slate-900">
                  {selectedMovement.reference_type || 'N/A'}
                  {selectedMovement.reference_id
                    ? ` • ${selectedMovement.reference_id}`
                    : ''}
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

      {selectedOutOfStock && (
        <Modal title="Out of Stock Product" onClose={() => setSelectedOutOfStock(null)}>
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
                  {Number(selectedOutOfStock.stock_quantity) || 0}{' '}
                  {selectedOutOfStock.unit || ''}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Minimum Stock</p>
                <p className="mt-1 text-lg font-extrabold text-slate-900">
                  {Number(selectedOutOfStock.min_stock) || 0}{' '}
                  {selectedOutOfStock.unit || ''}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
