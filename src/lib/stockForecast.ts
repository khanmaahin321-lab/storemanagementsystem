// AI-Powered Stock Forecasting Engine
// Predicts future demand based on historical sales patterns

import { supabase } from './supabase';

export interface ForecastResult {
  productId: string;
  productName: string;
  predictedDemand: number;
  confidence: number; // 0-100
  recommendedStock: number;
  riskLevel: 'low' | 'medium' | 'high'; // Stockout risk
  seasonalFactor: number;
  trendDirection: 'up' | 'down' | 'stable';
  forecastDays: number;
}

// ARIMA-like time series forecasting
export async function forecastDemand(productId: string, days: number = 30): Promise<ForecastResult | null> {
  const { data: sales } = await supabase
    .from('sale_items')
    .select('quantity, sales(sale_date)')
    .eq('product_id', productId)
    .gte('sales.sale_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('sales.sale_date', { ascending: false });

  if (!sales || sales.length === 0) return null;

  // Calculate moving average (MA)
  const quantities = sales.map(s => s.quantity);
  const ma7 = calculateMovingAverage(quantities, 7);
  const ma14 = calculateMovingAverage(quantities, 14);

  // Trend analysis
  const trend = ma7 > ma14 ? 'up' : ma7 < ma14 ? 'down' : 'stable';

  // Seasonal decomposition (monthly pattern)
  const seasonalFactor = calculateSeasonalFactor(sales);

  // Volatility (coefficient of variation)
  const stdDev = calculateStdDev(quantities);
  const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
  const cv = stdDev / mean;

  // Base forecast: weighted moving average
  const baseForecast = ma7 * 0.6 + ma14 * 0.4;
  const seasonalForecast = baseForecast * seasonalFactor;
  const predictedDemand = Math.ceil(seasonalForecast);

  // Confidence score (higher CV = lower confidence)
  const confidence = Math.max(30, Math.min(95, 95 - cv * 50));

  // Safety stock calculation (uses z-score for 95% service level)
  const zScore = 1.65;
  const safetyStock = Math.ceil(zScore * stdDev);
  const recommendedStock = predictedDemand + safetyStock;

  // Risk assessment
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (cv > 0.5 || confidence < 50) riskLevel = 'high';
  else if (cv > 0.3 || confidence < 70) riskLevel = 'medium';

  const { data: product } = await supabase.from('products').select('name').eq('id', productId).single();

  return {
    productId,
    productName: product?.name || 'Unknown',
    predictedDemand,
    confidence: Math.round(confidence),
    recommendedStock,
    riskLevel,
    seasonalFactor: Number(seasonalFactor.toFixed(2)),
    trendDirection: trend,
    forecastDays: days,
  };
}

function calculateMovingAverage(data: number[], period: number): number {
  if (data.length < period) return data.reduce((a, b) => a + b, 0) / data.length;
  return data.slice(0, period).reduce((a, b) => a + b, 0) / period;
}

function calculateStdDev(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

function calculateSeasonalFactor(sales: any[]): number {
  const currentMonth = new Date().getMonth();
  const monthSales = sales.filter(s => new Date(s.sales.sale_date).getMonth() === currentMonth);
  const avgCurrentMonth = monthSales.reduce((s, r) => s + r.quantity, 0) / (monthSales.length || 1);
  const overallAvg = sales.reduce((s, r) => s + r.quantity, 0) / sales.length;
  return overallAvg > 0 ? avgCurrentMonth / overallAvg : 1;
}

// Batch forecast for multiple products
export async function batchForecast(productIds: string[]): Promise<ForecastResult[]> {
  const forecasts = await Promise.all(productIds.map(id => forecastDemand(id)));
  return forecasts.filter((f): f is ForecastResult => f !== null);
}
