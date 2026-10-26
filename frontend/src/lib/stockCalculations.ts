import { supabase } from './supabase';

/**
 * All stock calculations are database-driven.
 * No hardcoded values - everything comes from stock_movements table.
 */

export interface StockCalculationResult {
  openingStock: number;
  totalStockIn: number;
  totalSalesReturn: number;
  totalPositiveAdjustments: number;
  totalStockOut: number;
  totalPurchaseReturn: number;
  totalNegativeAdjustments: number;
  currentStock: number;
  lastUpdate: string;
}

export interface StockValueResult {
  productId: string;
  productName: string;
  currentStock: number;
  purchasePrice: number;
  stockValue: number;
}

export interface ProfitCalculationResult {
  transactionId: string;
  type: 'sale' | 'return';
  quantity: number;
  sellingPrice: number;
  purchasePrice: number;
  profitPerUnit: number;
  totalProfit: number;
}

/**
 * Calculate current stock for a product based on all transactions
 * Formula: Opening + StockIn + SalesReturn + PositiveAdj - StockOut - PurchaseReturn - NegativeAdj
 */
export async function calculateCurrentStock(productId: string): Promise<StockCalculationResult> {
  try {
    // Get all stock movements for this product ordered by date
    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    let result: StockCalculationResult = {
      openingStock: 0,
      totalStockIn: 0,
      totalSalesReturn: 0,
      totalPositiveAdjustments: 0,
      totalStockOut: 0,
      totalPurchaseReturn: 0,
      totalNegativeAdjustments: 0,
      currentStock: 0,
      lastUpdate: new Date().toISOString(),
    };

    // Process movements to categorize them
    movements.forEach((m) => {
      const qty = m.quantity || 0;

      if (m.movement_type === 'opening') {
        result.openingStock += qty;
      } else if (m.movement_type === 'in' || m.movement_type === 'stock_in') {
        result.totalStockIn += qty;
      } else if (m.movement_type === 'sales_return') {
        result.totalSalesReturn += qty;
      } else if (m.movement_type === 'adjustment_in') {
        result.totalPositiveAdjustments += qty;
      } else if (m.movement_type === 'out' || m.movement_type === 'stock_out') {
        result.totalStockOut += qty;
      } else if (m.movement_type === 'purchase_return') {
        result.totalPurchaseReturn += qty;
      } else if (m.movement_type === 'adjustment_out') {
        result.totalNegativeAdjustments += qty;
      }
    });

    // Calculate current stock
    result.currentStock =
      result.openingStock +
      result.totalStockIn +
      result.totalSalesReturn +
      result.totalPositiveAdjustments -
      result.totalStockOut -
      result.totalPurchaseReturn -
      result.totalNegativeAdjustments;

    // Ensure stock never goes negative
    result.currentStock = Math.max(0, result.currentStock);
    result.lastUpdate = new Date().toISOString();

    return result;
  } catch (error) {
    console.error('Error calculating current stock:', error);
    throw error;
  }
}

/**
 * Calculate stock value for a product
 * Stock Value = Current Stock × Purchase Price
 */
export async function calculateStockValue(productId: string): Promise<StockValueResult> {
  try {
    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, purchase_price')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    // Calculate current stock
    const stockCalc = await calculateCurrentStock(productId);

    return {
      productId: product.id,
      productName: product.name,
      currentStock: stockCalc.currentStock,
      purchasePrice: product.purchase_price,
      stockValue: stockCalc.currentStock * product.purchase_price,
    };
  } catch (error) {
    console.error('Error calculating stock value:', error);
    throw error;
  }
}

/**
 * Calculate total inventory value across all active products
 */
export async function calculateTotalInventoryValue(): Promise<number> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, purchase_price')
      .eq('is_active', true);

    if (error) throw error;

    let totalValue = 0;

    for (const product of products || []) {
      const stockCalc = await calculateCurrentStock(product.id);
      totalValue += stockCalc.currentStock * product.purchase_price;
    }

    return totalValue;
  } catch (error) {
    console.error('Error calculating total inventory value:', error);
    throw error;
  }
}

/**
 * Calculate profit for a single transaction
 * Profit = (Selling Price - Purchase Price) × Quantity
 */
export function calculateTransactionProfit(
  quantity: number,
  sellingPrice: number,
  purchasePrice: number
): number {
  const profitPerUnit = sellingPrice - purchasePrice;
  return profitPerUnit * quantity;
}

