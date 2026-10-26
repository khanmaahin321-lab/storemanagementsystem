import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  finish: string | null;
  size: string | null;
  thickness: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  wholesale_price: number;
  gst_percent: number;
  opening_stock: number;
  current_stock: number;
  minimum_stock: number;
  supplier_id: string | null;
  image_url: string | null;
  barcode: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  credit_limit: number;
  outstanding_balance: number;
  total_purchases: number;
  notes: string | null;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  outstanding_balance: number;
  notes: string | null;
  created_at: string;
};

export type Purchase = {
  id: string;
  invoice_number: string;
  supplier_id: string | null;
  purchase_date: string;
  subtotal: number;
  gst_amount: number;
  transport_cost: number;
  other_expenses: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  rate: number;
  gst_percent: number;
  gst_amount: number;
  total: number;
  created_at: string;
};

export type Sale = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  sale_date: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  delivery_charge: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  payment_method: string;
  status: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string;
  expense_date: string;
  notes: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  rate: number;
  gst_percent: number;
  gst_amount: number;
  total: number;
  created_at: string;
};

export type StockMovement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  reason: string | null;
  user_name: string | null;
  supplier_id: string | null;
  customer_id: string | null;
  unit_cost: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  party_type: string;
  party_id: string;
  invoice_id: string | null;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
};

export type Settings = {
  id: string;
  shop_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  logo_url: string | null;
  invoice_prefix: string;
  invoice_counter: number;
  purchase_prefix: string;
  purchase_counter: number;
  default_gst_percent: number;
  currency_symbol: string;
  sales_return_prefix: string;
  sales_return_counter: number;
  purchase_return_prefix: string;
  purchase_return_counter: number;
  created_at: string;
  updated_at: string;
};

export type SalesReturn = {
  id: string;
  return_number: string;
  sale_id: string | null;
  customer_id: string | null;
  return_date: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
};

export type SalesReturnItem = {
  id: string;
  return_id: string;
  product_id: string;
  sale_item_id: string | null;
  quantity: number;
  rate: number;
  total: number;
  reason: string | null;
  created_at: string;
};

export type PurchaseReturn = {
  id: string;
  return_number: string;
  purchase_id: string | null;
  supplier_id: string | null;
  return_date: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
};

export type PurchaseReturnItem = {
  id: string;
  return_id: string;
  product_id: string;
  purchase_item_id: string | null;
  quantity: number;
  rate: number;
  total: number;
  reason: string | null;
  created_at: string;
};

export type PhysicalStockCheck = {
  id: string;
  check_date: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export type PhysicalStockCheckItem = {
  id: string;
  check_id: string;
  product_id: string;
  system_stock: number;
  physical_stock: number;
  difference: number;
  reason: string | null;
  applied: boolean;
  created_at: string;
};
