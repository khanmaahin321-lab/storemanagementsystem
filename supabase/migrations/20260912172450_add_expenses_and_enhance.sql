/*
# Add Expenses Table and Enhance Sales

## Overview
Adds a daily expenses tracking table and enhances the sales table with a `payment_status` column for better tracking.

## New Tables

### expenses
- Tracks daily business expenses (rent, electricity, transport, salaries, misc)
- Fields: category, description, amount, payment_method, date
- Enables cash balance calculation (cash received - cash paid)

## Modified Tables

### sales
- Added `payment_status` column (paid, partial, unpaid) for better filtering

## Security
- RLS enabled, single-tenant (anon + authenticated access)
*/

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_expenses" ON expenses;
CREATE POLICY "anon_all_expenses" ON expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Add payment_status to sales if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'payment_status') THEN
    ALTER TABLE sales ADD COLUMN payment_status text NOT NULL DEFAULT 'completed';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
