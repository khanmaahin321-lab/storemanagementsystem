import { useState, useEffect } from 'react';
import { Package, AlertTriangle, Barcode, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getExpiringBatches } from '@/lib/batchTracking';
import { Card, Badge, Modal, Input, Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function BatchTracking() {
  const [batches, setBatches] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBatchModal, setNewBatchModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [serialsModal, setSerialModal] = useState(false);
  const [formData, setFormData] = useState({
    batchNumber: '',
    mfgDate: '',
    expiryDate: '',
    quantity: 0,
  });

  useEffect(() => {
    loadBatches();
  }, []);

  async function loadBatches() {
    const { data } = await supabase.from('batches').select('*').eq('status', 'active').order('expiry_date');
    setBatches(data || []);

    const expiring = await getExpiringBatches(30);
    setExpiringBatches(expiring);

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Batch & Serial Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">FIFO management, expiry alerts, recalls</p>
        </div>
        <Button onClick={() => setNewBatchModal(true)}>+ New Batch</Button>
      </div>

      {/* Expiry Alert */}
      {expiringBatches.length > 0 && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-2">{expiringBatches.length} batches expiring within 30 days</h3>
              <div className="space-y-1">
                {expiringBatches.slice(0, 3).map(b => (
                  <p key={b.id} className="text-sm text-red-800">
                    {b.batch_number} expires {formatDate(b.expiry_date)} ({b.current_quantity} units remaining)
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Batches Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading batches...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Batch Number</th>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-center px-4 py-3 font-medium">Mfg. Date</th>
                  <th className="text-center px-4 py-3 font-medium">Expiry Date</th>
                  <th className="text-right px-4 py-3 font-medium">Quantity</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{b.batch_number}</td>
                    <td className="px-4 py-3 text-slate-600">{b.product_name}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{formatDate(b.manufacturing_date)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{formatDate(b.expiry_date)}</td>
                    <td className="px-4 py-3 text-right font-medium">{b.current_quantity} units</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        color={
                          new Date(b.expiry_date) < new Date() ? 'red' :
                          new Date(b.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'amber' :
                          'green'
                        }
                      >
                        {b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedBatch(b);
                          setSerialModal(true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        View Serials
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      <Modal open={newBatchModal} onClose={() => setNewBatchModal(false)} title="New Batch" size="sm">
        <div className="space-y-4">
          <Input
            label="Batch Number"
            value={formData.batchNumber}
            onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
          />
          <Input type="date" label="Mfg Date" value={formData.mfgDate} onChange={e => setFormData({ ...formData, mfgDate: e.target.value })} />
          <Input
            type="date"
            label="Expiry Date"
            value={formData.expiryDate}
            onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
          />
          <Input type="number" label="Quantity" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
          <Button className="w-full">Create Batch</Button>
        </div>
      </Modal>

      <Modal open={serialsModal} onClose={() => setSerialModal(false)} title={`Serials - ${selectedBatch?.batch_number}`} size="md">
        {selectedBatch && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Serial numbers for this batch:</p>
            <div className="bg-slate-50 p-3 rounded max-h-64 overflow-y-auto text-sm font-mono">
              {/* Serial numbers would be listed here */}
              SN-001, SN-002, SN-003...
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
