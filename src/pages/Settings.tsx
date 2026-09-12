import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Settings as SettingsType } from '@/lib/supabase';
import { Card, Input, Button } from '@/components/ui';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [form, setForm] = useState<Partial<SettingsType>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setSettings(data as SettingsType);
        setForm(data as SettingsType);
      }
    });
  }, []);

  async function save() {
    if (!settings) return;
    await supabase.from('settings').update({ ...form, updated_at: new Date().toISOString() }).eq('id', settings.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your shop details</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-slate-900">Shop Information</h3>
        </div>
        <Input label="Shop Name" value={form.shop_name || ''} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
        <Input label="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <Input label="GSTIN" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
        <Input label="Logo URL" value={form.logo_url || '/vaishnavi-marble-logo.svg'} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-slate-900">Invoice Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Invoice Prefix" value={form.invoice_prefix || ''} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} />
          <Input label="Invoice Counter" type="number" value={form.invoice_counter ?? ''} onChange={(e) => setForm({ ...form, invoice_counter: Number(e.target.value) })} />
          <Input label="Purchase Prefix" value={form.purchase_prefix || ''} onChange={(e) => setForm({ ...form, purchase_prefix: e.target.value })} />
          <Input label="Purchase Counter" type="number" value={form.purchase_counter ?? ''} onChange={(e) => setForm({ ...form, purchase_counter: Number(e.target.value) })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Default GST %" type="number" value={form.default_gst_percent ?? ''} onChange={(e) => setForm({ ...form, default_gst_percent: Number(e.target.value) })} />
          <Input label="Currency Symbol" value={form.currency_symbol || ''} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} size="lg">
          {saved ? <><Check className="w-5 h-5 inline mr-1" />Saved!</> : <><Save className="w-5 h-5 inline mr-1" />Save Settings</>}
        </Button>
      </div>
    </div>
  );
}
