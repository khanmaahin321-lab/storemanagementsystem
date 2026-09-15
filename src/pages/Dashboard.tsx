import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, StatCard } from '@/components/ui';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';

type DashboardData = {
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
  recentSales: {
    id: string;
    invoice_number: string;
    sale_date: string;
    total_amount: number;
    amount_paid: number;
  }[];
  lowStockProducts: { id: string; name: string; current_stock: number; minimum_stock: number; unit: string }[];
  outOfStockProducts: { id: string; name: string; unit: string }[];
  recentMovements: { id: string; movement_type: string; quantity: number; created_at: string; reference_number: string | null; reason: string | null; products: { name: string; unit: string } | null }[];
  stockInToday: number;
  stockOutToday: number;
  adjustmentsToday: number;
  totalStockValue: number;
  outOfStockCount: number;
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    const [salesToday, purchasesToday, products, customers, suppliers, recentSales, monthlySalesRes, lowStockRes, expensesToday, categories, allSales, allPurchases, allExpenses, stockMovementsToday, recentMovementsRes] =
      await Promise.all([
        supabase.from('sales').select('total_amount, amount_paid, payment_method').eq('sale_date', today),
        supabase.from('purchases').select('total_amount, amount_paid, payment_method').eq('purchase_date', today),
        supabase.from('products').select('id, name, current_stock, minimum_stock, unit, purchase_price, selling_price'),
        supabase.from('customers').select('outstanding_balance'),
        supabase.from('suppliers').select('outstanding_balance'),
        supabase
          .from('sales')
          .select('id, invoice_number, sale_date, total_amount, amount_paid')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('sales')
          .select('total_amount, sale_date')
          .gte('sale_date', startOfMonth),
        supabase
          .from('products')
          .select('id, name, current_stock, minimum_stock, unit')
          .filter('current_stock', 'lte', 0),
        supabase.from('expenses').select('amount, payment_method').eq('expense_date', today),
        supabase.from('categories').select('id'),
        supabase.from('sales').select('amount_paid, payment_method'),
        supabase.from('purchases').select('amount_paid, payment_method'),
        supabase.from('expenses').select('amount, payment_method'),
        supabase.from('stock_movements').select('movement_type, quantity').gte('created_at', today + 'T00:00:00'),
        supabase.from('stock_movements').select('id, movement_type, quantity, created_at, reference_number, reason, products(name, unit)').order('created_at', { ascending: false }).limit(10),
      ]);

    const todaySalesAmount = (salesToday.data || []).reduce((s, r) => s + Number(r.total_amount), 0);
    const todayPurchasesAmount = (purchasesToday.data || []).reduce((s, r) => s + Number(r.total_amount), 0);
    const todayExpensesAmount = (expensesToday.data || []).reduce((s, r) => s + Number(r.amount), 0);

    // Cash balance = cash received (sales cash) - cash paid (purchases cash + expenses cash)
    const cashReceived = (allSales.data || []).filter((r) => r.payment_method === 'cash').reduce((s, r) => s + Number(r.amount_paid), 0);
    const cashPaidPurchases = (allPurchases.data || []).filter((r) => r.payment_method === 'cash').reduce((s, r) => s + Number(r.amount_paid), 0);
    const cashPaidExpenses = (allExpenses.data || []).filter((r) => r.payment_method === 'cash').reduce((s, r) => s + Number(r.amount), 0);
    const cashBalance = cashReceived - cashPaidPurchases - cashPaidExpenses;

    // Profit estimate: sum of (selling_price - purchase_price) * quantity for today's sales
    const todaySaleItems = await supabase
      .from('sale_items')
      .select('product_id, quantity, rate')
      .in(
        'sale_id',
        (recentSales.data || []).map((s) => s.id),
      );

    let todayProfit = 0;
    const productMap = new Map<string, number>();
    (products.data || []).forEach((p) => productMap.set(p.id, Number(p.purchase_price)));
    (todaySaleItems.data || []).forEach((item) => {
      const cost = productMap.get(item.product_id) || 0;
      todayProfit += (Number(item.rate) - cost) * Number(item.quantity);
    });

    const customerDues = (customers.data || []).reduce((s, r) => s + Number(r.outstanding_balance), 0);
    const supplierDues = (suppliers.data || []).reduce((s, r) => s + Number(r.outstanding_balance), 0);
    const lowStockProducts = (products.data || []).filter(
      (p) => Number(p.current_stock) <= Number(p.minimum_stock) && Number(p.minimum_stock) > 0 && Number(p.current_stock) > 0,
    );
    const outOfStockProducts = (products.data || []).filter((p) => Number(p.current_stock) <= 0);
    const totalStockValue = (products.data || []).reduce((s, p) => s + Number(p.current_stock) * Number(p.purchase_price), 0);

    const todayMovements = (stockMovementsToday.data || []) as Array<{ movement_type: string; quantity: number }>;
    const stockInToday = todayMovements.filter((m) => m.movement_type === 'in' || m.movement_type === 'adjustment_in').reduce((s, m) => s + Number(m.quantity), 0);
    const stockOutToday = todayMovements.filter((m) => m.movement_type === 'out' || m.movement_type === 'adjustment_out').reduce((s, m) => s + Number(m.quantity), 0);
    const adjustmentsToday = todayMovements.filter((m) => m.movement_type === 'adjustment_in' || m.movement_type === 'adjustment_out').length;

    // Monthly sales aggregation
    const monthMap = new Map<string, number>();
    (monthlySalesRes.data || []).forEach((r) => {
      const d = new Date(r.sale_date);
      const key = `${getMonthName(d.getMonth())}`;
      monthMap.set(key, (monthMap.get(key) || 0) + Number(r.total_amount));
    });
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySales = monthOrder
      .filter((m) => monthMap.has(m))
      .map((m) => ({ month: m, amount: monthMap.get(m) || 0 }));

    setData({
      todaySales: todaySalesAmount,
      todayPurchases: todayPurchasesAmount,
      todayProfit,
      todayExpenses: todayExpensesAmount,
      cashBalance,
      totalProducts: (products.data || []).length,
      categoryCount: (categories.data || []).length,
      lowStockCount: lowStockProducts.length,
      customerDues,
      supplierDues,
      todayOrders: (salesToday.data || []).length,
      monthlySales,
      recentSales: (recentSales.data || []) as DashboardData['recentSales'],
      lowStockProducts: lowStockProducts.slice(0, 5),
      outOfStockProducts: outOfStockProducts.slice(0, 5).map(p => ({ id: p.id, name: p.name, unit: p.unit })),
      recentMovements: (recentMovementsRes.data || []) as DashboardData['recentMovements'],
      stockInToday,
      stockOutToday,
      adjustmentsToday,
      totalStockValue,
      outOfStockCount: outOfStockProducts.length,
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  const maxMonthly = Math.max(...(data?.monthlySales.map((m) => m.amount) || [1]), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your store performance</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(data!.todaySales)}
          icon={<IndianRupee className="w-6 h-6" />}
          color="bg-blue-500"
          trend={`${data!.todayOrders} orders today`}
        />
        <StatCard
          label="Today's Purchases"
          value={formatCurrency(data!.todayPurchases)}
          icon={<ShoppingCart className="w-6 h-6" />}
          color="bg-amber-500"
        />
        <StatCard
          label="Today's Profit"
          value={formatCurrency(data!.todayProfit)}
          icon={<TrendingUp className="w-6 h-6" />}
          color="bg-green-500"
        />
        <StatCard
          label="Total Products"
          value={String(data!.totalProducts)}
          icon={<Package className="w-6 h-6" />}
          color="bg-purple-500"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Cash Balance"
          value={formatCurrency(data!.cashBalance)}
          icon={<Wallet className="w-6 h-6" />}
          color="bg-emerald-500"
        />
        <StatCard
          label="Today's Expenses"
          value={formatCurrency(data!.todayExpenses)}
          icon={<TrendingDown className="w-6 h-6" />}
          color="bg-red-500"
        />
        <StatCard
          label="Categories"
          value={String(data!.categoryCount)}
          icon={<Package className="w-6 h-6" />}
          color="bg-cyan-500"
        />
        <StatCard
          label="Low Stock Items"
          value={String(data!.lowStockCount)}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="bg-orange-500"
        />
      </div>

      {/* Tertiary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Stock Value"
          value={formatCurrency(data!.totalStockValue)}
          icon={<Package className="w-6 h-6" />}
          color="bg-emerald-500"
        />
        <StatCard
          label="Stock In Today"
          value={String(data!.stockInToday)}
          icon={<TrendingUp className="w-6 h-6" />}
          color="bg-green-500"
        />
        <StatCard
          label="Stock Out Today"
          value={String(data!.stockOutToday)}
          icon={<TrendingDown className="w-6 h-6" />}
          color="bg-rose-500"
        />
        <StatCard
          label="Out of Stock"
          value={String(data!.outOfStockCount)}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="bg-red-500"
        />
      </div>

      {/* Quaternary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Customer Dues"
          value={formatCurrency(data!.customerDues)}
          icon={<Users className="w-6 h-6" />}
          color="bg-orange-500"
        />
        <StatCard
          label="Supplier Dues"
          value={formatCurrency(data!.supplierDues)}
          icon={<Truck className="w-6 h-6" />}
          color="bg-indigo-500"
        />
        <StatCard
          label="Today's Orders"
          value={String(data!.todayOrders)}
          icon={<Receipt className="w-6 h-6" />}
          color="bg-teal-500"
        />
        <StatCard
          label="Stock Adjustments Today"
          value={String(data!.adjustmentsToday)}
          icon={<Package className="w-6 h-6" />}
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Chart */}
        <Card className="p-5 fade-in-up">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Monthly Sales (This Year)</h3>
          {data!.monthlySales.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No sales data yet</p>
          ) : (
            <div className="space-y-2">
              {data!.monthlySales.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 w-8">{m.month}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-600 h-full rounded-full flex items-center justify-end pr-2 bar-grow"
                      style={{ width: `${(m.amount / maxMonthly) * 100}%` }}
                    >
                      <span className="text-xs text-white font-medium">{formatCurrency(m.amount).replace('₹', '')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Sales */}
        <Card className="p-5 fade-in-up">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Sales</h3>
          {data!.recentSales.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-2">
              {data!.recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{sale.invoice_number}</p>
                    <p className="text-xs text-slate-400">{formatDate(sale.sale_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(sale.total_amount)}</p>
                    {sale.amount_paid < sale.total_amount && (
                      <p className="text-xs text-red-500">Due: {formatCurrency(sale.total_amount - sale.amount_paid)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Low Stock Alert */}
      {data!.lowStockProducts.length > 0 && (
        <Card className="p-5 fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900">Low Stock Alert</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data!.lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-amber-600">
                    Stock: {p.current_stock} {p.unit} (Min: {p.minimum_stock} {p.unit})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Out of Stock Alert */}
      {data!.outOfStockProducts.length > 0 && (
        <Card className="p-5 fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-slate-900">Out of Stock Alert</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data!.outOfStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-red-600">Stock: 0 {p.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Stock Movements */}
      {data!.recentMovements.length > 0 && (
        <Card className="p-5 fade-in-up">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Stock Movements</h3>
          <div className="space-y-2">
            {data!.recentMovements.map((m) => {
              const isIn = m.movement_type === 'in' || m.movement_type === 'adjustment_in' || m.movement_type === 'sales_return' || m.movement_type === 'opening';
              return (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIn ? 'bg-green-100' : 'bg-red-100'}`}>
                      {isIn ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.products?.name || '-'}</p>
                      <p className="text-xs text-slate-400">{formatDate(m.created_at)} - {m.reference_number || m.movement_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isIn ? 'text-green-600' : 'text-red-500'}`}>
                      {isIn ? '+' : '-'}{m.quantity} {m.products?.unit || ''}
                    </p>
                    <p className="text-xs text-slate-400">{m.reason || m.movement_type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
