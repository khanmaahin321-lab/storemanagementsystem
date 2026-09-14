/*
# Add Sales Returns, Purchase Returns, and Physical Stock Check tables

1. New Tables
- `sales_returns` — header for customer return transactions (links to original sale)
  - id, return_number, sale_id, customer_id, return_date, total_amount, notes, created_at
- `sales_return_items` — line items for each returned product
  - id, return_id, product_id, sale_item_id, quantity, rate, total, reason, created_at
- `purchase_returns` — header for supplier return transactions (links to original purchase)
  - id, return_number, purchase_id, supplier_id, return_date, total_amount, notes, created_at
- `purchase_return_items` — line items for each returned product
  - id, return_id, product_id, purchase_item_id, quantity, rate, total, reason, created_at
- `physical_stock_checks` — header for stock take sessions
  - id, check_date, notes, status (draft/completed), created_at
- `physical_stock_check_items` — per-product system vs physical count comparison
  - id, check_id, product_id, system_stock, physical_stock, difference, reason, applied, created_at

2. Stock Movement Types
- New movement types supported: 'sales_return', 'purchase_return'
- These are stored as strings in stock_movements.movement_type (text column, no enum constraint)

3. Security
- All tables have RLS enabled with full anon+authenticated CRUD (single-tenant no-auth app)
*/

-- Sales Returns
CREATE TABLE IF NOT EXISTS sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_sales_returns" ON sales_returns;
CREATE POLICY "anon_select_sales_returns" ON sales_returns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_sales_returns" ON sales_returns FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_sales_returns" ON sales_returns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_sales_returns" ON sales_returns FOR DELETE TO anon, authenticated USING (true);

-- Sales Return Items
CREATE TABLE IF NOT EXISTS sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES sale_items(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_sri" ON sales_return_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_sri" ON sales_return_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_sri" ON sales_return_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_sri" ON sales_return_items FOR DELETE TO anon, authenticated USING (true);

-- Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL,
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_pr" ON purchase_returns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_pr" ON purchase_returns FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_pr" ON purchase_returns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_pr" ON purchase_returns FOR DELETE TO anon, authenticated USING (true);

-- Purchase Return Items
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_item_id uuid REFERENCES purchase_items(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_pri" ON purchase_return_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_pri" ON purchase_return_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_pri" ON purchase_return_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_pri" ON purchase_return_items FOR DELETE TO anon, authenticated USING (true);

-- Physical Stock Checks
CREATE TABLE IF NOT EXISTS physical_stock_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE physical_stock_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_psc" ON physical_stock_checks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_psc" ON physical_stock_checks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_psc" ON physical_stock_checks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_psc" ON physical_stock_checks FOR DELETE TO anon, authenticated USING (true);

-- Physical Stock Check Items
CREATE TABLE IF NOT EXISTS physical_stock_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES physical_stock_checks(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  system_stock numeric NOT NULL DEFAULT 0,
  physical_stock numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  reason text,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE physical_stock_check_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_psci" ON physical_stock_check_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_psci" ON physical_stock_check_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_psci" ON physical_stock_check_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_psci" ON physical_stock_check_items FOR DELETE TO anon, authenticated USING (true);

-- Add return counters to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sales_return_prefix text NOT NULL DEFAULT 'SR';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sales_return_counter integer NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS purchase_return_prefix text NOT NULL DEFAULT 'PR';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS purchase_return_counter integer NOT NULL DEFAULT 1;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale_id ON sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_id ON purchase_returns(purchase_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_physical_stock_check_items_check_id ON physical_stock_check_items(check_id);
