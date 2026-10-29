'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { 
  Package, 
  Plus, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  History, 
  Link2, 
  Edit3, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  CheckCircle2, 
  X, 
  LayoutGrid, 
  Table as TableIcon, 
  Boxes, 
  Ruler, 
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Calendar,
  Clock
} from 'lucide-react'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'

function formatDateStamp(dateStr?: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeStamp(dateStr?: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { toast } from 'sonner'
import { 
  createMaterialAction, 
  addStockAction, 
  adjustStockAction,
  updateMaterialAction,
  deleteMaterialAction,
  linkProductTypeToMaterialAction,
  normalizeRollDimensionsAction
} from '@/app/actions/inventory'
import {
  detectSubstrateFamily,
  parseRollDimensions,
  recommendMaterialForJob
} from '@/lib/material-matching'
import { motion, AnimatePresence } from 'framer-motion'

interface Material {
  id: string
  name: string
  unit: string
  roll_width: number
  roll_length?: number
  roll_height?: number
  qty_rolls: number
  unit_cost: number
  created_at: string
  updated_at: string
}

interface InventoryLog {
  id: string
  tenant_id: string
  material_id: string
  action: string
  job_id: string | null
  qty_change_rolls: number
  qty_change_area: number
  notes: string
  created_at: string
  materials?: {
    name: string
    roll_width: number
    roll_length?: number
    roll_height?: number
  } | null
  jobs?: {
    job_number: string
    customer_name: string
  } | null
}

interface ProductType {
  id: string
  name: string
  is_active: boolean
  material_id: string | null
}

export function getUnitLabels(unit?: string) {
  const u = (unit || 'roll').toLowerCase()
  if (u === 'sheet') {
    return {
      type: 'sheet',
      singular: 'sheet',
      plural: 'sheets',
      dimWidth: 'Sheet Width',
      dimHeight: 'Sheet Height',
      cardSubtext: 'Sheet',
      warehouseLabel: 'Sheets in Warehouse',
      perUnit: '/ sheet',
      restockBtn: 'Restock Sheets',
      wasteLabel: 'Deduct Damaged / Wasted Sheet (-)',
      target: 'Target: 10+ sheets',
      addStockLabel: 'Sheets to Add',
      adjustStockLabel: 'Sheets to Deduct'
    }
  }
  if (u === 'piece') {
    return {
      type: 'piece',
      singular: 'piece',
      plural: 'pieces',
      dimWidth: 'Item Width',
      dimHeight: 'Item Height',
      cardSubtext: 'Piece',
      warehouseLabel: 'Pieces in Warehouse',
      perUnit: '/ piece',
      restockBtn: 'Restock Pieces',
      wasteLabel: 'Deduct Damaged / Wasted Item (-)',
      target: 'Target: 10+ pcs',
      addStockLabel: 'Pieces to Add',
      adjustStockLabel: 'Pieces to Deduct'
    }
  }
  return {
    type: 'roll',
    singular: 'roll',
    plural: 'rolls',
    dimWidth: 'Roll Width',
    dimHeight: 'Roll Height',
    cardSubtext: 'Roll',
    warehouseLabel: 'Rolls in Warehouse',
    perUnit: '/ roll',
    restockBtn: 'Restock Roll',
    wasteLabel: 'Deduct Damaged / Wasted Roll (-)',
    target: 'Target: 5+ rolls',
    addStockLabel: 'Rolls to Add',
    adjustStockLabel: 'Rolls to Deduct'
  }
}

export function InventoryManager({ 
  initialMaterials, 
  initialLogs, 
  productTypes: initialProductTypes,
  userRole,
  tenantId
}: { 
  initialMaterials: Material[]
  initialLogs: InventoryLog[]
  productTypes: ProductType[]
  userRole: string
  tenantId: string
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials)
  const [logs, setLogs] = useState<InventoryLog[]>(initialLogs)
  const [productTypes, setProductTypes] = useState<ProductType[]>(initialProductTypes)

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'inventory' | 'logs' | 'linking'>('inventory')

  // Search & Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'flexi' | 'sav' | 'other'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Logs search
  const [logSearch, setLogSearch] = useState('')
  const [logActionFilter, setLogActionFilter] = useState<string>('all')

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isStockOpen, setIsStockOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [addForm, setAddForm] = useState({ 
    name: '', 
    unit: 'roll',
    roll_width: '3.2', 
    roll_height: '50', 
    unit_cost: '1200', 
    qty_rolls: '1' 
  })
  const [editForm, setEditForm] = useState({ 
    name: '', 
    unit: 'roll',
    roll_width: '', 
    roll_height: '', 
    unit_cost: '',
    qty_rolls: ''
  })
  const [stockForm, setStockForm] = useState({ qty: '5', cost: '', notes: '' })
  const [adjustForm, setAdjustForm] = useState<{
    type: 'deduct_waste' | 'recount' | 'correction'
    mode: 'qty' | 'dimensions'
    qty: string
    w_m: string
    h_m: string
    notes: string
  }>({
    type: 'deduct_waste',
    mode: 'qty',
    qty: '0.5',
    w_m: '',
    h_m: '',
    notes: ''
  })

  // Executive KPI summary calculations
  const stats = useMemo(() => {
    let totalRolls = 0
    let totalArea = 0
    let totalValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    materials.forEach(m => {
      const rolls = Number(m.qty_rolls) || 0
      const width = Number(m.roll_width) || 0
      const length = Number(m.roll_height ?? m.roll_length) || 0
      const cost = Number(m.unit_cost) || 0

      totalRolls += rolls
      totalArea += rolls * width * length
      totalValue += rolls * cost

      if (rolls <= 0) {
        outOfStockCount++
      } else if (rolls <= 1) {
        lowStockCount++
      }
    })

    return {
      totalMaterials: materials.length,
      totalRolls,
      totalArea,
      totalValue,
      lowStockCount,
      outOfStockCount,
      healthyCount: materials.length - lowStockCount - outOfStockCount
    }
  }, [materials])

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // Search filter
      const q = search.toLowerCase().trim()
      const matchesSearch = !q || 
        m.name.toLowerCase().includes(q) ||
        `${m.roll_width}`.includes(q) ||
        `${m.roll_height ?? m.roll_length ?? ''}`.includes(q)

      if (!matchesSearch) return false

      // Status filter
      const rolls = Number(m.qty_rolls) || 0
      if (statusFilter === 'in_stock' && rolls <= 1) return false
      if (statusFilter === 'low_stock' && (rolls <= 0 || rolls > 1)) return false
      if (statusFilter === 'out_of_stock' && rolls > 0) return false

      // Category filter
      const nameLower = m.name.toLowerCase()
      if (categoryFilter === 'flexi' && !nameLower.includes('flexi')) return false
      if (categoryFilter === 'sav' && !nameLower.includes('sav') && !nameLower.includes('vinyl')) return false
      if (categoryFilter === 'other' && (nameLower.includes('flexi') || nameLower.includes('sav') || nameLower.includes('vinyl'))) return false

      return true
    })
  }, [materials, search, statusFilter, categoryFilter])

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const q = logSearch.toLowerCase().trim()
      const matchesQuery = !q ||
        (l.materials?.name && l.materials.name.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q)) ||
        (l.jobs?.job_number && l.jobs.job_number.toLowerCase().includes(q)) ||
        (l.jobs?.customer_name && l.jobs.customer_name.toLowerCase().includes(q))

      if (!matchesQuery) return false

      if (logActionFilter !== 'all' && l.action !== logActionFilter) return false

      return true
    })
  }, [logs, logSearch, logActionFilter])

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await createMaterialAction(addForm)
      if (res.error) {
        toast.error(res.error)
      } else {
        const stampedAt = res.data?.created_at || new Date().toISOString()
        toast.success(
          `Material "${addForm.name}" added on ${formatDateStamp(stampedAt)} at ${formatTimeStamp(stampedAt)}`
        )
        setIsAddOpen(false)
        setAddForm({ name: '', unit: 'roll', roll_width: '3.2', roll_height: '50', unit_cost: '1200', qty_rolls: '1' })
        // Append newly created material optimistically with guaranteed timestamps
        if (res.data) {
          const itemWithStamp = {
            ...res.data,
            created_at: res.data.created_at || stampedAt,
            updated_at: res.data.updated_at || stampedAt,
          }
          setMaterials(prev => [...prev, itemWithStamp].sort((a, b) => a.name.localeCompare(b.name)))
        }
        if ((res as any).log) {
          setLogs(prev => [(res as any).log, ...prev])
        }
      }
    } catch {
      toast.error('Failed to create material')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (m: Material) => {
    setSelectedMaterial(m)
    setEditForm({
      name: m.name,
      unit: m.unit || 'roll',
      roll_width: String(m.roll_width),
      roll_height: String(m.roll_height ?? m.roll_length ?? ''),
      unit_cost: String(m.unit_cost),
      qty_rolls: String(m.qty_rolls || 0)
    })
    setIsEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMaterial) return
    setIsSubmitting(true)
    try {
      const res = await updateMaterialAction(selectedMaterial.id, editForm)
      if (res.error) {
        toast.error(res.error)
      } else {
        const stampedAt = (res as any).updatedAt || new Date().toISOString()
        toast.success('Material details updated successfully')
        setMaterials(prev => prev.map(m => m.id === selectedMaterial.id ? {
          ...m,
          name: editForm.name.trim(),
          unit: editForm.unit,
          roll_width: parseFloat(editForm.roll_width),
          roll_height: parseFloat(editForm.roll_height),
          roll_length: parseFloat(editForm.roll_height),
          unit_cost: parseFloat(editForm.unit_cost),
          qty_rolls: editForm.qty_rolls ? parseFloat(editForm.qty_rolls) : m.qty_rolls,
          updated_at: stampedAt
        } : m))
        setIsEditOpen(false)
      }
    } catch {
      toast.error('Failed to update material')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenStock = (m: Material) => {
    setSelectedMaterial(m)
    setStockForm({ qty: m.unit === 'sheet' ? '10' : '5', cost: String(m.unit_cost || ''), notes: '' })
    setIsStockOpen(true)
  }

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMaterial) return
    setIsSubmitting(true)
    try {
      const qty = parseFloat(stockForm.qty)
      const cost = parseFloat(stockForm.cost)
      const res = await addStockAction(selectedMaterial.id, qty, cost, stockForm.notes)
      if (res.error) {
        toast.error(res.error)
      } else {
        const stampedAt = (res as any).updatedAt || new Date().toISOString()
        const u = getUnitLabels(selectedMaterial.unit)
        toast.success(
          `Added ${qty} ${u.plural} to ${selectedMaterial.name} (${formatDateStamp(stampedAt)} • ${formatTimeStamp(stampedAt)})`
        )
        // Update local material state
        setMaterials(prev => prev.map(m => {
          if (m.id !== selectedMaterial.id) return m
          const currentQty = Number(m.qty_rolls) || 0
          const currentCost = Number(m.unit_cost) || 0
          const newQty = currentQty + qty
          const newCost = newQty > 0 ? ((currentQty * currentCost) + (qty * cost)) / newQty : cost
          return { ...m, qty_rolls: newQty, unit_cost: newCost, updated_at: stampedAt }
        }))
        if ((res as any).log) {
          setLogs(prev => [(res as any).log, ...prev])
        }
        setIsStockOpen(false)
      }
    } catch {
      toast.error('Failed to add stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenAdjust = (m: Material) => {
    setSelectedMaterial(m)
    setAdjustForm({
      type: 'deduct_waste',
      mode: 'qty',
      qty: m.unit === 'sheet' ? '1' : '0.5',
      w_m: String(m.roll_width || ''),
      h_m: '1',
      notes: ''
    })
    setIsAdjustOpen(true)
  }

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMaterial) return
    setIsSubmitting(true)
    try {
      let dimensions: { width: number; height: number } | undefined
      let qty = parseFloat(adjustForm.qty)

      if (adjustForm.mode === 'dimensions' && adjustForm.type === 'deduct_waste') {
        const w = parseFloat(adjustForm.w_m)
        const h = parseFloat(adjustForm.h_m)
        if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
          toast.error('Please enter valid width and height in meters')
          setIsSubmitting(false)
          return
        }
        dimensions = { width: w, height: h }
        const unitArea = (selectedMaterial.roll_width || 1) * ((selectedMaterial.roll_height ?? selectedMaterial.roll_length) || 1)
        qty = (w * h) / (unitArea > 0 ? unitArea : 1)
      }

      const res = await adjustStockAction(
        selectedMaterial.id, 
        adjustForm.type, 
        qty, 
        adjustForm.notes,
        dimensions
      )
      if (res.error) {
        toast.error(res.error)
      } else {
        const stampedAt = (res as any).updatedAt || new Date().toISOString()
        toast.success(`Stock adjustment recorded (${formatDateStamp(stampedAt)} • ${formatTimeStamp(stampedAt)})`)
        setMaterials(prev => prev.map(m => {
          if (m.id !== selectedMaterial.id) return m
          let newQty = m.qty_rolls
          if (adjustForm.type === 'deduct_waste' || adjustForm.type === 'correction') {
            newQty = Math.max(0, m.qty_rolls - qty)
          } else if (adjustForm.type === 'recount') {
            newQty = qty
          }
          return { ...m, qty_rolls: newQty, updated_at: stampedAt }
        }))
        if ((res as any).log) {
          setLogs(prev => [(res as any).log, ...prev])
        }
        setIsAdjustOpen(false)
      }
    } catch {
      toast.error('Failed to adjust stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDelete = (m: Material) => {
    setSelectedMaterial(m)
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedMaterial) return
    setIsSubmitting(true)
    try {
      const res = await deleteMaterialAction(selectedMaterial.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Material "${selectedMaterial.name}" removed`)
        setMaterials(prev => prev.filter(m => m.id !== selectedMaterial.id))
        setIsDeleteOpen(false)
      }
    } catch {
      toast.error('Failed to delete material')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Link product type to material
  const handleLinkProductType = async (productTypeId: string, materialId: string | null) => {
    try {
      const res = await linkProductTypeToMaterialAction(productTypeId, materialId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Product link updated')
        setProductTypes(prev => prev.map(pt => pt.id === productTypeId ? { ...pt, material_id: materialId } : pt))
      }
    } catch {
      toast.error('Failed to update product link')
    }
  }

  // Auto-match product types to materials by substrate family & name keywords
  const handleAutoMatch = async () => {
    setIsSubmitting(true)
    let matchCount = 0
    const updatedLinks: Record<string, string> = {}

    try {
      for (const pt of productTypes) {
        if (!pt.material_id) {
          const rec = recommendMaterialForJob(
            {
              width: 1,
              height: 1,
              quantity: 1,
              dimension_unit: 'm',
              product_type_id: pt.id,
              product_types: { name: pt.name, material_id: null },
            },
            materials
          )
          if (rec.recommendedMaterial) {
            const res = await linkProductTypeToMaterialAction(pt.id, rec.recommendedMaterial.id)
            if (!res.error) {
              updatedLinks[pt.id] = rec.recommendedMaterial.id
              matchCount++
            }
          }
        }
      }

      if (matchCount > 0) {
        setProductTypes(prev =>
          prev.map(pt => (updatedLinks[pt.id] ? { ...pt, material_id: updatedLinks[pt.id] } : pt))
        )
        toast.success(`Smart-linked ${matchCount} product types to their matching warehouse roll families!`)
      } else {
        toast.info('All compatible product types are already linked to material rolls.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Detect rolls whose width in DB was accidentally entered as 50m instead of 3FT / 4FT / 5FT
  const misconfiguredRolls = useMemo(() => {
    return materials.filter(m => parseRollDimensions(m).isWidthMisconfiguredInDb)
  }, [materials])

  const handleNormalizeRollDimensions = async () => {
    setIsSubmitting(true)
    try {
      const res = await normalizeRollDimensionsAction()
      if (res.error) {
        toast.error(res.error)
      } else if (res.updatedMaterials && res.updatedMaterials.length > 0) {
        const map = new Map(res.updatedMaterials.map((u: any) => [u.id, u]))
        setMaterials(prev =>
          prev.map(m => {
            const u = map.get(m.id)
            return u
              ? {
                  ...m,
                  roll_width: u.roll_width,
                  roll_length: u.roll_length,
                  roll_height: u.roll_length,
                  updated_at: u.updated_at,
                }
              : m
          })
        )
        toast.success(`Normalized roll widths for ${res.fixedCount} rolls (3FT → 0.91m, 4FT → 1.22m, 5FT → 1.52m)!`)
      } else {
        toast.info('All roll dimensions are already normalized.')
      }
    } catch {
      toast.error('Failed to normalize roll dimensions')
    } finally {
      setIsSubmitting(false)
    }
  }

  // CSV Export for Accountant / Admin reporting
  const handleExportCSV = () => {
    const headers = ['Material Name', 'Roll Width (m)', 'Roll Height (m)', 'Area per Roll (m²)', 'Rolls in Stock', 'Total Usable Area (m²)', 'Unit Cost (GHS)', 'Total Valuation (GHS)', 'Date Added', 'Time Added', 'Last Updated']
    const rows = materials.map(m => {
      const rollArea = m.roll_width * (m.roll_height ?? m.roll_length ?? 0)
      const totalArea = rollArea * m.qty_rolls
      const totalVal = m.qty_rolls * m.unit_cost
      return [
        `"${m.name}"`,
        m.roll_width,
        m.roll_height ?? m.roll_length,
        rollArea.toFixed(2),
        m.qty_rolls.toFixed(2),
        totalArea.toFixed(2),
        m.unit_cost.toFixed(2),
        totalVal.toFixed(2),
        `"${formatDateStamp(m.created_at)}"`,
        `"${formatTimeStamp(m.created_at)}"`,
        `"${m.updated_at ? `${formatDateStamp(m.updated_at)} ${formatTimeStamp(m.updated_at)}` : '—'}"`
      ]
    })
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `PrintDPI_Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Inventory report exported as CSV')
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl shadow-xs border border-indigo-100">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Material Inventory & Media Stock</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Track warehouse roll stock, square meterage, financial valuations, and automatic job deductions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {misconfiguredRolls.length > 0 && (
            <Button
              variant="outline"
              onClick={handleNormalizeRollDimensions}
              loading={isSubmitting}
              className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold shadow-xs"
            >
              <Ruler className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Fix {misconfiguredRolls.length} Roll Widths (3FT / 4FT / 5FT)
            </Button>
          )}

          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Export CSV
          </Button>

          <Button 
            onClick={() => setIsAddOpen(true)} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold text-xs px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add New Material
          </Button>
        </div>
      </div>

      {/* Banner if SAV or Flexi rolls have 50m x 50m width instead of 3FT / 4FT / 5FT */}
      {misconfiguredRolls.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-amber-950">
                Detected {misconfiguredRolls.length} Roll(s) with Width Entered as 50m Instead of Roll Width (3FT / 4FT / 5FT)
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Rolls such as <strong>{misconfiguredRolls.slice(0, 3).map(m => m.name).join(', ')}</strong> currently have width set to 50m (2500 m²/roll). PrintFlow automatically reads their true feet width during job deductions, or you can click to permanently fix their stored roll widths now.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleNormalizeRollDimensions}
            loading={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
          >
            Normalize Roll Widths Now
          </Button>
        </div>
      )}

      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Total Valuation */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-indigo-800/40 relative overflow-hidden">
          <div className="absolute -right-3 -bottom-3 opacity-10">
            <Boxes className="w-24 h-24 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200/90 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Stock Asset Valuation
          </p>
          <h2 className="text-2xl lg:text-3xl font-extrabold mt-2 tracking-tight">
            {formatCurrency(stats.totalValue)}
          </h2>
          <p className="text-xs text-indigo-200/70 mt-1.5 flex items-center gap-1">
            Across {stats.totalMaterials} active media roll types
          </p>
        </div>

        {/* KPI 2: Total Rolls */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Warehouse Rolls</p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {stats.totalRolls.toFixed(2)} <span className="text-sm font-medium text-slate-500">rolls</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Average {(stats.totalRolls / (stats.totalMaterials || 1)).toFixed(1)} rolls per material
          </p>
        </div>

        {/* KPI 3: Usable Area */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Usable Media Area</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Ruler className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {stats.totalArea.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm font-medium text-slate-500">m²</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Square meterage ready for print runs
          </p>
        </div>

        {/* KPI 4: Stock Alerts */}
        <div className={cn(
          "rounded-2xl p-5 border shadow-xs relative overflow-hidden transition-all",
          (stats.lowStockCount > 0 || stats.outOfStockCount > 0)
            ? "bg-amber-50/60 border-amber-200"
            : "bg-emerald-50/60 border-emerald-200"
        )}>
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              (stats.lowStockCount > 0 || stats.outOfStockCount > 0) ? "text-amber-800" : "text-emerald-800"
            )}>
              Stock Health Status
            </p>
            <div className={cn(
              "p-2 rounded-xl",
              (stats.lowStockCount > 0 || stats.outOfStockCount > 0) ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            )}>
              {(stats.lowStockCount > 0 || stats.outOfStockCount > 0) ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>

          <h2 className={cn(
            "text-2xl lg:text-3xl font-extrabold mt-2 tracking-tight",
            (stats.lowStockCount > 0 || stats.outOfStockCount > 0) ? "text-amber-900" : "text-emerald-900"
          )}>
            {stats.lowStockCount + stats.outOfStockCount > 0 ? (
              <span>{stats.lowStockCount + stats.outOfStockCount} <span className="text-sm font-medium text-amber-800">Alerts</span></span>
            ) : (
              <span>100% <span className="text-sm font-medium text-emerald-800">Healthy</span></span>
            )}
          </h2>

          <p className={cn(
            "text-xs mt-1.5",
            (stats.lowStockCount > 0 || stats.outOfStockCount > 0) ? "text-amber-800/90 font-medium" : "text-emerald-800/90 font-medium"
          )}>
            {stats.outOfStockCount > 0 && `${stats.outOfStockCount} depleted • `}
            {stats.lowStockCount > 0 ? `${stats.lowStockCount} below 1 roll` : 'All materials well stocked'}
          </p>
        </div>
      </div>

      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('inventory')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'inventory' 
                ? "bg-white text-indigo-700 shadow-xs font-semibold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Boxes className="w-4 h-4" />
            Media Inventory
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
              activeTab === 'inventory' ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
            )}>
              {materials.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'logs' 
                ? "bg-white text-indigo-700 shadow-xs font-semibold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <History className="w-4 h-4" />
            Movement & Usage Logs
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
              activeTab === 'logs' ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
            )}>
              {logs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('linking')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'linking' 
                ? "bg-white text-indigo-700 shadow-xs font-semibold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Link2 className="w-4 h-4" />
            Product Deductions
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
              activeTab === 'linking' ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
            )}>
              {productTypes.filter(p => p.material_id).length}/{productTypes.length}
            </span>
          </button>
        </div>

        {/* View Mode Toggle (Grid vs Table) for Inventory tab */}
        {activeTab === 'inventory' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'grid' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'table' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: MATERIAL INVENTORY                                    */}
      {/* ============================================================ */}
      {activeTab === 'inventory' && (
        <div className="space-y-5">
          {/* Search, Status & Category Filters */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            {/* Search input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by material name, roll width (e.g. Flexi, 3.2m, SAV)..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">Media:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'flexi', label: 'Flexi' },
                { id: 'sav', label: 'SAV / Vinyl' },
                { id: 'other', label: 'Other' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    categoryFilter === cat.id 
                      ? "bg-indigo-600 text-white shadow-xs" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Stock Level Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar border-t lg:border-t-0 pt-2 lg:pt-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">Stock:</span>
              {[
                { id: 'all', label: 'All Levels' },
                { id: 'in_stock', label: 'In Stock' },
                { id: 'low_stock', label: 'Low (≤1)' },
                { id: 'out_of_stock', label: 'Depleted' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    statusFilter === st.id 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results count indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{filteredMaterials.length}</strong> of {materials.length} material rolls
            </span>
            {(search || statusFilter !== 'all' || categoryFilter !== 'all') && (
              <button 
                onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all') }}
                className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Empty State */}
          {filteredMaterials.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Package className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {search || statusFilter !== 'all' ? 'No matching materials found' : 'No material rolls configured'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search query or reset your filters to see all warehouse rolls.'
                  : 'Start tracking printing roll inventory (Flexi, SAV, One-Way Vision, Paper) with automated usage deductions.'}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                {search || statusFilter !== 'all' ? (
                  <Button 
                    variant="outline" 
                    onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all') }}
                    className="text-xs"
                  >
                    Clear Filters
                  </Button>
                ) : (
                  <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First Material
                  </Button>
                )}
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* ======================================= */
            /* GRID CARDS VIEW                         */
            /* ======================================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMaterials.map(m => {
                const rolls = Number(m.qty_rolls) || 0
                const width = Number(m.roll_width) || 0
                const length = Number(m.roll_height ?? m.roll_length) || 0
                const cost = Number(m.unit_cost) || 0

                const rollArea = width * length
                const totalArea = rollArea * rolls
                const stockVal = rolls * cost

                const isDepleted = rolls <= 0
                const isLow = rolls > 0 && rolls <= 1.0
                const uLabels = getUnitLabels(m.unit)

                return (
                  <div 
                    key={m.id} 
                    className={cn(
                      "group bg-white rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden relative",
                      isDepleted 
                        ? "border-rose-200/80 shadow-xs" 
                        : isLow 
                          ? "border-amber-200 shadow-xs" 
                          : "border-slate-200/80 shadow-xs hover:border-indigo-200"
                    )}
                  >
                    {/* Top colored status stripe */}
                    <div className={cn(
                      "h-1.5 w-full",
                      isDepleted ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500"
                    )} />

                    <div className="p-5 flex-1">
                      {/* Material Header */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {m.name}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                            <Ruler className="w-3.5 h-3.5 text-slate-400" />
                            {m.roll_width}m × {m.roll_height ?? m.roll_length}m {uLabels.cardSubtext} ({rollArea.toFixed(1)} m²/{uLabels.singular})
                          </p>
                        </div>

                        {/* Top-Right Actions & Status */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Quick Edit/Delete Header Buttons */}
                          <div className="flex items-center bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/70">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenEdit(m); }}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                              title="Edit Material"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenDelete(m); }}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded transition-colors"
                              title="Delete Material"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Status badge */}
                          <div className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1",
                            isDepleted 
                              ? "bg-rose-50 text-rose-700 border border-rose-200" 
                              : isLow 
                                ? "bg-amber-50 text-amber-700 border border-amber-200" 
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          )}>
                            {isDepleted ? (
                              <>
                                <AlertCircle className="w-3 h-3 text-rose-600" /> Out
                              </>
                            ) : isLow ? (
                              <>
                                <AlertTriangle className="w-3 h-3 text-amber-600" /> Low
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> In Stock
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stock Level Display */}
                      <div className="my-4 bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              {uLabels.warehouseLabel}
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className={cn(
                                "text-2xl font-black tracking-tight",
                                isDepleted ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                              )}>
                                {rolls.toFixed(2)}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">{uLabels.plural}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              Usable Area
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-bold text-slate-800">
                                {totalArea.toFixed(1)}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">m²</span>
                            </div>
                          </div>
                        </div>

                        {/* Visual fill meter */}
                        <div className="space-y-1">
                          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isDepleted ? "bg-rose-500 w-0" : isLow ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, Math.max(5, (rolls / 5) * 100))}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span>0 {uLabels.plural}</span>
                            <span>{uLabels.target}</span>
                          </div>
                        </div>
                      </div>

                      {/* Valuation & Cost footer */}
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Unit Cost</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(cost)} {uLabels.perUnit}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Value</span>
                          <span className="font-bold text-indigo-700 text-sm">{formatCurrency(stockVal)}</span>
                        </div>
                      </div>

                      {/* Date Stamp & Timestamp Footer */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Added</span>
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              <Calendar className="w-3 h-3 text-indigo-500" />
                              {formatDateStamp(m.created_at)}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              {formatTimeStamp(m.created_at)}
                            </span>
                          </div>
                        </div>
                        {m.updated_at && m.created_at && Math.abs(new Date(m.updated_at).getTime() - new Date(m.created_at).getTime()) > 5000 && (
                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                            <span className="uppercase font-semibold">Last Updated</span>
                            <span>{formatDateStamp(m.updated_at)} • {formatTimeStamp(m.updated_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Bottom Bar */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => handleOpenStock(m)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex-1 h-8 shadow-xs"
                      >
                        <TrendingUp className="w-3.5 h-3.5 mr-1" /> Restock
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAdjust(m)}
                        className="border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs h-8 font-medium px-2.5"
                        title="Adjust, Record Waste or Recount"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-slate-500" /> Adjust
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(m)}
                        className="border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs h-8 font-medium px-2"
                        title="Edit Material Specifications"
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDelete(m)}
                        className="border-rose-100 bg-white hover:bg-rose-50 text-rose-600 text-xs h-8 font-medium px-2"
                        title="Delete Material"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ======================================= */
            /* TABLE VIEW (ACCOUNTANT & HIGH DENSITY)  */
            /* ======================================= */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Material Name</th>
                      <th className="py-3.5 px-4">Roll Specs</th>
                      <th className="py-3.5 px-4">Rolls in Stock</th>
                      <th className="py-3.5 px-4">Available Area</th>
                      <th className="py-3.5 px-4">Unit Cost</th>
                      <th className="py-3.5 px-4">Asset Valuation</th>
                      <th className="py-3.5 px-4">Added (Date & Time)</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaterials.map(m => {
                      const rolls = Number(m.qty_rolls) || 0
                      const width = Number(m.roll_width) || 0
                      const length = Number(m.roll_height ?? m.roll_length) || 0
                      const cost = Number(m.unit_cost) || 0

                      const rollArea = width * length
                      const totalArea = rollArea * rolls
                      const stockVal = rolls * cost

                      const isDepleted = rolls <= 0
                      const isLow = rolls > 0 && rolls <= 1.0

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {m.name}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {m.roll_width}m × {m.roll_height ?? m.roll_length}m <span className="text-slate-400">({rollArea.toFixed(1)} m²)</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "font-black text-sm",
                              isDepleted ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                            )}>
                              {rolls.toFixed(2)}
                            </span>
                            <span className="text-slate-400 ml-1">rolls</span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {totalArea.toFixed(1)} m²
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {formatCurrency(cost)}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-indigo-700">
                            {formatCurrency(stockVal)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[11px]">
                                <Calendar className="w-3 h-3 text-indigo-500" />
                                {formatDateStamp(m.created_at)}
                              </div>
                              <div className="flex items-center gap-1.5 text-indigo-600 font-medium text-[11px]">
                                <Clock className="w-3 h-3 text-indigo-400" />
                                {formatTimeStamp(m.created_at)}
                              </div>
                              {m.updated_at && m.created_at && Math.abs(new Date(m.updated_at).getTime() - new Date(m.created_at).getTime()) > 5000 && (
                                <span className="text-[10px] text-slate-400">
                                  Upd: {formatDateStamp(m.updated_at)} {formatTimeStamp(m.updated_at)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1",
                              isDepleted 
                                ? "bg-rose-50 text-rose-700 border border-rose-200" 
                                : isLow 
                                  ? "bg-amber-50 text-amber-700 border border-amber-200" 
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            )}>
                              {isDepleted ? 'Depleted' : isLow ? 'Low Stock' : 'Healthy'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleOpenStock(m)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-7 px-2.5 shadow-xs"
                              >
                                Restock
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAdjust(m)}
                                className="border-slate-200 text-slate-700 h-7 px-2 text-xs"
                                title="Adjust Stock"
                              >
                                Adjust
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEdit(m)}
                                className="border-slate-200 text-slate-600 h-7 w-7 p-0"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenDelete(m)}
                                className="border-rose-100 hover:bg-rose-50 text-rose-600 h-7 w-7 p-0"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MOVEMENT & AUDIT LOGS                                 */}
      {/* ============================================================ */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Logs Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search audit logs by material, job number, customer, or notes..." 
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
              />
              {logSearch && (
                <button 
                  onClick={() => setLogSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">Action:</span>
              {[
                { id: 'all', label: 'All Events' },
                { id: 'add_stock', label: 'Restock (+)' },
                { id: 'job_deduction', label: 'Job Prints (-)' },
                { id: 'deduct_waste', label: 'Waste (-)' },
                { id: 'recount', label: 'Recounts' },
              ].map(act => (
                <button
                  key={act.id}
                  onClick={() => setLogActionFilter(act.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    logActionFilter === act.id 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logs Table */}
          {filteredLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
              <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No stock movement logs found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {logSearch ? 'No logs match your search keywords.' : 'All stock additions, job deductions, and physical audits will be recorded here.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Date & Time</th>
                      <th className="py-3.5 px-4">Action Type</th>
                      <th className="py-3.5 px-4">Material</th>
                      <th className="py-3.5 px-4">Quantity Change</th>
                      <th className="py-3.5 px-4">Area Impact</th>
                      <th className="py-3.5 px-4">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(log => {
                      const isPositive = log.qty_change_rolls > 0
                      const isZero = log.qty_change_rolls === 0
                      
                      let badgeStyle = "bg-slate-100 text-slate-700"
                      let badgeLabel = log.action

                      if (log.action === 'add_stock') {
                        badgeStyle = "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        badgeLabel = "Stock Restocked"
                      } else if (log.action === 'job_deduction') {
                        badgeStyle = "bg-blue-50 text-blue-700 border border-blue-200"
                        badgeLabel = "Job Completed"
                      } else if (log.action === 'deduct_waste') {
                        badgeStyle = "bg-rose-50 text-rose-700 border border-rose-200"
                        badgeLabel = "Waste / Damage"
                      } else if (log.action === 'recount') {
                        badgeStyle = "bg-amber-50 text-amber-700 border border-amber-200"
                        badgeLabel = "Audit Recount"
                      }

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                                <Calendar className="w-3 h-3 text-indigo-500" />
                                {formatDateStamp(log.created_at)}
                              </span>
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                                <Clock className="w-3 h-3 text-indigo-500" />
                                {formatTimeStamp(log.created_at)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1", badgeStyle)}>
                              {isPositive ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownRight className="w-3 h-3 text-slate-500" />}
                              {badgeLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {log.materials?.name || 'Material ID: ' + log.material_id.slice(0, 8)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={cn(
                              "font-extrabold text-sm",
                              isPositive ? "text-emerald-600" : isZero ? "text-slate-600" : "text-rose-600"
                            )}>
                              {isPositive ? `+${log.qty_change_rolls.toFixed(2)}` : `${log.qty_change_rolls.toFixed(2)}`}
                            </span>
                            <span className="text-slate-400 ml-1">rolls</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 font-semibold whitespace-nowrap">
                            {log.qty_change_area !== 0 ? (
                              <span>
                                {log.qty_change_area > 0 ? `+${log.qty_change_area.toFixed(1)}` : log.qty_change_area.toFixed(1)} m²
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                            <div className="truncate">
                              {log.notes || '—'}
                              {log.jobs && (
                                <span className="ml-1 text-indigo-600 font-semibold">
                                  ({log.jobs.job_number} - {log.jobs.customer_name})
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: PRODUCT TYPE DEDUCTION LINKING                        */}
      {/* ============================================================ */}
      {activeTab === 'linking' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl mt-0.5 shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-950">
                  Smart Print Room Roll Matching & Automated Inventory Deductions
                </h3>
                <p className="text-xs text-indigo-800/80 mt-0.5">
                  Products are matched to their substrate family (e.g. <strong>Flexi / Pullup Flexy → FLEXI rolls</strong>, <strong>SAV / Sticker / Vinyl → SAV rolls</strong>). When a printer marks a job <strong>Completed</strong>, PrintFlow automatically picks the smallest roll width in stock (3FT, 4FT, 5FT, or 10FT) that fits the job and lets the printer confirm in one click.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleAutoMatch}
              loading={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shrink-0 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Smart Auto-Match All Products
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Product Catalog Item</th>
                    <th className="py-3.5 px-4">Detected Family & Compatible Widths</th>
                    <th className="py-3.5 px-4">Default Linked Roll</th>
                    <th className="py-3.5 px-4 text-right">Print Room Deduction Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productTypes.map(pt => {
                    const currentMaterial = materials.find(m => m.id === pt.material_id)
                    const rec = recommendMaterialForJob(
                      {
                        width: 1,
                        height: 1,
                        quantity: 1,
                        dimension_unit: 'm',
                        product_type_id: pt.id,
                        product_types: { name: pt.name, material_id: pt.material_id },
                      },
                      materials
                    )
                    const familyWidths = Array.from(
                      new Set(rec.familyCandidates.map(c => c.parsed.widthSummary))
                    )

                    return (
                      <tr key={pt.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{pt.name}</div>
                          <span className={cn(
                            "inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                            pt.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {pt.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{rec.familyLabel}</div>
                          {familyWidths.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                              {familyWidths.map(w => (
                                <span
                                  key={w}
                                  className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[10px] font-mono tabular-nums font-bold"
                                >
                                  {w}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">No matching roll family in stock</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={pt.material_id || ''}
                            onChange={e => handleLinkProductType(pt.id, e.target.value || null)}
                            className="w-full max-w-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                          >
                            <option value="">
                              {rec.recommendedMaterial
                                ? `— Smart Auto-Fit (${rec.familyLabel}: ${familyWidths.join(', ')}) —`
                                : '— No Material Linked (Manual Selection in Print Room) —'}
                            </option>
                            {materials.map(m => {
                              const parsed = parseRollDimensions(m)
                              return (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({parsed.widthSummary} × {parsed.effectiveLengthM}m • {Number(m.qty_rolls).toFixed(2)} rolls left)
                                </option>
                              )
                            })}
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {currentMaterial ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Linked to {currentMaterial.name}
                              </span>
                              {familyWidths.length > 1 && (
                                <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                                  + Auto-picks smallest fitting width ({familyWidths.join(' / ')})
                                </p>
                              )}
                            </div>
                          ) : rec.recommendedMaterial ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-indigo-700 font-bold text-xs">
                                <Sparkles className="w-3.5 h-3.5" /> Smart Family Match ({rec.familyLabel})
                              </span>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Auto-picks {familyWidths.join(' / ')} by job size
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-medium">
                              Printer selects roll on completion (if any)
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD NEW MATERIAL                                    */}
      {/* ============================================================ */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-600" /> Add New Inventory Material
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 flex items-center justify-between text-xs text-indigo-900">
              <span className="flex items-center gap-1.5 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                {formatDateStamp(new Date().toISOString())}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-indigo-700">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Auto-stamped with exact time added
              </span>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Substrate Form / Unit</Label>
              <select
                value={addForm.unit}
                onChange={e => setAddForm({ ...addForm, unit: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="roll">Roll Media (Flexi, SAV/Vinyl, Banner, Mesh, Canvas)</option>
                <option value="sheet">Rigid Sheet / Board (Foam Board, Acrylic, PVC, Coroplast)</option>
                <option value="piece">Item / Piece (Stands, Frames, Pre-cut units)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Material Name & Grade</Label>
              <input 
                required 
                value={addForm.name} 
                onChange={e => setAddForm({ ...addForm, name: e.target.value })} 
                placeholder={addForm.unit === 'sheet' ? "e.g. Foam Board 5mm, Acrylic 3mm" : "e.g. Flexi - Matte 3.2m, SAV - Glossy 1.5m"} 
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">
                  {addForm.unit === 'sheet' ? 'Sheet Width (m)' : addForm.unit === 'piece' ? 'Item Width (m)' : 'Roll Width (m)'}
                </Label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  value={addForm.roll_width} 
                  onChange={e => setAddForm({ ...addForm, roll_width: e.target.value })} 
                  placeholder={addForm.unit === 'sheet' ? "1.22" : "3.2"} 
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700">
                  {addForm.unit === 'sheet' ? 'Sheet Height (m)' : addForm.unit === 'piece' ? 'Item Height (m)' : 'Roll Height / Length (m)'}
                </Label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  value={addForm.roll_height} 
                  onChange={e => setAddForm({ ...addForm, roll_height: e.target.value })} 
                  placeholder={addForm.unit === 'sheet' ? "2.44" : "50"} 
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                />
              </div>
            </div>

            {/* Calculated Area Preview */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                Single {addForm.unit === 'sheet' ? 'Sheet' : addForm.unit === 'piece' ? 'Item' : 'Roll'} Media Area:
              </span>
              <strong className="text-indigo-700 font-bold">
                {((parseFloat(addForm.roll_width) || 0) * (parseFloat(addForm.roll_height) || 0)).toFixed(2)} m²
              </strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">
                  Opening Stock ({getUnitLabels(addForm.unit).plural})
                </Label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={addForm.qty_rolls} 
                  onChange={e => setAddForm({ ...addForm, qty_rolls: e.target.value })} 
                  placeholder="1" 
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700">
                  Cost per {getUnitLabels(addForm.unit).singular} (GHS)
                </Label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={addForm.unit_cost} 
                  onChange={e => setAddForm({ ...addForm, unit_cost: e.target.value })} 
                  placeholder="1200.00" 
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                />
              </div>
            </div>

            <DialogFooter className="mt-4 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs">
                {isSubmitting ? 'Creating...' : 'Create Material'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 2: RESTOCK / ADD STOCK                                */}
      {/* ============================================================ */}
      <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
        <DialogContent className="max-w-md">
          {(() => {
            const u = getUnitLabels(selectedMaterial?.unit)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" /> Restock: {selectedMaterial?.name}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleAddStock} className="space-y-4 mt-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Stock</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {Number(selectedMaterial?.qty_rolls || 0).toFixed(2)} {u.plural}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Average Cost</span>
                      <span className="font-bold text-slate-700 text-sm">
                        {formatCurrency(Number(selectedMaterial?.unit_cost || 0))} {u.perUnit}
                      </span>
                    </div>
                  </div>

                  <p className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs leading-5 text-indigo-800">
                    The date and time this stock is recorded will be saved automatically in Stock Movement History.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-slate-700">{u.addStockLabel}</Label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={stockForm.qty} 
                        onChange={e => setStockForm({ ...stockForm, qty: e.target.value })} 
                        placeholder={u.type === 'sheet' ? "10" : "5"} 
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700">Cost per {u.singular} (GHS)</Label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={stockForm.cost} 
                        onChange={e => setStockForm({ ...stockForm, cost: e.target.value })} 
                        placeholder="1350.00" 
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                  </div>

                  {/* Total invoice purchase value */}
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-800 font-medium">Batch Purchase Value:</span>
                    <strong className="text-emerald-900 font-bold">
                      {formatCurrency((parseFloat(stockForm.qty) || 0) * (parseFloat(stockForm.cost) || 0))}
                    </strong>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-slate-700">Vendor / Invoice Reference (Optional)</Label>
                    <input 
                      value={stockForm.notes} 
                      onChange={e => setStockForm({ ...stockForm, notes: e.target.value })} 
                      placeholder="e.g. Supplier: Graphic Supplies Ltd, Invoice #4829" 
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                    />
                  </div>

                  <DialogFooter className="mt-4 pt-3 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsStockOpen(false)} disabled={isSubmitting} className="text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
                      {isSubmitting ? 'Recording...' : 'Confirm Restock'}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 3: ADJUST / RECORD SPOILAGE / RECOUNT                 */}
      {/* ============================================================ */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="max-w-md">
          {(() => {
            const u = getUnitLabels(selectedMaterial?.unit)
            const unitArea = (selectedMaterial?.roll_width || 1) * ((selectedMaterial?.roll_height ?? selectedMaterial?.roll_length) || 1)
            const wVal = parseFloat(adjustForm.w_m) || 0
            const hVal = parseFloat(adjustForm.h_m) || 0
            const wastedAreaPreview = wVal * hVal
            const equivalentDeduction = unitArea > 0 ? (wastedAreaPreview / unitArea) : 0

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-amber-600" /> Stock Adjustment: {selectedMaterial?.name}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleAdjustStock} className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs font-bold text-slate-700">Adjustment Type</Label>
                    <select
                      value={adjustForm.type}
                      onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="deduct_waste">Deduct Damaged / Wasted {u.cardSubtext} (-)</option>
                      <option value="recount">Physical Audit Recount (Set exact remaining)</option>
                      <option value="correction">Manual Count Correction (-)</option>
                    </select>
                  </div>

                  {/* Mode Selector for Spoilage / Waste */}
                  {adjustForm.type === 'deduct_waste' && (
                    <div className="p-1 bg-slate-100 rounded-xl flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAdjustForm({ ...adjustForm, mode: 'qty' })}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                          adjustForm.mode === 'qty' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        By {u.plural} Count
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustForm({ ...adjustForm, mode: 'dimensions' })}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                          adjustForm.mode === 'dimensions' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        By Wasted Width & Height
                      </button>
                    </div>
                  )}

                  {/* Dimension inputs if Mode is Dimensions */}
                  {adjustForm.type === 'deduct_waste' && adjustForm.mode === 'dimensions' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-bold text-slate-700">Wasted Width (m)</Label>
                          <input 
                            required 
                            type="number" 
                            step="0.01" 
                            value={adjustForm.w_m} 
                            onChange={e => setAdjustForm({ ...adjustForm, w_m: e.target.value })} 
                            placeholder={String(selectedMaterial?.roll_width || 3.2)} 
                            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-700">Wasted Height (m)</Label>
                          <input 
                            required 
                            type="number" 
                            step="0.01" 
                            value={adjustForm.h_m} 
                            onChange={e => setAdjustForm({ ...adjustForm, h_m: e.target.value })} 
                            placeholder="1.5" 
                            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                      </div>

                      {/* Live Area calculation box */}
                      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between items-center text-amber-900 font-semibold">
                          <span>Wasted Surface Area:</span>
                          <span className="font-bold">{wastedAreaPreview.toFixed(2)} m²</span>
                        </div>
                        <div className="flex justify-between items-center text-amber-700">
                          <span>Auto-calculated deduction:</span>
                          <span className="font-bold text-amber-900">{equivalentDeduction.toFixed(3)} {u.plural}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs font-bold text-slate-700">
                        {adjustForm.type === 'recount' ? `Actual Count of ${u.plural}` : `${u.plural} to Deduct`}
                      </Label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={adjustForm.qty} 
                        onChange={e => setAdjustForm({ ...adjustForm, qty: e.target.value })} 
                        placeholder={u.type === 'sheet' ? "1" : "0.5"} 
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Current record: {Number(selectedMaterial?.qty_rolls || 0).toFixed(2)} {u.plural}
                      </span>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-bold text-slate-700">Reason / Accountability Note *</Label>
                    <textarea 
                      required
                      rows={3}
                      value={adjustForm.notes} 
                      onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })} 
                      placeholder={u.type === 'sheet' 
                        ? "e.g. Sheet cracked during transport to cutting room; audit recount found 8 sheets remaining."
                        : "e.g. Roll damaged due to paper jam in Print Room 1; physical monthly audit found 4.2 rolls remaining."
                      } 
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                    />
                  </div>

                  <DialogFooter className="mt-4 pt-3 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsAdjustOpen(false)} disabled={isSubmitting} className="text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs">
                      {isSubmitting ? 'Saving...' : 'Record Adjustment'}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 4: EDIT MATERIAL DETAILS                               */}
      {/* ============================================================ */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          {(() => {
            const u = getUnitLabels(editForm.unit)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-indigo-600" /> Edit Material Specifications
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleUpdate} className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs font-bold text-slate-700">Substrate Form / Unit</Label>
                    <select
                      value={editForm.unit}
                      onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="roll">Roll Media (Flexi, SAV/Vinyl, Banner, Mesh, Canvas)</option>
                      <option value="sheet">Rigid Sheet / Board (Foam Board, Acrylic, PVC, Coroplast)</option>
                      <option value="piece">Item / Piece (Stands, Frames, Pre-cut units)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-slate-700">Material Name</Label>
                    <input 
                      required 
                      value={editForm.name} 
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-slate-700">{u.dimWidth} (m)</Label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={editForm.roll_width} 
                        onChange={e => setEditForm({ ...editForm, roll_width: e.target.value })} 
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700">{u.dimHeight} (m)</Label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={editForm.roll_height} 
                        onChange={e => setEditForm({ ...editForm, roll_height: e.target.value })} 
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-slate-700">Warehouse Stock ({u.plural})</Label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editForm.qty_rolls} 
                        onChange={e => setEditForm({ ...editForm, qty_rolls: e.target.value })} 
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700">Cost per {u.singular} (GHS)</Label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={editForm.unit_cost} 
                        onChange={e => setEditForm({ ...editForm, unit_cost: e.target.value })} 
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                  </div>

                  <DialogFooter className="mt-4 pt-3 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting} className="text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs">
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 5: DELETE MATERIAL CONFIRMATION                        */}
      {/* ============================================================ */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          {(() => {
            const u = getUnitLabels(selectedMaterial?.unit)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" /> Remove Material from Inventory
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <p className="text-sm text-slate-700">
                    Are you sure you want to remove <strong>{selectedMaterial?.name}</strong> from warehouse inventory?
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                    <div><strong>Substrate:</strong> {u.cardSubtext} ({selectedMaterial?.roll_width}m × {(selectedMaterial?.roll_height ?? selectedMaterial?.roll_length)}m)</div>
                    <div><strong>Current Stock:</strong> {Number(selectedMaterial?.qty_rolls || 0).toFixed(2)} {u.plural}</div>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    Warning: This will permanently remove the material from inventory and safely unlink any products associated with it.
                  </div>
                </div>

                <DialogFooter className="mt-4 pt-3 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isSubmitting} className="text-xs">
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleDelete} disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs">
                    {isSubmitting ? 'Removing...' : 'Delete Material'}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
