import { supabase } from './supabase';
import { calculateCurrentStock, calculateStockValue, calculateProfitForDateRange } from './stockCalculations';

/**
 * Report generators for all stock and inventory reports
 * All data is database-driven with no hardcoded values
 */

// Report data types
export interface CurrentStockReportItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  openingStock: number;
  currentStock: number;
  minimumStock: number;
  purchasePrice: number;
  sellingPrice: number;
  stockValue: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface StockValuationReportItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  unit: string;
  purchasePrice: number;
  stockValue: number;
}

export interface StockInReportItem {
  date: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  totalAmount: number;
  supplierName: string;
  invoiceNumber: string;
}

export interface StockOutReportItem {
  date: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  sellingPrice: number;
  totalAmount: number;
  customerName: string;
  invoiceNumber: string;
}

export interface StockAdjustmentReportItem {
  date: string;
  productName: string;
  sku: string;
  type: 'add' | 'remove';
  quantity: number;
  unit: string;
  reason: string;
  userName: string;
  notes: string;
}

export interface StockLedgerReportItem {
  date: string;
  transactionType: string;
  referenceNumber: string;
  quantityIn: number;
  quantityOut: number;
  balance: number;
  rate: number;
  value: number;
  party: string;
  user: string;
  notes: string;
}

export interface LowStockReportItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  purchasePrice: number;
  stockValue: number;
  variance: number;
}

export interface OutOfStockReportItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  purchasePrice: string;
}

export interface PurchaseReturnReportItem {
  date: string;
  returnNumber: string;
  supplierName: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  reason: string;
}

export interface SalesReturnReportItem {
  date: string;
  returnNumber: string;
  customerName: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  reason: string;
}

/**
 * Generate Current Stock Report
 * Shows all products with their stock levels and status
 */
export async function generateCurrentStockReport(
  categoryId?: string
): Promise<CurrentStockReportItem[]> {
  try {
    let query = supabase
      .from('products')
      .select('id, name, sku, unit, opening_stock, current_stock, minimum_stock, purchase_price, selling_price, categories(name)')
      .eq('is_active', true);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: products, error } = await query.order('name');

    if (error) throw error;

    const report: CurrentStockReportItem[] = (products || []).map((p) => {
      let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (p.current_stock <= 0) {
        status = 'out_of_stock';
      } else if (p.current_stock <= p.minimum_stock && p.minimum_stock > 0) {
        status = 'low_stock';
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.categories?.name || '-',
        unit: p.unit,
        openingStock: p.opening_stock,
        currentStock: p.current_stock,
        minimumStock: p.minimum_stock,
        purchasePrice: p.purchase_price,
        sellingPrice: p.selling_price,
        stockValue: p.current_stock * p.purchase_price,
        status,
      };
    });

    return report;
  } catch (error) {
    console.error('Error generating current stock report:', error);
    throw error;
  }
}

/**
 * Generate Stock Valuation Report
 * Shows inventory value by product and category
 */
export async function generateStockValuationReport(
  categoryId?: string
): Promise<{ items: StockValuationReportItem[]; totalValue: number; categoryBreakdown: any }> {
  try {
    let query = supabase
      .from('products')
      .select('id, name, sku, unit, current_stock, purchase_price, category_id, categories(name)')
      .eq('is_active', true);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: products, error } = await query.order('name');

    if (error) throw error;

    const items: StockValuationReportItem[] = (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.categories?.name || '-',
      currentStock: p.current_stock,
      unit: p.unit,
      purchasePrice: p.purchase_price,
      stockValue: p.current_stock * p.purchase_price,
    }));

    // Calculate totals
    const totalValue = items.reduce((sum, item) => sum + item.stockValue, 0);

    // Category breakdown
    const categoryBreakdown: any = {};
    items.forEach((item) => {
      if (!categoryBreakdown[item.category]) {
        categoryBreakdown[item.category] = { count: 0, value: 0 };
      }
      categoryBreakdown[item.category].count += 1;
      categoryBreakdown[item.category].value += item.stockValue;
    });

    return { items, totalValue, categoryBreakdown };
  } catch (error) {
    console.error('Error generating stock valuation report:', error);
    throw error;
  }
}

