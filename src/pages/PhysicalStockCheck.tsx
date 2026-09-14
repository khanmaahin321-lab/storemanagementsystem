import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, AlertTriangle, Check, Package, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, PhysicalStockCheck, PhysicalStockCheckItem } from '@/lib/supabase';
import { Card, Modal, Input, Button, EmptyState, Badge, Textarea } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

type PhysicalCheckWithItems = PhysicalStockCheck & {
  items: (PhysicalStockCheckItem & { products?: { name: string; unit: string } | null })[];
};

export default function PhysicalStockCheck() {
  const [checks, setChecks] = useState<PhysicalCheckWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [checkModal, setCheckModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<PhysicalCheckWithItems | null>(null);
  const [newCheckItems, setNewCheckItems] = useState<
    Array<{
      product_id: string;
      physical_stock: number;
      reason?: string;
    }>
  >([]);
  const [checkNotes, setCheckNotes] = useState('');

  const loadChecks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('physical_stock_checks')
      .select('*, physical_stock_check_items(*, products(name, unit))')
      .order('created_at', { ascending: false });

    setChecks(
      (data || []).filter((c) => !search || c.notes?.toLowerCase().includes(search.toLowerCase())) as PhysicalCheckWithItems[]
    );
    setLoading(false);
  }, [search]);

  useEffect(() => {
    supabase.from('products').select('*').order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
  }, []);

  useEffect(() => {
    loadChecks();
  }, [loadChecks]);

  async function startNewCheck() {
    setNewCheckItems(
      products.map((p) => ({
        product_id: p.id,
        physical_stock: p.current_stock,
      }))
    );
    setCheckNotes('');
    setModalOpen(true);
  }

  async function saveCheck() {
    if (newCheckItems.length === 0) return;

    const { data: checkData } = await supabase
      .from('physical_stock_checks')
      .insert({
        check_date: new Date().toISOString().split('T')[0],
        notes: checkNotes,
        status: 'pending',
      })
      .select()
      .single();

    if (checkData) {
      const items = newCheckItems.map((item) => ({
        check_id: checkData.id,
        product_id: item.product_id,
        system_stock: products.find((p) => p.id === item.product_id)?.current_stock || 0,
        physical_stock: item.physical_stock,
        difference: (item.physical_stock || 0) - (products.find((p) => p.id === item.product_id)?.current_stock || 0),
        reason: item.reason,
        applied: false,
      }));

      await supabase.from('physical_stock_check_items').insert(items);

      setModalOpen(false);
      loadChecks();
    }
  }

  async function applyAdjustments(check: PhysicalCheckWithItems) {
    const adjustments = check.items.filter((item) => item.difference !== 0 && !item.applied);

    for (const item of adjustments) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) continue;

      // Update product stock
      await supabase
        .from('products')
        .update({ current_stock: item.physical_stock })
        .eq('id', item.product_id);

      // Create stock movement
      const isAdd = item.difference > 0;
      await supabase.from('stock_movements').insert({
        product_id: item.product_id,
        movement_type: isAdd ? 'adjustment_in' : 'adjustment_out',
        quantity: Math.abs(item.difference),
        reference_type: 'physical_stock_check',
        reference_id: check.id,
        reason: item.reason || 'Physical Stock Correction',
        notes: `Applied from physical stock check on ${formatDate(check.check_date)}`,
        balance_after: item.physical_stock,
        unit_cost: product.purchase_price,
      });

      // Mark as applied
      await supabase
        .from('physical_stock_check_items')
        .update({ applied: true })
        .eq('id', item.id);
    }

    // Update check status
    await supabase.from('physical_stock_checks').update({ status: 'applied' }).eq('id', check.id);

    loadChecks();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Physical Stock Check</h1>
          <p className="text-sm text-slate-500 mt-1">Verify actual stock against system records</p>
        </div>
        <Button onClick={startNewCheck}>
          <Plus className="w-4 h-4 inline mr-1" />
          New Check
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </Card>

      {/* Checks list */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : checks.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No checks found"
            description="Start a new physical stock check to verify your inventory"
            action={<Button onClick={startNewCheck}><Plus className="w-4 h-4 inline mr-1" />New Check</Button>}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {checks.map((check) => {
              const discrepancies = check.items.filter((item) => item.difference !== 0);
              const applied = check.items.every((item) => item.applied || item.difference === 0);
              return (
                <div key={check.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-slate-900">Check on {formatDate(check.check_date)}</p>
                        <Badge className={applied ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                          {check.status || 'pending'}
                        </Badge>
                      </div>
                      {check.notes && <p className="text-sm text-slate-600 mb-2">{check.notes}</p>}
                      {discrepancies.length > 0 && (
                        <div className="text-sm text-amber-600 flex items-center gap-1 mb-3">
                          <AlertTriangle className="w-4 h-4" />
                          {discrepancies.length} discrepanc{discrepancies.length > 1 ? 'ies' : 'y'} found
                        </div>
                      )}
                      <div className="space-y-1 text-sm">
                        {check.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-slate-600">
                            <span>{item.products?.name}</span>
                            <span>
                              System: {item.system_stock} → Physical: {item.physical_stock} {item.products?.unit}
                              {item.difference !== 0 && (
                                <span className={item.difference > 0 ? 'text-green-600' : 'text-red-600'} title="Difference">
                                  {' '}({item.difference > 0 ? '+' : ''}{item.difference})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                        {check.items.length > 3 && <div className="text-slate-400 text-xs">+{check.items.length - 3} more items</div>}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedCheck(check);
                          setCheckModal(true);
                        }}
                        className="px-3 py-1 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        View Details
                      </button>
                      {!applied && discrepancies.length > 0 && (
                        <button
                          onClick={() => applyAdjustments(check)}
                          className="px-3 py-1 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 whitespace-nowrap flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* New Check Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Physical Stock Check" size="xl">
        <div className="space-y-4">
          <Textarea
            label="Notes"
            rows={2}
            value={checkNotes}
            onChange={(e) => setCheckNotes(e.target.value)}
            placeholder="Optional notes for this check"
          />

          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-right px-3 py-2 font-medium">System Stock</th>
                  <th className="text-right px-3 py-2 font-medium">Physical Stock</th>
                  <th className="text-right px-3 py-2 font-medium">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {newCheckItems.map((item, idx) => {
                  const product = products.find((p) => p.id === item.product_id);
                  const systemStock = product?.current_stock || 0;
                  const diff = (item.physical_stock || 0) - systemStock;
                  return (
                    <tr key={item.product_id}>
                      <td className="px-3 py-2 text-slate-900 font-medium">{product?.name}</td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {systemStock} {product?.unit}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.physical_stock || 0}
                          onChange={(e) => {
                            const newItems = [...newCheckItems];
                            newItems[idx].physical_stock = Number(e.target.value);
                            setNewCheckItems(newItems);
                          }}
                          className="w-20 px-2 py-1 rounded border border-slate-300 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          diff === 0 ? 'text-slate-600' : diff > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}{diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveCheck}>Save Check</Button>
        </div>
      </Modal>

      {/* Check Details Modal */}
      {selectedCheck && (
        <Modal open={checkModal} onClose={() => setCheckModal(false)} title="Check Details" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-400">Check Date</p>
                <p className="font-medium text-slate-900">{formatDate(selectedCheck.check_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <Badge className={selectedCheck.status === 'applied' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                  {selectedCheck.status}
                </Badge>
              </div>
              {selectedCheck.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">Notes</p>
                  <p className="text-sm text-slate-900">{selectedCheck.notes}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium text-slate-900 mb-2">Items</h4>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Product</th>
                      <th className="text-right px-3 py-2 font-medium">System</th>
                      <th className="text-right px-3 py-2 font-medium">Physical</th>
                      <th className="text-right px-3 py-2 font-medium">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedCheck.items.map((item) => (
                      <tr key={item.id} className={item.applied ? 'bg-green-50' : ''}>}
                        <td className="px-3 py-2 text-slate-900">{item.products?.name}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.system_stock}</td>
                        <td className="px-3 py-2 text-right text-slate-900 font-medium">{item.physical_stock}</td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            item.difference === 0 ? 'text-slate-600' : item.difference > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setCheckModal(false)}>
              Close
            </Button>
            {selectedCheck.status !== 'applied' && selectedCheck.items.filter((i) => i.difference !== 0).length > 0 && (
              <Button onClick={() => { applyAdjustments(selectedCheck); setCheckModal(false); }}>
                <Check className="w-4 h-4 inline mr-1" />
                Apply Adjustments
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
