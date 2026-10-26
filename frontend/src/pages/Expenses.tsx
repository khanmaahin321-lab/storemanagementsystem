import { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, Search, Trash2, Pencil, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Expense } from '@/lib/supabase';
import { Card, Modal, Input, Select, Textarea, Button, Badge, EmptyState, StatCard } from '@/components/ui';
import { formatCurrency, formatDate, todayISO } from '@/lib/utils';

const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Water',
  'Transport',
  'Salary',
  'Maintenance',
  'Marketing',
  'Office Supplies',
  'Bank Charges',
  'Miscellaneous',
];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Partial<Expense>>({
    category: 'Miscellaneous',
    payment_method: 'cash',
    expense_date: todayISO(),
  });

  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
    if (search) {
      query = query.or(`description.ilike.%${search}%,category.ilike.%${search}%`);
    }
    if (filterCategory) {
      query = query.eq('category', filterCategory);
    }
    const { data } = await query;
    setExpenses((data || []) as Expense[]);

    const today = todayISO();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [todayRes, monthRes] = await Promise.all([
      supabase.from('expenses').select('amount').eq('expense_date', today),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart),
    ]);

    setTodayTotal((todayRes.data || []).reduce((s, r) => s + Number(r.amount), 0));
    setMonthTotal((monthRes.data || []).reduce((s, r) => s + Number(r.amount), 0));
    setLoading(false);
  }, [search, filterCategory]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ category: 'Miscellaneous', payment_method: 'cash', expense_date: todayISO() });
    setModalOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm(e);
    setModalOpen(true);
  }

  async function save() {
    if (!form.category || !form.amount) return;
    if (editing) {
      await supabase.from('expenses').update(form).eq('id', editing.id);
    } else {
      await supabase.from('expenses').insert(form);
    }
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track daily business expenses</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 inline mr-1" />Add Expense</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Today's Expenses" value={formatCurrency(todayTotal)} icon={<Wallet className="w-6 h-6" />} color="bg-red-500" />
        <StatCard label="This Month" value={formatCurrency(monthTotal)} icon={<Receipt className="w-6 h-6" />} color="bg-amber-500" />
        <StatCard label="Total Entries" value={String(expenses.length)} icon={<Receipt className="w-6 h-6" />} color="bg-blue-500" />
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : expenses.length === 0 ? (
          <EmptyState icon={<Receipt className="w-8 h-8" />} title="No expenses found" action={<Button onClick={openAdd}><Plus className="w-4 h-4 inline mr-1" />Add Expense</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Payment</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3"><Badge color="amber">{e.category}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{e.description || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{e.payment_method}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-amber-600 p-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(e.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Expense' : 'Add Expense'} size="md">
        <div className="space-y-4">
          <Select label="Category" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Amount *" type="number" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date" type="date" value={form.expense_date || todayISO()} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            <Select label="Payment Method" value={form.payment_method || 'cash'} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
            </Select>
          </div>
          <Textarea label="Notes" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Update' : 'Add'} Expense</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
