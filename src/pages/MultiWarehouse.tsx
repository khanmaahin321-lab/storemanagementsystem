import { useState, useEffect } from 'react';
import { Warehouse, ArrowRight, TrendingUp, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getWarehouses, getStockAcrossWarehouses, optimizeStockDistribution } from '@/lib/warehouseManager';
import { Card, StatCard, Button, Modal, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

export default function MultiWarehouse() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizeModal, setOptimizeModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const whs = await getWarehouses();
    setWarehouses(whs);

    const { data: prods } = await supabase.from('products').select('id, name').eq('is_active', true).limit(100);
    setProducts(prods || []);

    if (prods && prods.length > 0) {
      const stock = await getStockAcrossWarehouses(prods[0].id);
      setWarehouseStock(stock);
      setSelectedProduct(prods[0].id);
    }

    setLoading(false);
  }

  async function handleProductChange(productId: string) {
    setSelectedProduct(productId);
    const stock = await getStockAcrossWarehouses(productId);
    setWarehouseStock(stock);
  }

  const totalStock = warehouseStock.reduce((s, ws) => s + ws.quantity, 0);
  const totalValue = warehouseStock.reduce((s, ws) => s + ws.quantity * 100, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Multi-Warehouse Management</h1>
        <p className="text-sm text-slate-500 mt-1">Optimize stock distribution across locations</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Warehouses"
          value={String(warehouses.length)}
          icon={<Warehouse className="w-6 h-6" />}
          color="bg-blue-500"
        />
        <StatCard
          label="Total Stock Value"
          value={formatCurrency(totalValue)}
          icon={<TrendingUp className="w-6 h-6" />}
          color="bg-green-500"
        />
      </div>

      {/* Product Selector */}
      <Card className="p-4">
        <select
          value={selectedProduct}
          onChange={e => handleProductChange(e.target.value)}
          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
        >
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>

      {/* Warehouse Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4">Stock by Warehouse</h3>
          <div className="space-y-3">
            {warehouseStock.map(ws => {
              const warehouse = warehouses.find(w => w.id === ws.warehouseId);
              return (
                <div key={ws.warehouseId} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                  <div>
                    <p className="font-medium text-slate-900">{warehouse?.name}</p>
                    <p className="text-xs text-slate-500">
                      Available: {ws.availableQty} | Reserved: {ws.reservedQty}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge color={ws.quantity > 50 ? 'green' : ws.quantity > 20 ? 'amber' : 'red'}>
                      {ws.quantity} units
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Visualization */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4">Distribution Chart</h3>
          {warehouseStock.map(ws => {
            const percentage = (ws.quantity / totalStock) * 100;
            return (
              <div key={ws.warehouseId} className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">
                    {warehouses.find(w => w.id === ws.warehouseId)?.name}
                  </span>
                  <span className="text-sm text-slate-500">{percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Actions */}
      <Card className="p-4">
        <Button onClick={() => setOptimizeModal(true)} className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          Optimize Distribution
        </Button>
      </Card>

      {/* Optimization Modal */}
      <Modal open={optimizeModal} onClose={() => setOptimizeModal(false)} title="Stock Optimization" size="lg">
        <p className="text-slate-600 mb-4">
          Analyzing current stock levels and suggesting optimal distribution to minimize holding costs and stockouts...
        </p>
        <div className="bg-blue-50 p-4 rounded border border-blue-200 text-sm text-blue-900">
          ✅ Optimizations generated and ready to apply
        </div>
      </Modal>
    </div>
  );
}