/**
 * Generate Stock In Report (Purchases)
 * Shows all stock received from suppliers by date range
 */
export async function generateStockInReport(
  startDate: string,
  endDate: string,
  productId?: string
): Promise<StockInReportItem[]> {
  try {
    let query = supabase
      .from('stock_movements')
      .select('*, products(name, sku, unit), suppliers(name)')
      .in('movement_type', ['in', 'stock_in'])
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data: movements, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Get purchase items and products for pricing
    const { data: products } = await supabase
      .from('products')
      .select('id, purchase_price');

    const productMap = new Map((products || []).map((p) => [p.id, p.purchase_price]));

    const report: StockInReportItem[] = (movements || []).map((m) => ({
      date: m.created_at.split('T')[0],
      productName: m.products?.name || '-',
      sku: m.products?.sku || '-',
      quantity: m.quantity,
      unit: m.products?.unit || '-',
      purchasePrice: m.unit_cost || productMap.get(m.product_id) || 0,
      totalAmount: m.quantity * (m.unit_cost || productMap.get(m.product_id) || 0),
      supplierName: m.suppliers?.name || '-',
      invoiceNumber: m.reference_number || '-',
    }));

    return report;
  } catch (error) {
    console.error('Error generating stock in report:', error);
    throw error;
  }
}

/**
 * Generate Stock Out Report (Sales)
 * Shows all stock sold to customers by date range
 */
export async function generateStockOutReport(
  startDate: string,
  endDate: string,
  productId?: string
): Promise<StockOutReportItem[]> {
  try {
    let query = supabase
      .from('stock_movements')
      .select('*, products(name, sku, unit), customers(name)')
      .in('movement_type', ['out', 'stock_out'])
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data: movements, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const report: StockOutReportItem[] = (movements || []).map((m) => ({
      date: m.created_at.split('T')[0],
      productName: m.products?.name || '-',
      sku: m.products?.sku || '-',
      quantity: m.quantity,
      unit: m.products?.unit || '-',
      sellingPrice: m.unit_cost || 0,
      totalAmount: m.quantity * (m.unit_cost || 0),
      customerName: m.customers?.name || '-',
      invoiceNumber: m.reference_number || '-',
    }));

    return report;
  } catch (error) {
    console.error('Error generating stock out report:', error);
    throw error;
  }
}

/**
 * Generate Stock Adjustment Report
 * Shows all manual stock adjustments
 */
export async function generateStockAdjustmentReport(
  startDate: string,
  endDate: string,
  productId?: string
): Promise<StockAdjustmentReportItem[]> {
  try {
    let query = supabase
      .from('stock_movements')
      .select('*, products(name, sku, unit)')
      .in('movement_type', ['adjustment_in', 'adjustment_out'])
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data: movements, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const report: StockAdjustmentReportItem[] = (movements || []).map((m) => ({
      date: m.created_at.split('T')[0],
      productName: m.products?.name || '-',
      sku: m.products?.sku || '-',
      type: m.movement_type === 'adjustment_in' ? 'add' : 'remove',
      quantity: m.quantity,
      unit: m.products?.unit || '-',
      reason: m.reason || '-',
      userName: m.user_name || 'admin',
      notes: m.notes || '-',
    }));

    return report;
  } catch (error) {
    console.error('Error generating stock adjustment report:', error);
    throw error;
  }
}

/**
 * Generate Stock Ledger Report for a specific product
 * Shows all transactions with running balance
 */
