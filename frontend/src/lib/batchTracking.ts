// Batch & Serial Number Tracking
// For products with expiry dates, lot numbers, or serialization

import { supabase } from './supabase';

export interface Batch {
  id: string;
  productId: string;
  batchNumber: string;
  serialNumbers?: string[]; // For serialized items
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  currentQuantity: number;
  cost: number;
  supplier: string;
  status: 'active' | 'expired' | 'recalled';
  notes: string | null;
  createdAt: string;
}

export interface SerialItem {
  id: string;
  batchId: string;
  serialNumber: string;
  status: 'available' | 'sold' | 'damaged' | 'returned';
  soldDate?: string;
  soldTo?: string;
}

// Create a new batch
export async function createBatch(
  productId: string,
  batchNumber: string,
  manufacturingDate: string,
  expiryDate: string,
  quantity: number,
  cost: number,
  supplier: string,
): Promise<Batch> {
  const { data } = await supabase
    .from('batches')
    .insert({
      product_id: productId,
      batch_number: batchNumber,
      manufacturing_date: manufacturingDate,
      expiry_date: expiryDate,
      quantity,
      current_quantity: quantity,
      cost,
      supplier,
      status: 'active',
    })
    .select('*')
    .single();

  return data;
}

// Add serial numbers to batch
export async function addSerialNumbers(
  batchId: string,
  serialNumbers: string[],
): Promise<SerialItem[]> {
  const items = serialNumbers.map(sn => ({
    batch_id: batchId,
    serial_number: sn,
    status: 'available',
  }));

  const { data } = await supabase.from('serial_items').insert(items).select('*');
  return data || [];
}

// Get batches expiring soon (alert system)
export async function getExpiringBatches(daysBeforeExpiry: number = 30): Promise<Batch[]> {
  const expiryThreshold = new Date(Date.now() + daysBeforeExpiry * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data } = await supabase
    .from('batches')
    .select('*')
    .eq('status', 'active')
    .lte('expiry_date', expiryThreshold)
    .gt('current_quantity', 0);

  return data || [];
}

// FIFO (First In First Out) dispatch
export async function getFIFOBatch(productId: string, quantity: number): Promise<Batch | null> {
  const { data } = await supabase
    .from('batches')
    .select('*')
    .eq('product_id', productId)
    .eq('status', 'active')
    .gt('current_quantity', 0)
    .order('manufacturing_date', { ascending: true })
    .limit(1)
    .single();

  return data;
}

// Track serial item through lifecycle
export async function trackSerialItem(serialNumber: string): Promise<SerialItem | null> {
  const { data } = await supabase
    .from('serial_items')
    .select('*, batches(*), sales(invoice_number, sale_date), sales_items(*)')
    .eq('serial_number', serialNumber)
    .single();

  return data;
}

// Recall management
export async function recallBatch(batchId: string, reason: string): Promise<void> {
  // Mark batch as recalled
  await supabase.from('batches').update({ status: 'recalled' }).eq('id', batchId);

  // Create recall records for all sold items
  const { data: serialItems } = await supabase
    .from('serial_items')
    .select('*, sales_items(sale_id, sales(customer_id, phone, email))')
    .eq('batch_id', batchId)
    .eq('status', 'sold');

  if (serialItems) {
    for (const item of serialItems) {
      await supabase.from('recalls').insert({
        batch_id: batchId,
        serial_number: item.serial_number,
        sold_to: item.sales_items[0]?.sales.customer_id,
        reason,
        notification_sent: false,
      });
    }
  }
}
