import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Zap, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { forecastDemand, batchForecast, type ForecastResult } from '@/lib/stockForecast';
import { Card, StatCard, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

export default function StockForecasting() {
  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastDays, setForecastDays] = useState(30);

  useEffect(() => {
    loadForecasts();
  }, [forecastDays]);

  async function loadForecasts() {
    setLoading(true);
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .limit(50);

    if (products) {
      const results = await batchForecast(products.map(p => p.id));
      // Sort by risk
      setForecasts(
        results.sort((a, b) => {
          const riskOrder = { high: 0, medium: 1, low: 2 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }),
      );
    }
    setLoading(false);
  }

  const highRiskCount = forecasts.filter(f => f.riskLevel === 'high').length;
  const avgConfidence =
    forecasts.length > 0 ? Math.round(forecasts.reduce((s, f) => s + f.confidence, 0) / forecasts.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Forecasting</h1>
        <p className="text-sm text-slate-500 mt-1">AI-powered demand prediction & stock optimization</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="High Risk Items"
          value={String(highRiskCount)}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="bg-red-500"
        />
        <StatCard
          label="Avg Confidence"
          value={`${avgConfidence}%`}
          icon={<Zap className="w-6 h-6" />}
          color="bg-amber-500"
        />
        <StatCard
          label="Forecasted Items"
          value={String(forecasts.length)}
          icon={<BarChart3 className="w-6 h-6" />}
          color="bg-blue-500"
        />
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex gap-3">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            Forecast Period:
            <select
              value={forecastDays}
              onChange={e => setForecastDays(Number(e.target.value))}
              className="px-3 py-1 rounded border border-slate-300 text-sm"
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </label>
        </div>
      </Card>

      {/* Forecasts Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading forecasts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-right px-4 py-3 font-medium">Predicted Demand</th>
                  <th className="text-right px-4 py-3 font-medium">Recommended Stock</th>
                  <th className="text-center px-4 py-3 font-medium">Confidence</th>
                  <th className="text-center px-4 py-3 font-medium">Trend</th>
                  <th className="text-center px-4 py-3 font-medium">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forecasts.map(f => (
                  <tr key={f.productId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{f.productName}</td>
                    <td className="px-4 py-3 text-right">{f.predictedDemand} units</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600">{f.recommendedStock} units</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 max-w-xs">
                          <div
                            className="bg-amber-500 h-2 rounded-full"
                            style={{ width: `${f.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{f.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        color={f.trendDirection === 'up' ? 'green' : f.trendDirection === 'down' ? 'red' : 'slate'}
                      >
                        {f.trendDirection === 'up' ? '↑' : f.trendDirection === 'down' ? '↓' : '→'} {f.trendDirection}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={f.riskLevel === 'high' ? 'red' : f.riskLevel === 'medium' ? 'amber' : 'green'}>
                        {f.riskLevel.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