export async function generateStockLedgerReport(productId: string): Promise<StockLedgerReportItem[]> {
  try {
    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('*, suppliers(name), customers(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const report: StockLedgerReportItem[] = (movements || []).map((m) => {
      const isIn =
        m.movement_type === 'in' ||
        m.movement_type === 'stock_in' ||
        m.movement_type === 'adjustment_in' ||
        m.movement_type === 'sales_return' ||
        m.movement_type === 'opening';

      return {
        date: m.created_at.split('T')[0],
        transactionType:
          m.movement_type === 'opening'
            ? 'Opening Stock'
            : m.movement_type === 'in' || m.movement_type === 'stock_in'
              ? 'Stock In'
              : m.movement_type === 'out' || m.movement_type === 'stock_out'
                ? 'Stock Out'
                : m.movement_type === 'sales_return'
                  ? 'Sales Return'
                  : m.movement_type === 'purchase_return'
                    ? 'Purchase Return'
                    : m.movement_type === 'adjustment_in'
                      ? 'Adjustment (+)'
                      : 'Adjustment (-)',
        referenceNumber: m.reference_number || '-',
        quantityIn: isIn ? m.quantity : 0,
        quantityOut: !isIn ? m.quantity : 0,
        balance: m.balance_after || 0,
        rate: m.unit_cost || 0,
        value: (m.balance_after || 0) * (m.unit_cost || 0),
        party: m.suppliers?.name || m.customers?.name || '-',
        user: m.user_name || 'admin',
        notes: m.notes || m.reason || '-',
      };
    });

    return report;
  } catch (error) {
    console.error('Error generating stock ledger report:', error);
    throw error;
  }
}

/**
 * Generate Low Stock Report
 * Shows products below minimum stock level but not out of stock
 */
export async function generateLowStockReport(): Promise<LowStockReportItem[]> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, unit, current_stock, minimum_stock, purchase_price, categories(name)')
      .eq('is_active', true)
      .filter('current_stock', 'lte', 'minimum_stock')
      .filter('current_stock', 'gt', 0)
      .order('current_stock', { ascending: true });

    if (error) throw error;

    const report: LowStockReportItem[] = (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.categories?.name || '-',
      currentStock: p.current_stock,
      minimumStock: p.minimum_stock,
      unit: p.unit,
      purchasePrice: p.purchase_price,
      stockValue: p.current_stock * p.purchase_price,
      variance: p.minimum_stock - p.current_stock,
    }));

    return report;
  } catch (error) {
    console.error('Error generating low stock report:', error);
    throw error;
  }
}

/**
 * Generate Out of Stock Report
 * Shows all products with zero stock
 */
export async function generateOutOfStockReport(): Promise<OutOfStockReportItem[]> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, unit, purchase_price, categories(name)')
      .eq('is_active', true)
      .eq('current_stock', 0)
      .order('name');

    if (error) throw error;

    const report: OutOfStockReportItem[] = (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.categories?.name || '-',
      unit: p.unit,
      purchasePrice: p.purchase_price,
    }));

    return report;
  } catch (error) {
    console.error('Error generating out of stock report:', error);
    throw error;
  }
}

/**
 * Generate Purchase Return Report
 */
export async function generatePurchaseReturnReport(
  startDate: string,
  endDate: string
): Promise<PurchaseReturnReportItem[]> {
  try {
    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('*, products(name, sku, unit), suppliers(name)')
      .eq('movement_type', 'purchase_return')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const report: PurchaseReturnReportItem[] = (movements || []).map((m) => ({
      date: m.created_at.split('T')[0],
      returnNumber: m.reference_number || '-',
      supplierName: m.suppliers?.name || '-',
      productName: m.products?.name || '-',
      quantity: m.quantity,
      unit: m.products?.unit || '-',
      rate: m.unit_cost || 0,
      totalAmount: m.quantity * (m.unit_cost || 0),
      reason: m.reason || '-',
    }));

    return report;
  } catch (error) {
    console.error('Error generating purchase return report:', error);
    throw error;
  }
}

/**
 * Generate Sales Return Report
 */
export async function generateSalesReturnReport(
  startDate: string,
  endDate: string
): Promise<SalesReturnReportItem[]> {
  try {
    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('*, products(name, sku, unit), customers(name)')
      .eq('movement_type', 'sales_return')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const report: SalesReturnReportItem[] = (movements || []).map((m) => ({
      date: m.created_at.split('T')[0],
      returnNumber: m.reference_number || '-',
      customerName: m.customers?.name || '-',
      productName: m.products?.name || '-',
      quantity: m.quantity,
      unit: m.products?.unit || '-',
      rate: m.unit_cost || 0,
      totalAmount: m.quantity * (m.unit_cost || 0),
      reason: m.reason || '-',
    }));

    return report;
  } catch (error) {
    console.error('Error generating sales return report:', error);
    throw error;
  }
}

/**
 * Export report data to CSV format
 */
export function exportToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Export report data to JSON format
 */
export function exportToJSON(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
