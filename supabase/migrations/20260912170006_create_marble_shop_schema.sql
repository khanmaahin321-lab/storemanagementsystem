/*
# Marble Shop Management System - Complete Database Schema

## Overview
Creates the full database schema for a Marble Shop Store Management System covering products,
inventory, customers, suppliers, purchases, sales/billing, payments, and settings.

## New Tables

### categories
- Product categories (Marble, Granite, Tiles, Sanitaryware, etc.)
- Hierarchical with parent_id for subcategories

### suppliers
- Supplier details: name, contact, address, GSTIN
- Outstanding balance tracking

### products
- Full product catalog with SKU, brand, color, finish, size, thickness
- Pricing: purchase price, selling price, wholesale price
- Stock tracking: opening stock, current stock, minimum stock
- GST percentage, supplier link, image URL

### customers
- Customer details: name, mobile, address, GSTIN
- Credit limit, outstanding balance tracking

### purchases
- Purchase invoices with supplier, products, quantities, rates
- Transport cost, other expenses, GST, total, payment, due

### purchase_items
- Line items for each purchase: product, quantity, rate, GST

### sales
- Sales invoices with customer, products, quantities, rates
- Discount, GST, delivery charge, advance, due
- Payment method tracking

### sale_items
- Line items for each sale: product, quantity, rate, GST

### stock_movements
- Audit log for all stock changes (purchase, sale, adjustment, damage, return)

### payments
- Customer and supplier payment records

### settings
- Shop configuration: name, address, GSTIN, phone, logo
- Invoice prefix, tax defaults

## Security
- RLS enabled on all tables
- Single-tenant app (no auth) → TO anon, authenticated with USING (true)
*/

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_categories" ON categories;
CREATE POLICY "anon_all_categories" ON categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  mobile text,
  email text,
  address text,
  city text,
  state text,
  pincode text,
  gstin text,
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_suppliers" ON suppliers;
CREATE POLICY "anon_all_suppliers" ON suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  brand text,
  model text,
  color text,
  finish text,
  size text,
  thickness text,
  unit text NOT NULL DEFAULT 'sq.ft',
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  wholesale_price numeric(12,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  opening_stock numeric(12,2) NOT NULL DEFAULT 0,
  current_stock numeric(12,2) NOT NULL DEFAULT 0,
  minimum_stock numeric(12,2) NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  image_url text,
  barcode text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_products" ON products;
CREATE POLICY "anon_all_products" ON products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text,
  email text,
  address text,
  city text,
  state text,
  pincode text,
  gstin text,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_purchases numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_customers" ON customers;
CREATE POLICY "anon_all_customers" ON customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  transport_cost numeric(12,2) NOT NULL DEFAULT 0,
  other_expenses numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  amount_due numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_purchases" ON purchases;
CREATE POLICY "anon_all_purchases" ON purchases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Purchase items table
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric(12,2) NOT NULL,
  rate numeric(12,2) NOT NULL,
  gst_percent numeric(5,2) NOT NULL DEFAULT 0,
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_purchase_items" ON purchase_items;
CREATE POLICY "anon_all_purchase_items" ON purchase_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  delivery_charge numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  amount_due numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_sales" ON sales;
CREATE POLICY "anon_all_sales" ON sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Sale items table
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric(12,2) NOT NULL,
  rate numeric(12,2) NOT NULL,
  gst_percent numeric(5,2) NOT NULL DEFAULT 0,
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_sale_items" ON sale_items;
CREATE POLICY "anon_all_sale_items" ON sale_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_stock_movements" ON stock_movements;
CREATE POLICY "anon_all_stock_movements" ON stock_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type text NOT NULL,
  party_id uuid NOT NULL,
  invoice_id uuid,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_payments" ON payments;
CREATE POLICY "anon_all_payments" ON payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL DEFAULT 'Vaishnav Marble Shop',
  address text,
  phone text,
  email text,
  gstin text,
  logo_url text,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  invoice_counter integer NOT NULL DEFAULT 1,
  purchase_prefix text NOT NULL DEFAULT 'PUR',
  purchase_counter integer NOT NULL DEFAULT 1,
  default_gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  currency_symbol text NOT NULL DEFAULT '₹',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_settings" ON settings;
CREATE POLICY "anon_all_settings" ON settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- Insert default settings
INSERT INTO settings (shop_name, address, phone, gstin)
SELECT 'Vaishnav Marble Shop', 'Main Road, City', '+91 98765 43210', '24ABCDE1234F1Z5'
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- Insert default categories
INSERT INTO categories (name, description)
SELECT 'Marble', 'Indian, Imported, White, Black, Beige, Slabs'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Marble');

INSERT INTO categories (name, description)
SELECT 'Granite', 'Black, White, Red, Green, Slabs'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Granite');

INSERT INTO categories (name, description)
SELECT 'Tiles', 'Floor, Wall, Bathroom, Kitchen, Outdoor, Elevation, Vitrified'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Tiles');

INSERT INTO categories (name, description)
SELECT 'Sanitaryware', 'Toilet, Wash Basin, Vanity, Accessories'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Sanitaryware');

INSERT INTO categories (name, description)
SELECT 'Bathroom Fittings', 'Faucet, Shower, Health Faucet, Floor Drain'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Bathroom Fittings');

INSERT INTO categories (name, description)
SELECT 'Kitchen', 'Sink, Faucet, Countertop, Accessories'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Kitchen');

INSERT INTO categories (name, description)
SELECT 'Accessories', 'Adhesive, Grout, Spacers, Clips, Other Materials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Accessories');