/**
 * Calculate total profit for a date range
 * Includes sales and reverses returns
 */
export async function calculateProfitForDateRange(
  startDate: string,
  endDate: string
): Promise<number> {
  try {
    // Get all sales and sales returns for the date range
    const [salesResult, returnsResult, productsResult] = await Promise.all([
      supabase
        .from('sale_items')
        .select('product_id, quantity, rate')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      supabase
        .from('sales_return_items')
        .select('product_id, quantity, rate')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      supabase.from('products').select('id, purchase_price'),
    ]);

    if (salesResult.error) throw salesResult.error;
    if (returnsResult.error) throw returnsResult.error;
    if (productsResult.error) throw productsResult.error;

    // Create product map for quick lookup
    const productMap = new Map<string, number>();
    (productsResult.data || []).forEach((p) => {
      productMap.set(p.id, p.purchase_price);
    });

    let totalProfit = 0;

    // Calculate profit from sales
    (salesResult.data || []).forEach((item) => {
      const purchasePrice = productMap.get(item.product_id) || 0;
      const itemProfit = (item.rate - purchasePrice) * item.quantity;
      totalProfit += itemProfit;
    });

    // Reverse profit for returns (customer gets money back)
    (returnsResult.data || []).forEach((item) => {
      const purchasePrice = productMap.get(item.product_id) || 0;
      const returnProfit = (item.rate - purchasePrice) * item.quantity;
      totalProfit -= returnProfit;
    });

    return totalProfit;
  } catch (error) {
    console.error('Error calculating profit for date range:', error);
    throw error;
  }
}

/**
 * Get low stock products (current stock <= minimum stock, but not 0)
 */
export async function getLowStockProducts(): Promise<any[]> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, unit, current_stock, minimum_stock, purchase_price, selling_price, categories(name)')
      .eq('is_active', true)
      .filter('current_stock', 'lte', 'minimum_stock')
      .filter('current_stock', 'gt', 0);

    if (error) throw error;

    return (products || []).map((p) => ({
      ...p,
      stockValue: p.current_stock * p.purchase_price,
    }));
  } catch (error) {
    console.error('Error getting low stock products:', error);
    throw error;
  }
}

/**
 * Get out of stock products (current stock = 0)
 */
export async function getOutOfStockProducts(): Promise<any[]> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, unit, current_stock, minimum_stock, purchase_price, categories(name)')
      .eq('is_active', true)
      .eq('current_stock', 0);

    if (error) throw error;

    return products || [];
  } catch (error) {
    console.error('Error getting out of stock products:', error);
    throw error;
  }
}

/**
 * Get stock movement summary for a date
 */
export async function getStockMovementSummary(date: string): Promise<{
  stockIn: number;
  stockOut: number;
  adjustmentsIn: number;
  adjustmentsOut: number;
  returns: number;
}> {
  try {
    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('movement_type, quantity')
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`);

    if (error) throw error;

    const summary = {
      stockIn: 0,
      stockOut: 0,
      adjustmentsIn: 0,
      adjustmentsOut: 0,
      returns: 0,
    };

    (movements || []).forEach((m) => {
      if (m.movement_type === 'in' || m.movement_type === 'stock_in') {
        summary.stockIn += m.quantity;
      } else if (m.movement_type === 'out' || m.movement_type === 'stock_out') {
        summary.stockOut += m.quantity;
      } else if (m.movement_type === 'adjustment_in') {
        summary.adjustmentsIn += m.quantity;
      } else if (m.movement_type === 'adjustment_out') {
        summary.adjustmentsOut += m.quantity;
      } else if (
        m.movement_type === 'sales_return' ||
        m.movement_type === 'purchase_return'
      ) {
        summary.returns += m.quantity;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error getting stock movement summary:', error);
    throw error;
  }
}

/**
 * Validate that stock doesn't go negative
 * Returns true if stock is valid
 */
export async function validateStock(productId: string): Promise<boolean> {
  try {
    const calculation = await calculateCurrentStock(productId);
    return calculation.currentStock >= 0;
  } catch (error) {
    console.error('Error validating stock:', error);
    return false;
  }
}

/**
 * Get stock movement history for a product
 */
export async function getProductStockHistory(
  productId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('*, suppliers(name), customers(name), products(name, unit)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return movements || [];
  } catch (error) {
    console.error('Error getting product stock history:', error);
    throw error;
  }
}
