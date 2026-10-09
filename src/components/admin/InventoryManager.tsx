'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

import { Label } from '@/components/ui/Label'
import { Package, Plus, Search, TrendingUp, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { toast } from 'sonner'
import { createMaterialAction, addStockAction } from '@/app/actions/inventory'

export function InventoryManager({ initialMaterials }: { initialMaterials: any[] }) {
  const [materials, setMaterials] = useState(initialMaterials)
  const [search, setSearch] = useState('')
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isStockOpen, setIsStockOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)

  // Form states
  const [formData, setFormData] = useState({ name: '', roll_width: '', roll_length: '', unit_cost: '', qty_rolls: '' })
  const [stockData, setStockData] = useState({ qty: '', cost: '' })

  const filtered = materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await createMaterialAction(formData)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Material created')
      setIsAddOpen(false)
      window.location.reload()
    }
  }

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await addStockAction(selectedMaterial.id, parseFloat(stockData.qty), parseFloat(stockData.cost))
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Stock added successfully')
      setIsStockOpen(false)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search materials..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Add Material
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(m => {
          const totalArea = m.roll_width * m.roll_length * m.qty_rolls
          const stockValue = m.qty_rolls * m.unit_cost
          const isLow = m.qty_rolls <= 1
          
          return (
            <Card key={m.id} className={`border-t-4 ${isLow ? 'border-t-red-500' : 'border-t-indigo-500'} relative overflow-hidden group`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{m.name}</h3>
                    <p className="text-xs text-slate-500">{m.roll_width}m × {m.roll_length}m Roll</p>
                  </div>
                  <div className={`p-2 rounded-lg ${isLow ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {isLow ? <AlertCircle className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500 mb-1">Available Area</div>
                      <div className="text-xl font-bold text-slate-800">{totalArea.toFixed(2)} m²</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500 mb-1">Rolls Left</div>
                      <div className={`text-xl font-bold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                        {parseFloat(m.qty_rolls).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                    <span className="text-slate-500">Stock Value</span>
                    <span className="font-bold text-slate-900">{formatCurrency(stockValue)}</span>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full mt-2 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors"
                    onClick={() => { setSelectedMaterial(m); setIsStockOpen(true) }}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" /> Add Stock
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-4">
            <div>
              <Label>Material Name</Label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Flexi - Matte" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Roll Width (m)</Label>
                <input required type="number" step="0.01" value={formData.roll_width} onChange={e => setFormData({...formData, roll_width: e.target.value})} placeholder="e.g. 1.2" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <Label>Roll Length (m)</Label>
                <input required type="number" step="0.01" value={formData.roll_length} onChange={e => setFormData({...formData, roll_length: e.target.value})} placeholder="e.g. 50" className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Initial Rolls (Qty)</Label>
                <input type="number" step="0.01" value={formData.qty_rolls} onChange={e => setFormData({...formData, qty_rolls: e.target.value})} placeholder="0" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <Label>Cost per Roll</Label>
                <input type="number" step="0.01" value={formData.unit_cost} onChange={e => setFormData({...formData, unit_cost: e.target.value})} placeholder="0.00" className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit">Create Material</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock: {selectedMaterial?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStock} className="space-y-4 mt-4">
            <div>
              <Label>Quantity (Rolls to add)</Label>
              <input required type="number" step="0.01" value={stockData.qty} onChange={e => setStockData({...stockData, qty: e.target.value})} placeholder="e.g. 5" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <Label>Cost per Roll (for this batch)</Label>
              <input required type="number" step="0.01" value={stockData.cost} onChange={e => setStockData({...stockData, cost: e.target.value})} placeholder="e.g. 1200" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStockOpen(false)}>Cancel</Button>
              <Button type="submit">Add Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
