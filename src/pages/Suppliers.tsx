import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Search, Pencil, Trash2, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Supplier } from '@/lib/supabase';
import { Card, Modal, Input, Textarea, Button, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>({});

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    if (search) {
      query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,gstin.ilike.%${search}%`);
    }
    const { data } = await query;
    setSuppliers(data as Supplier[]);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({});
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm(s);
    setModalOpen(true);
  }

  async function save() {
    if (!form.name) return;
    if (editing) {
      await supabase.from('suppliers').update(form).eq('id', editing.id);
    } else {
      await supabase.from('suppliers').insert(form);
    }
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this supplier?')) return;
    await supabase.from('suppliers').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage supplier accounts</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 inline mr-1" />Add Supplier</Button>
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
      ) : suppliers.length === 0 ? (
        <Card><EmptyState icon={<Truck className="w-8 h-8" />} title="No suppliers found" action={<Button onClick={openAdd}><Plus className="w-4 h-4 inline mr-1" />Add Supplier</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{s.name}</h3>
                  {s.contact_person && <p className="text-xs text-slate-400">{s.contact_person}</p>}
                  {s.mobile && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />{s.mobile}
                    </p>
                  )}
                  {s.address && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />{s.address}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="text-slate-400 hover:text-amber-600 p-1">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(s.id)} className="text-slate-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">Outstanding Balance</p>
                <p className={`text-sm font-bold ${s.outstanding_balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {formatCurrency(s.outstanding_balance)}
                </p>
              </div>
              {s.gstin && <Badge color="blue">{s.gstin}</Badge>}
              <p className="text-xs text-slate-400 mt-2">Since {formatDate(s.created_at)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Input label="Name *" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <Input label="Contact Person" value={form.contact_person || ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <Input label="Mobile" value={form.mobile || ''} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input label="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="GSTIN" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          <div className="sm:col-span-2"><Input label="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <Input label="City" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="State" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input label="Pincode" value={form.pincode || ''} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
          <div className="sm:col-span-2"><Textarea label="Notes" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Add'} Supplier</Button>
        </div>
      </Modal>
    </div>
  );
}
