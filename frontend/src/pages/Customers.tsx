import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Pencil, Trash2, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/lib/supabase';
import { Card, Modal, Input, Textarea, Button, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>({});

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (search) {
      query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,gstin.ilike.%${search}%`);
    }
    const { data } = await query;
    setCustomers(data as Customer[]);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ credit_limit: 0 });
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm(c);
    setModalOpen(true);
  }

  async function save() {
    if (!form.name) return;
    if (editing) {
      await supabase.from('customers').update(form).eq('id', editing.id);
    } else {
      await supabase.from('customers').insert(form);
    }
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this customer?')) return;
    await supabase.from('customers').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage customer accounts</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 inline mr-1" />Add Customer</Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            placeholder="Search by name, mobile, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </Card>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
      ) : customers.length === 0 ? (
        <Card><EmptyState icon={<Users className="w-8 h-8" />} title="No customers found" action={<Button onClick={openAdd}><Plus className="w-4 h-4 inline mr-1" />Add Customer</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{c.name}</h3>
                  {c.mobile && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />{c.mobile}
                    </p>
                  )}
                  {c.address && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />{c.address}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-amber-600 p-1">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-400">Total Purchases</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(c.total_purchases)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Outstanding</p>
                  <p className={`text-sm font-bold ${c.outstanding_balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {formatCurrency(c.outstanding_balance)}
                  </p>
                </div>
              </div>
              {c.gstin && <Badge color="blue">{c.gstin}</Badge>}
              <p className="text-xs text-slate-400 mt-2">Since {formatDate(c.created_at)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'} size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Input label="Name *" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <Input label="Mobile" value={form.mobile || ''} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input label="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="sm:col-span-2"><Input label="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <Input label="City" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="State" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input label="Pincode" value={form.pincode || ''} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
          <Input label="GSTIN" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          <Input label="Credit Limit" type="number" value={form.credit_limit ?? ''} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} />
          <div className="sm:col-span-2"><Textarea label="Notes" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Add'} Customer</Button>
        </div>
      </Modal>
    </div>
  );
}
