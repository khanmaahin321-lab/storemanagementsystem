// Multi-Warehouse Inventory Management
// Handles stock across multiple locations with transfer optimization

import { supabase } from './supabase';

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  maxCapacity: number;
  currentUtilization: number;
  isActive: boolean;
}

export interface StockLevel {
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQty: number;
  availableQty: number;
}

export interface WarehouseTransfer {
  id: string;
  fromWarehouse: string;
  toWarehouse: string;
  productId: string;
  quantity: number;
  status: 'pending' | 'in-transit' | 'received';
  shippingCost: number;
  estimatedDays: number;
  createdAt: string;
}

// Get all warehouses
export async function getWarehouses(): Promise<Warehouse[]> {
  const { data } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_active', true);
  return data || [];
}

// Get stock across all warehouses for a product
export async function getStockAcrossWarehouses(productId: string): Promise<StockLevel[]> {
  const { data } = await supabase
    .from('warehouse_stock')
    .select('*')
    .eq('product_id', productId);
  return data || [];
}

// Optimize stock distribution
export async function optimizeStockDistribution(
  productId: string,
  targetLevel: number,
): Promise<WarehouseTransfer[]> {
  const stocks = await getStockAcrossWarehouses(productId);
  const transfers: WarehouseTransfer[] = [];

  // Calculate imbalances
  const avgStock = stocks.reduce((s, st) => s + st.quantity, 0) / stocks.length;
  const surplus = stocks.filter(s => s.quantity > avgStock);
  const deficit = stocks.filter(s => s.quantity < avgStock && s.quantity < targetLevel);

  // Create transfers from surplus to deficit
  for (const deficitStock of deficit) {
    for (const surplusStock of surplus) {
      const transferQty = Math.min(
        surplusStock.quantity - avgStock,
        targetLevel - deficitStock.quantity,
      );
      if (transferQty > 0) {
        transfers.push({
          id: crypto.randomUUID(),
          fromWarehouse: surplusStock.warehouseId,
          toWarehouse: deficitStock.warehouseId,
          productId,
          quantity: transferQty,
          status: 'pending',
          shippingCost: calculateShippingCost(surplusStock.warehouseId, deficitStock.warehouseId, transferQty),
          estimatedDays: 2,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return transfers;
}

function calculateShippingCost(from: string, to: string, qty: number): number {
  // Simplified: base rate + per-unit cost
  return 500 + qty * 10;
}

// Transfer stock between warehouses
export async function transferStock(
  fromWarehouse: string,
  toWarehouse: string,
  productId: string,
  quantity: number,
): Promise<string> {
  const transferId = crypto.randomUUID();

  // Create transfer record
  await supabase.from('warehouse_transfers').insert({
    id: transferId,
    from_warehouse: fromWarehouse,
    to_warehouse: toWarehouse,
    product_id: productId,
    quantity,
    status: 'pending',
    shipping_cost: calculateShippingCost(fromWarehouse, toWarehouse, quantity),
    estimated_days: 2,
  });

  // Deduct from source
  await supabase.rpc('update_warehouse_stock', {
    p_warehouse_id: fromWarehouse,
    p_product_id: productId,
    p_qty_delta: -quantity,
  });

  return transferId;
}

// Complete transfer
export async function completeTransfer(transferId: string): Promise<void> {
  const { data: transfer } = await supabase
    .from('warehouse_transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (!transfer) return;

  // Add to destination
  await supabase.rpc('update_warehouse_stock', {
    p_warehouse_id: transfer.to_warehouse,
    p_product_id: transfer.product_id,
    p_qty_delta: transfer.quantity,
  });

  // Mark as received
  await supabase.from('warehouse_transfers').update({ status: 'received' }).eq('id', transferId);
}
