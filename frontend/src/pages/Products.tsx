import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Eye,
  Sliders,
  TrendingUp,
  TrendingDown,
  History,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Category, Supplier, StockMovement } from '@/lib/supabase';
import { Card, Modal, Input, Select, Textarea, Button, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, generateSKU, formatDate } from '@/lib/utils';

type ProductWithRelations = Product & {
  categories?: Category | null;
  suppliers?: Supplier | null;
};

export default function Products() {
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>({});
  const [stockModal, setStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState<ProductWithRelations | null>(null);
  const [stockMovements, setStockMovements] = useState<(StockMovement & { products?: { name: string; unit: string } | null })[]>([]);
  const [adjustForm, setAdjustForm] = useState({ type: 'adjustment_in', quantity: 0, reason: 'Physical Stock Correction', notes: '' });
  const [importModal, setImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<{ rows: Record<string, unknown>[]; headers: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, categories(*), suppliers(*)')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    if (filterCategory) {
      query = query.eq('category_id', filterCategory);
    }

    const { data } = await query;
    setProducts((data || []) as ProductWithRelations[]);
    setLoading(false);
  }, [search, filterCategory]);

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
    supabase.from('suppliers').select('*').order('name').then(({ data }) => {
      if (data) setSuppliers(data as Supplier[]);
    });
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function openAdd() {
    setEditing(null);
    setForm({
      unit: 'sq.ft',
      gst_percent: 18,
      is_active: true,
      current_stock: 0,
      minimum_stock: 0,
      opening_stock: 0,
    });
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm(product);
    setModalOpen(true);
  }

  async function save() {
    if (!form.name) return;

    if (editing) {
      const updates = { ...form, updated_at: new Date().toISOString() };
      await supabase.from('products').update(updates).eq('id', editing.id);
    } else {
      const sku = form.sku || generateSKU(form.name, categories.find((c) => c.id === form.category_id)?.name || 'PRD');
      await supabase.from('products').insert({
        ...form,
        sku,
        current_stock: form.opening_stock || 0,
      });
    }
    setModalOpen(false);
    loadProducts();
  }

  async function remove(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await supabase.from('products').delete().eq('id', id);
    loadProducts();
  }

  async function openStockDetails(product: ProductWithRelations) {
    setStockProduct(product);
    setStockModal(true);
    setAdjustForm({ type: 'adjustment_in', quantity: 0, reason: 'Physical Stock Correction', notes: '' });
    const { data } = await supabase
      .from('stock_movements')
      .select('*, products(name, unit)')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setStockMovements((data || []) as (StockMovement & { products?: { name: string; unit: string } | null })[]);
  }

  const HEADER_MAP: Record<string, keyof typeof importTemplate> = {
    name: 'name', product: 'name', 'product name': 'name',
    category: 'category', 'category name': 'category',
    sku: 'sku', code: 'sku',
    brand: 'brand', model: 'model', color: 'color', finish: 'finish',
    size: 'size', thickness: 'thickness', unit: 'unit',
    'purchase price': 'purchase_price', 'cost price': 'purchase_price', cost: 'purchase_price',
    'selling price': 'selling_price', 'sale price': 'selling_price', price: 'selling_price',
    'wholesale price': 'wholesale_price',
    'gst %': 'gst_percent', gst: 'gst_percent', 'gst percent': 'gst_percent',
    'opening stock': 'opening_stock', stock: 'opening_stock', quantity: 'opening_stock',
    'minimum stock': 'minimum_stock', 'min stock': 'minimum_stock', reorder: 'minimum_stock',
    barcode: 'barcode',
  };

  const importTemplate = {
    name: '', category: '', sku: '', brand: '', model: '', color: '', finish: '',
    size: '', thickness: '', unit: 'sq.ft',
    purchase_price: 0, selling_price: 0, wholesale_price: 0, gst_percent: 18,
    opening_stock: 0, minimum_stock: 0, barcode: '',
  };

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (!rows.length) {
      setImportResult({ added: 0, errors: ['The file is empty or has no data rows.'] });
      return;
    }
    const rawHeaders = Object.keys(rows[0]);
    const headers: string[] = [];
    const mapped: Record<string, unknown>[] = [];
    for (const row of rows) {
      const obj: Record<string, unknown> = {};
      for (const h of rawHeaders) {
        const key = HEADER_MAP[h.toLowerCase().trim()] || h.toLowerCase().trim();
        obj[key] = row[h];
      }
      mapped.push(obj);
    }
    const seen = new Set<string>();
    for (const h of rawHeaders) {
      const key = HEADER_MAP[h.toLowerCase().trim()] || h.toLowerCase().trim();
      if (!seen.has(key)) { seen.add(key); headers.push(key); }
    }
    setImportPreview({ rows: mapped, headers });
    setImportResult(null);
  }

  function downloadTemplate() {
    const sample = [
      { Name: 'Carrara White Marble', Category: 'Marble', SKU: '', Brand: '', Model: '', Color: 'White', Finish: 'Polished', Size: '2x2 ft', Thickness: '15mm', Unit: 'sq.ft', 'Purchase Price': 120, 'Selling Price': 180, 'Wholesale Price': 160, 'GST %': 18, 'Opening Stock': 50, 'Minimum Stock': 10, Barcode: '' },
      { Name: 'Black Galaxy Granite', Category: 'Granite', SKU: '', Brand: '', Model: '', Color: 'Black', Finish: 'Honed', Size: '3x3 ft', Thickness: '20mm', Unit: 'sq.ft', 'Purchase Price': 250, 'Selling Price': 380, 'Wholesale Price': 340, 'GST %': 18, 'Opening Stock': 25, 'Minimum Stock': 5, Barcode: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'products_import_template.xlsx');
  }

  async function runImport() {
    if (!importPreview) return;
    setImporting(true);
    const errors: string[] = [];
    let added = 0;
    const catMap = new Map<string, string>();
    (categories || []).forEach((c) => catMap.set(c.name.toLowerCase(), c.id));
    const newCats: string[] = [];
    for (const row of importPreview.rows) {
      const catName = String(row.category || '').trim();
      if (catName && !catMap.has(catName.toLowerCase())) newCats.push(catName);
    }
    for (const name of newCats) {
      const { data, error } = await supabase.from('categories').insert({ name }).select().single();
      if (error) { errors.push(`Could not create category "${name}"`); continue; }
      catMap.set(name.toLowerCase(), data.id);
      setCategories((prev) => [...prev, data as Category]);
    }
    for (let i = 0; i < importPreview.rows.length; i++) {
      const row = importPreview.rows[i];
      const name = String(row.name || '').trim();
      if (!name) { errors.push(`Row ${i + 2}: missing product name`); continue; }
      const catName = String(row.category || '').trim();
      const category_id = catName ? catMap.get(catName.toLowerCase()) || null : null;
      const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
      const str = (v: unknown) => (v === '' || v == null ? '' : String(v));
      const sku = str(row.sku) || generateSKU(name, catName || 'PRD');
      const product = {
        name,
        sku,
        category_id,
        brand: str(row.brand) || null,
        model: str(row.model) || null,
        color: str(row.color) || null,
        finish: str(row.finish) || null,
        size: str(row.size) || null,
        thickness: str(row.thickness) || null,
        unit: str(row.unit) || 'sq.ft',
        purchase_price: num(row.purchase_price),
        selling_price: num(row.selling_price),
        wholesale_price: num(row.wholesale_price),
        gst_percent: num(row.gst_percent) || 18,
        opening_stock: num(row.opening_stock),
        current_stock: num(row.opening_stock),
        minimum_stock: num(row.minimum_stock),
        barcode: str(row.barcode) || null,
        is_active: true,
      };
      const { error } = await supabase.from('products').insert(product);
      if (error) {
        errors.push(`Row ${i + 2} (${name}): ${error.message}`);
        continue;
      }
      added++;
    }
    setImporting(false);
    setImportResult({ added, errors });
    if (added > 0) loadProducts();
  }

  async function saveStockAdjust() {
    if (!stockProduct || adjustForm.quantity <= 0) return;
    const isAdd = adjustForm.type === 'adjustment_in';
    const qty = isAdd ? adjustForm.quantity : -adjustForm.quantity;
    const newStock = stockProduct.current_stock + qty;
    if (newStock < 0) {
      alert('Stock cannot go negative. Current stock is ' + stockProduct.current_stock + ' ' + stockProduct.unit);
      return;
    }
    await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', stockProduct.id);
    await supabase.from('stock_movements').insert({
      product_id: stockProduct.id,
      movement_type: adjustForm.type,
      quantity: adjustForm.quantity,
      reference_type: 'adjustment',
      reason: adjustForm.reason,
      notes: adjustForm.notes || adjustForm.reason,
      balance_after: newStock,
      unit_cost: stockProduct.purchase_price,
      user_name: 'admin',
    });
    setStockModal(false);
    loadProducts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setImportModal(true); setImportPreview(null); setImportResult(null); }}>
            <Upload className="w-4 h-4 inline mr-1" />
            Import from Excel
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 inline mr-1" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              placeholder="Search by name or SKU..."
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Products table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No products found"
            description="Add your first product to get started"
            action={<Button onClick={openAdd}><Plus className="w-4 h-4 inline mr-1" />Add Product</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">SKU</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Sell Price</th>
                  <th className="text-right px-4 py-3 font-medium">Stock</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const lowStock = p.current_stock <= p.minimum_stock && p.minimum_stock > 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        {p.brand && <div className="text-xs text-slate-400">{p.brand}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.sku}</td>
                      <td className="px-4 py-3 text-slate-600">{p.categories?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(p.selling_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={lowStock ? 'text-red-600 font-medium' : 'text-slate-700'}>
                          {p.current_stock} {p.unit}
                        </span>
                        {lowStock && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.is_active ? <Badge color="green">Active</Badge> : <Badge color="slate">Inactive</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openStockDetails(p)} className="text-slate-400 hover:text-blue-600 p-1" title="Stock Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-amber-600 p-1">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(p.id)} className="text-slate-400 hover:text-red-500 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} size="xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <Input label="Product Name *" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Carrara White Marble" />
          </div>
          <Select label="Category" value={form.category_id || ''} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select label="Unit" value={form.unit || 'sq.ft'} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="sq.ft">sq.ft</option>
            <option value="sq.m">sq.m</option>
            <option value="piece">piece</option>
            <option value="box">box</option>
            <option value="kg">kg</option>
            <option value="bag">bag</option>
            <option value="set">set</option>
            <option value="packet">packet</option>
          </Select>
          <Input label="Purchase Price" type="number" value={form.purchase_price ?? ''} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
          <Input label="Selling Price" type="number" value={form.selling_price ?? ''} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
          {!editing && <Input label="Opening Stock" type="number" value={form.opening_stock ?? ''} onChange={(e) => setForm({ ...form, opening_stock: Number(e.target.value) })} />}
          <Input label="Minimum Stock Alert" type="number" value={form.minimum_stock ?? ''} onChange={(e) => setForm({ ...form, minimum_stock: Number(e.target.value) })} />
          {!editing && <Input label="GST %" type="number" value={form.gst_percent ?? ''} onChange={(e) => setForm({ ...form, gst_percent: Number(e.target.value) })} />}

          {editing && (
            <>
              <Input label="SKU" value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Auto-generated" />
              <Input label="Brand" value={form.brand || ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <Input label="Model" value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <Input label="Color" value={form.color || ''} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              <Input label="Finish" value={form.finish || ''} onChange={(e) => setForm({ ...form, finish: e.target.value })} />
              <Input label="Size" value={form.size || ''} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 2x2 ft" />
              <Input label="Thickness" value={form.thickness || ''} onChange={(e) => setForm({ ...form, thickness: e.target.value })} placeholder="e.g. 15mm" />
              <Input label="Wholesale Price" type="number" value={form.wholesale_price ?? ''} onChange={(e) => setForm({ ...form, wholesale_price: Number(e.target.value) })} />
              <Input label="GST %" type="number" value={form.gst_percent ?? ''} onChange={(e) => setForm({ ...form, gst_percent: Number(e.target.value) })} />
              <Select label="Supplier" value={form.supplier_id || ''} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Input label="Barcode" value={form.barcode || ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              <Input label="Image URL" value={form.image_url || ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Add'} Product</Button>
        </div>
      </Modal>

      {/* Excel Import Modal */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Import Products from Excel" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <FileSpreadsheet className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium">Upload an .xlsx or .csv file</p>
              <p className="text-blue-600">Columns: Name, Category, SKU, Brand, Purchase Price, Selling Price, Opening Stock, etc.</p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />

          {!importPreview && !importResult && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 inline mr-1" />
                Choose Excel File
              </Button>
              <Button variant="secondary" onClick={downloadTemplate}>
                <Download className="w-4 h-4 inline mr-1" />
                Download Template
              </Button>
            </div>
          )}

          {importPreview && !importResult && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Found <span className="font-bold text-slate-900">{importPreview.rows.length}</span> rows.
                Missing categories will be created automatically.
              </p>
              <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0">
                    <tr>
                      {importPreview.headers.map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.rows.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        {importPreview.headers.map((h) => (
                          <td key={h} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{String(r[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.rows.length > 50 && <p className="text-xs text-slate-400">Showing first 50 of {importPreview.rows.length} rows</p>}
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setImportPreview(null)}>Cancel</Button>
                <Button onClick={runImport} disabled={importing}>
                  {importing ? 'Importing...' : `Import ${importPreview.rows.length} Products`}
                </Button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg ${importResult.added > 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  {importResult.added > 0 ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-amber-600" />}
                  <p className="font-bold text-slate-900">{importResult.added} product(s) imported successfully</p>
                </div>
                {importResult.errors.length > 0 && (
                  <p className="text-sm text-amber-700 mt-1">{importResult.errors.length} row(s) had errors.</p>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-48 overflow-auto border border-rose-200 rounded-lg p-3 bg-rose-50">
                  <ul className="text-xs text-rose-700 space-y-1">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setImportModal(false); setImportResult(null); setImportPreview(null); }}>Close</Button>
                <Button onClick={() => { setImportPreview(null); setImportResult(null); fileRef.current?.click(); }}>Import Another File</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Stock Details Modal */}
      <Modal open={stockModal} onClose={() => setStockModal(false)} title="Stock Details" size="lg">
        {stockProduct && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg">
              <div><p className="text-xs text-slate-400">Product</p><p className="font-medium text-slate-900 text-sm">{stockProduct.name}</p></div>
              <div><p className="text-xs text-slate-400">Category</p><p className="font-medium text-slate-900 text-sm">{stockProduct.categories?.name || '-'}</p></div>
              <div><p className="text-xs text-slate-400">Unit</p><p className="font-medium text-slate-900 text-sm">{stockProduct.unit}</p></div>
              <div><p className="text-xs text-slate-400">Opening Stock</p><p className="font-medium text-slate-900">{stockProduct.opening_stock}</p></div>
              <div><p className="text-xs text-slate-400">Current Stock</p><p className="font-bold text-blue-600">{stockProduct.current_stock}</p></div>
              <div><p className="text-xs text-slate-400">Min Stock</p><p className="font-medium text-slate-900">{stockProduct.minimum_stock}</p></div>
              <div><p className="text-xs text-slate-400">Purchase Price</p><p className="font-medium text-slate-900">{formatCurrency(stockProduct.purchase_price)}</p></div>
              <div><p className="text-xs text-slate-400">Selling Price</p><p className="font-medium text-slate-900">{formatCurrency(stockProduct.selling_price)}</p></div>
              <div><p className="text-xs text-slate-400">Stock Value</p><p className="font-medium text-green-600">{formatCurrency(stockProduct.current_stock * stockProduct.purchase_price)}</p></div>
            </div>

            {/* Quick adjust form */}
            <div className="p-4 border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Stock Adjustment</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Select label="Type" value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                  <option value="adjustment_in">Add Stock (+)</option>
                  <option value="adjustment_out">Remove Stock (-)</option>
                </Select>
                <Input label="Quantity" type="number" value={adjustForm.quantity || ''} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })} />
                <Select label="Reason" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}>
                  <option>Damaged</option><option>Broken</option><option>Missing</option>
                  <option>Extra Stock Found</option><option>Wrong Entry</option>
                  <option>Physical Stock Correction</option><option>Other</option>
                </Select>
              </div>
              <Textarea label="Notes" rows={2} value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
              <Button onClick={saveStockAdjust}><Sliders className="w-4 h-4 inline mr-1" />Save Adjustment</Button>
            </div>

            {/* Movement history */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-2"><History className="w-4 h-4 inline mr-1" />Stock Movement History</h4>
              {stockMovements.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No movements yet</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 sticky top-0">
                      <tr><th className="text-left px-3 py-2 font-medium">Date</th><th className="text-left px-3 py-2 font-medium">Type</th><th className="text-right px-3 py-2 font-medium">Qty</th><th className="text-left px-3 py-2 font-medium">Reason</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockMovements.map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(m.created_at)}</td>
                          <td className="px-3 py-2"><Badge color={m.movement_type === 'in' ? 'green' : m.movement_type === 'out' ? 'red' : 'blue'}>{m.movement_type}</Badge></td>
                          <td className="px-3 py-2 text-right font-medium">{m.quantity}</td>
                          <td className="px-3 py-2 text-slate-500">{m.reason || m.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
