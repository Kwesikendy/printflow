import { type Database } from '@/types/database'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const ADMIN_USER_ID = '00000000-0000-0000-0002-000000000001'
const FRONT_DESK_USER_ID = '00000000-0000-0000-0002-000000000002'
const PRINTER_USER_ID = '00000000-0000-0000-0002-000000000003'
const ACCOUNTANT_USER_ID = '00000000-0000-0000-0002-000000000004'

const DEFAULT_PAYE_BANDS = [
  { limit: 588, rate: 0 },
  { limit: 80, rate: 5 },
  { limit: 100, rate: 10 },
  { limit: 2900, rate: 17.5 },
  { limit: 16000, rate: 25 },
  { limit: 30332, rate: 30 },
  { limit: null, rate: 35 },
]

interface MockStore {
  tables: Record<string, any[]>
  storage: Map<string, string>
  currentUserId: string | null
}

function createInitialStore(): MockStore {
  const now = new Date().toISOString()
  return {
    currentUserId: ADMIN_USER_ID,
    storage: new Map<string, string>(),
    tables: {
      tenants: [
        {
          id: TENANT_ID,
          name: 'GhanaPress Print Shop',
          area_unit: 'cm2',
          currency: 'GHS',
          logo_url: '/Print_DPI_Logo.png',
          created_at: now,
        },
      ],
      profiles: [
        {
          id: ADMIN_USER_ID,
          tenant_id: TENANT_ID,
          role: 'admin',
          full_name: 'Kojo Wolasime',
          email: 'admin@printdpigh.com',
          is_active: true,
          print_room: null,
          phone: '0598608209',
          department: 'Administration',
          job_title: 'Managing Director',
          employment_type: 'full_time',
          employment_start_date: '2025-01-15',
          monthly_basic_salary: 6500,
          monthly_allowances: 800,
          monthly_other_deductions: 0,
          payroll_deduction_notes: null,
          ssnit_number: 'C001234567890',
          ghana_card_number: 'GHA-123456789-0',
          bank_name: 'Ecobank Ghana',
          bank_account_name: 'Kojo Wolasime',
          bank_account_number: '1441000123456',
          salary_payment_method: 'bank',
          created_at: now,
        },
        {
          id: FRONT_DESK_USER_ID,
          tenant_id: TENANT_ID,
          role: 'front_desk',
          full_name: 'Evelyn Akosua Kumah',
          email: 'e.kumah@printdpigh.com',
          is_active: true,
          print_room: null,
          phone: '0244112233',
          department: 'Front Desk',
          job_title: 'Front Office Coordinator',
          employment_type: 'full_time',
          employment_start_date: '2025-02-01',
          monthly_basic_salary: 2800,
          monthly_allowances: 300,
          monthly_other_deductions: 0,
          payroll_deduction_notes: null,
          ssnit_number: 'C002345678901',
          ghana_card_number: 'GHA-234567890-1',
          bank_name: 'GCB Bank',
          bank_account_name: 'Evelyn Akosua Kumah',
          bank_account_number: '1011122334455',
          salary_payment_method: 'bank',
          created_at: now,
        },
        {
          id: PRINTER_USER_ID,
          tenant_id: TENANT_ID,
          role: 'printer',
          full_name: 'Michael Kwabena Osafo',
          email: 'm.osafo@printdpigh.com',
          is_active: true,
          print_room: 'room_1',
          phone: '0244556677',
          department: 'Print Room 1',
          job_title: 'Senior Machine Operator',
          employment_type: 'full_time',
          employment_start_date: '2025-02-10',
          monthly_basic_salary: 3200,
          monthly_allowances: 400,
          monthly_other_deductions: 0,
          payroll_deduction_notes: null,
          ssnit_number: 'C003456789012',
          ghana_card_number: 'GHA-345678901-2',
          bank_name: 'Fidelity Bank',
          bank_account_name: 'Michael Kwabena Osafo',
          bank_account_number: '2090123456789',
          salary_payment_method: 'bank',
          created_at: now,
        },
        {
          id: ACCOUNTANT_USER_ID,
          tenant_id: TENANT_ID,
          role: 'accountant',
          full_name: 'Dennis Makafui Agbebo',
          email: 'd.agbebo@printdpigh.com',
          is_active: true,
          print_room: null,
          phone: '0208112233',
          department: 'Finance',
          job_title: 'Accountant',
          employment_type: 'full_time',
          employment_start_date: '2025-03-01',
          monthly_basic_salary: 4200,
          monthly_allowances: 500,
          monthly_other_deductions: 0,
          payroll_deduction_notes: null,
          ssnit_number: 'C004567890123',
          ghana_card_number: 'GHA-456789012-3',
          bank_name: 'Stanbic Bank',
          bank_account_name: 'Dennis Makafui Agbebo',
          bank_account_number: '9040001234567',
          salary_payment_method: 'bank',
          created_at: now,
        },
      ],
      job_sequences: [
        {
          tenant_id: TENANT_ID,
          last_job: 3,
          last_inv: 3,
          last_reset_time: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
        },
      ],
      product_types: [
        { id: '00000000-0000-0000-0001-000000000001', tenant_id: TENANT_ID, name: 'Flexi Banner', is_active: true, is_fixed_price: false, material_id: '00000000-0000-0000-0005-000000000001', created_at: now },
        { id: '00000000-0000-0000-0001-000000000002', tenant_id: TENANT_ID, name: 'SAV Sticker', is_active: true, is_fixed_price: false, material_id: '00000000-0000-0000-0005-000000000002', created_at: now },
        { id: '00000000-0000-0000-0001-000000000003', tenant_id: TENANT_ID, name: 'One Way Vision', is_active: true, is_fixed_price: false, material_id: null, created_at: now },
        { id: '00000000-0000-0000-0001-000000000004', tenant_id: TENANT_ID, name: 'A3 Glossy Poster', is_active: true, is_fixed_price: true, material_id: null, created_at: now },
        { id: '00000000-0000-0000-0001-000000000005', tenant_id: TENANT_ID, name: 'Roll-Up Stand Complete', is_active: true, is_fixed_price: true, material_id: null, created_at: now },
      ],
      pricing_rules: [
        { id: '00000000-0000-0000-0003-000000000001', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000001', source: 'walk_in', unit_cost: 0.0150, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000002', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000001', source: 'marketing', unit_cost: 0.0110, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000003', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000002', source: 'walk_in', unit_cost: 0.0220, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000004', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000002', source: 'marketing', unit_cost: 0.0160, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000005', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000003', source: 'walk_in', unit_cost: 0.0280, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000006', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000003', source: 'marketing', unit_cost: 0.0200, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000007', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000004', source: 'walk_in', unit_cost: 15.0, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000008', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000004', source: 'marketing', unit_cost: 12.0, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000009', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000005', source: 'walk_in', unit_cost: 350.0, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0003-000000000010', tenant_id: TENANT_ID, product_type_id: '00000000-0000-0000-0001-000000000005', source: 'marketing', unit_cost: 300.0, created_at: now, updated_at: now },
      ],
      standard_sizes: [
        { id: '00000000-0000-0000-0004-000000000001', tenant_id: TENANT_ID, name: 'A4', width: 21, height: 29.7 },
        { id: '00000000-0000-0000-0004-000000000002', tenant_id: TENANT_ID, name: 'A3', width: 29.7, height: 42 },
        { id: '00000000-0000-0000-0004-000000000003', tenant_id: TENANT_ID, name: 'A2', width: 42, height: 59.4 },
        { id: '00000000-0000-0000-0004-000000000004', tenant_id: TENANT_ID, name: 'A1', width: 59.4, height: 84.1 },
        { id: '00000000-0000-0000-0004-000000000005', tenant_id: TENANT_ID, name: 'A0', width: 84.1, height: 118.9 },
        { id: '00000000-0000-0000-0004-000000000006', tenant_id: TENANT_ID, name: '3×2ft Banner', width: 91.44, height: 60.96 },
        { id: '00000000-0000-0000-0004-000000000007', tenant_id: TENANT_ID, name: '6×3ft Banner', width: 182.88, height: 91.44 },
      ],
      materials: [
        {
          id: '00000000-0000-0000-0005-000000000001',
          tenant_id: TENANT_ID,
          name: 'Flexi Roll 440gsm (3.2m × 50m)',
          unit: 'roll',
          roll_width: 3.2,
          roll_length: 50,
          roll_height: 50,
          qty_rolls: 8.5,
          unit_cost: 1250,
          created_at: now,
          updated_at: now,
        },
        {
          id: '00000000-0000-0000-0005-000000000002',
          tenant_id: TENANT_ID,
          name: 'SAV Vinyl Gloss Roll (1.52m × 50m)',
          unit: 'roll',
          roll_width: 1.52,
          roll_length: 50,
          roll_height: 50,
          qty_rolls: 5.0,
          unit_cost: 980,
          created_at: now,
          updated_at: now,
        },
      ],
      inventory_logs: [
        {
          id: '00000000-0000-0000-0006-000000000001',
          tenant_id: TENANT_ID,
          material_id: '00000000-0000-0000-0005-000000000001',
          action: 'add_stock',
          job_id: null,
          qty_change_rolls: 10,
          qty_change_area: 1600,
          notes: 'Opening stock: 10 rolls @ 1250.00 GHS/roll',
          created_at: now,
        },
      ],
      customers: [
        { id: '00000000-0000-0000-0007-000000000001', tenant_id: TENANT_ID, name: 'Accra Mall Retail Group', phone: '0244889900', email: 'orders@accramall.com.gh', created_at: now },
        { id: '00000000-0000-0000-0007-000000000002', tenant_id: TENANT_ID, name: 'Kwame Mensah Events', phone: '0553221100', email: 'kwame@mensahevents.com', created_at: now },
      ],
      job_groups: [
        {
          id: '00000000-0000-0000-0008-000000000001',
          tenant_id: TENANT_ID,
          customer_name: 'Accra Mall Retail Group',
          customer_phone: '0244889900',
          source: 'marketing',
          created_by: FRONT_DESK_USER_ID,
          created_at: now,
          delivery_method: 'pickup',
          delivery_address: null,
          delivery_phone: null,
        },
        {
          id: '00000000-0000-0000-0008-000000000002',
          tenant_id: TENANT_ID,
          customer_name: 'Kwame Mensah Events',
          customer_phone: '0553221100',
          source: 'walk_in',
          created_by: ADMIN_USER_ID,
          created_at: now,
          delivery_method: 'pickup',
          delivery_address: null,
          delivery_phone: null,
        },
      ],
      jobs: [
        {
          id: '00000000-0000-0000-0009-000000000001',
          tenant_id: TENANT_ID,
          group_id: '00000000-0000-0000-0008-000000000001',
          job_number: 'PF-261024-001',
          source: 'marketing',
          customer_name: 'Accra Mall Retail Group',
          customer_phone: '0244889900',
          product_type_id: '00000000-0000-0000-0001-000000000001',
          width: 182.88,
          height: 91.44,
          area: 16722.55,
          quantity: 2,
          unit_cost_applied: 0.0110,
          line_total: 367.90,
          notes: 'Eyelets on all 4 corners',
          artwork_url: null,
          dimension_unit: 'cm',
          print_room: 'room_1',
          status: 'in_production',
          pickup_name: null,
          pickup_phone: null,
          delivery_method: 'pickup',
          delivery_address: null,
          delivery_phone: null,
          created_by: FRONT_DESK_USER_ID,
          created_at: now,
          updated_at: now,
        },
        {
          id: '00000000-0000-0000-0009-000000000002',
          tenant_id: TENANT_ID,
          group_id: '00000000-0000-0000-0008-000000000002',
          job_number: 'PF-261024-002',
          source: 'walk_in',
          customer_name: 'Kwame Mensah Events',
          customer_phone: '0553221100',
          product_type_id: '00000000-0000-0000-0001-000000000005',
          width: 85,
          height: 200,
          area: 1,
          quantity: 1,
          unit_cost_applied: 350.0,
          line_total: 350.0,
          notes: 'Include carry bag',
          artwork_url: null,
          dimension_unit: 'cm',
          print_room: 'room_1',
          status: 'awaiting_payment',
          pickup_name: null,
          pickup_phone: null,
          delivery_method: 'pickup',
          delivery_address: null,
          delivery_phone: null,
          created_by: ADMIN_USER_ID,
          created_at: now,
          updated_at: now,
        },
      ],
      invoices: [
        {
          id: '00000000-0000-0000-0010-000000000001',
          tenant_id: TENANT_ID,
          job_id: '00000000-0000-0000-0009-000000000001',
          group_id: '00000000-0000-0000-0008-000000000001',
          invoice_number: 'INV-261024-001',
          subtotal: 367.90,
          total: 367.90,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          discount_reason: null,
          is_flagged: false,
          flag_reason: null,
          status: 'paid',
          issued_at: now,
        },
        {
          id: '00000000-0000-0000-0010-000000000002',
          tenant_id: TENANT_ID,
          job_id: '00000000-0000-0000-0009-000000000002',
          group_id: '00000000-0000-0000-0008-000000000002',
          invoice_number: 'INV-261024-002',
          subtotal: 350.00,
          total: 350.00,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          discount_reason: null,
          is_flagged: false,
          flag_reason: null,
          status: 'unpaid',
          issued_at: now,
        },
      ],
      payments: [
        {
          id: '00000000-0000-0000-0011-000000000001',
          tenant_id: TENANT_ID,
          invoice_id: '00000000-0000-0000-0010-000000000001',
          job_id: '00000000-0000-0000-0009-000000000001',
          amount: 367.90,
          method: 'momo',
          reference: 'MOMO-9823412',
          notes: 'Full payment via MTN MoMo',
          recorded_by: FRONT_DESK_USER_ID,
          recorded_at: now,
        },
      ],
      job_status_events: [
        {
          id: '00000000-0000-0000-0012-000000000001',
          tenant_id: TENANT_ID,
          job_id: '00000000-0000-0000-0009-000000000001',
          from_status: null,
          to_status: 'awaiting_payment',
          actor_id: FRONT_DESK_USER_ID,
          notes: 'Order created',
          created_at: now,
        },
        {
          id: '00000000-0000-0000-0012-000000000002',
          tenant_id: TENANT_ID,
          job_id: '00000000-0000-0000-0009-000000000001',
          from_status: 'awaiting_payment',
          to_status: 'paid_released',
          actor_id: FRONT_DESK_USER_ID,
          notes: 'Payment confirmed: momo ref: MOMO-9823412',
          created_at: now,
        },
        {
          id: '00000000-0000-0000-0012-000000000003',
          tenant_id: TENANT_ID,
          job_id: '00000000-0000-0000-0009-000000000001',
          from_status: 'paid_released',
          to_status: 'in_production',
          actor_id: PRINTER_USER_ID,
          notes: 'Started printing on Room 1 Roland',
          created_at: now,
        },
        {
          id: '00000000-0000-0000-0012-000000000004',
          tenant_id: TENANT_ID,
          job_id: '00000000-0000-0000-0009-000000000002',
          from_status: null,
          to_status: 'awaiting_payment',
          actor_id: ADMIN_USER_ID,
          notes: 'Order created',
          created_at: now,
        },
      ],
      expenditures: [
        {
          id: '00000000-0000-0000-0013-000000000001',
          tenant_id: TENANT_ID,
          category: 'Materials & Ink',
          description: 'Eco-Solvent Cyan & Magenta Ink (2 Liters)',
          amount: 720.00,
          vendor: 'Accra Print Supplies Ltd',
          reference: 'EXP-101',
          notes: 'Urgent restock for Print Room 1',
          spent_at: now,
          recorded_by: ACCOUNTANT_USER_ID,
          created_at: now,
        },
      ],
      invoice_edits: [],
      employee_leave_balances: [
        { id: '00000000-0000-0000-0014-000000000001', tenant_id: TENANT_ID, employee_id: ADMIN_USER_ID, leave_year: new Date().getFullYear(), entitlement: 20, used_days: 2, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0014-000000000002', tenant_id: TENANT_ID, employee_id: FRONT_DESK_USER_ID, leave_year: new Date().getFullYear(), entitlement: 20, used_days: 5, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0014-000000000003', tenant_id: TENANT_ID, employee_id: PRINTER_USER_ID, leave_year: new Date().getFullYear(), entitlement: 20, used_days: 0, created_at: now, updated_at: now },
        { id: '00000000-0000-0000-0014-000000000004', tenant_id: TENANT_ID, employee_id: ACCOUNTANT_USER_ID, leave_year: new Date().getFullYear(), entitlement: 20, used_days: 3, created_at: now, updated_at: now },
      ],
      leave_requests: [],
      payroll_settings: [
        {
          tenant_id: TENANT_ID,
          tax_year: 2026,
          ssnit_employee_rate: 5.5,
          ssnit_employer_rate: 13,
          ssnit_ceiling: 25000,
          paye_bands: DEFAULT_PAYE_BANDS,
          updated_by: ADMIN_USER_ID,
          updated_at: now,
        },
      ],
      payroll_runs: [],
      payroll_entries: [],
    },
  }
}

const globalForMock = globalThis as unknown as { __printflowMockStore?: MockStore }

function getStore(): MockStore {
  if (!globalForMock.__printflowMockStore) {
    globalForMock.__printflowMockStore = createInitialStore()
  }
  return globalForMock.__printflowMockStore
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url && key && url.startsWith('http') && !url.includes('placeholder') && !url.includes('your-project'))
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function enrichRow(table: string, row: any, store: MockStore): any {
  if (!row) return row
  const clone = { ...row }
  const tables = store.tables

  if (table === 'profiles') {
    clone.tenants = tables.tenants.find(t => t.id === row.tenant_id) || tables.tenants[0] || null
  }
  if (table === 'pricing_rules') {
    clone.product_types = tables.product_types.find(pt => pt.id === row.product_type_id) || null
  }
  if (table === 'jobs') {
    clone.product_types = tables.product_types.find(pt => pt.id === row.product_type_id) || null
    clone.profiles = tables.profiles.find(p => p.id === row.created_by) || null
    clone.tenants = tables.tenants.find(t => t.id === row.tenant_id) || tables.tenants[0] || null
    const jobInvoices = tables.invoices
      .filter(inv => inv.job_id === row.id || (row.group_id && inv.group_id === row.group_id))
      .map(inv => ({
        ...inv,
        payments: tables.payments
          .filter(pay => pay.invoice_id === inv.id)
          .map(pay => ({
            ...pay,
            profiles: tables.profiles.find(p => p.id === pay.recorded_by) || null,
          })),
      }))
    clone.invoices = jobInvoices
    clone.job_status_events = tables.job_status_events
      .filter(ev => ev.job_id === row.id)
      .map(ev => ({
        ...ev,
        profiles: tables.profiles.find(p => p.id === ev.actor_id) || null,
      }))
  }
  if (table === 'job_groups') {
    clone.tenants = tables.tenants.find(t => t.id === row.tenant_id) || tables.tenants[0] || null
    clone.jobs = tables.jobs
      .filter(j => j.group_id === row.id)
      .map(j => ({
        ...j,
        product_types: tables.product_types.find(pt => pt.id === j.product_type_id) || null,
      }))
    clone.invoices = tables.invoices
      .filter(inv => inv.group_id === row.id)
      .map(inv => ({
        ...inv,
        payments: tables.payments
          .filter(pay => pay.invoice_id === inv.id)
          .map(pay => ({
            ...pay,
            profiles: tables.profiles.find(p => p.id === pay.recorded_by) || null,
          })),
      }))
  }
  if (table === 'invoices') {
    clone.tenants = tables.tenants.find(t => t.id === row.tenant_id) || tables.tenants[0] || null
    const relatedJob = tables.jobs.find(j => j.id === row.job_id) || tables.jobs.find(j => row.group_id && j.group_id === row.group_id) || null
    clone.jobs = relatedJob
      ? {
          ...relatedJob,
          product_types: tables.product_types.find(pt => pt.id === relatedJob.product_type_id) || null,
        }
      : null
    const relatedGroup = row.group_id ? tables.job_groups.find(g => g.id === row.group_id) : null
    clone.job_groups = relatedGroup
      ? {
          ...relatedGroup,
          jobs: tables.jobs
            .filter(j => j.group_id === relatedGroup.id)
            .map(j => ({
              ...j,
              product_types: tables.product_types.find(pt => pt.id === j.product_type_id) || null,
            })),
        }
      : null
    clone.payments = tables.payments
      .filter(p => p.invoice_id === row.id)
      .map(p => ({
        ...p,
        profiles: tables.profiles.find(prof => prof.id === p.recorded_by) || null,
      }))
  }
  if (table === 'payments') {
    clone.profiles = tables.profiles.find(p => p.id === row.recorded_by) || null
    const job = tables.jobs.find(j => j.id === row.job_id) || null
    clone.jobs = job
      ? {
          ...job,
          product_types: tables.product_types.find(pt => pt.id === job.product_type_id) || null,
        }
      : null
    clone.invoices = tables.invoices.find(inv => inv.id === row.invoice_id) || null
  }
  if (table === 'job_status_events') {
    clone.profiles = tables.profiles.find(p => p.id === row.actor_id) || null
    const job = tables.jobs.find(j => j.id === row.job_id) || null
    clone.jobs = job
      ? {
          ...job,
          product_types: tables.product_types.find(pt => pt.id === job.product_type_id) || null,
        }
      : null
  }
  if (table === 'expenditures') {
    clone.profiles = tables.profiles.find(p => p.id === row.recorded_by) || null
  }
  if (table === 'invoice_edits') {
    clone.invoices = tables.invoices.find(inv => inv.id === row.invoice_id) || null
    clone.profiles = tables.profiles.find(p => p.id === row.user_id) || null
  }
  if (table === 'inventory_logs') {
    clone.materials = tables.materials.find(m => m.id === row.material_id) || null
    clone.jobs = tables.jobs.find(j => j.id === row.job_id) || null
  }

  return clone
}

function matchesOrClause(row: any, orExpr: string): boolean {
  // Split top-level comma conditions while respecting parentheses in e.g. in.(a,b)
  const conditions: string[] = []
  let current = ''
  let depth = 0
  for (const ch of orExpr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      conditions.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) conditions.push(current.trim())

  return conditions.some(cond => {
    const ilikeMatch = cond.match(/^([^.]+)\.ilike\.%(.*)%$/i)
    if (ilikeMatch) {
      const [, col, needle] = ilikeMatch
      return String(row[col] || '').toLowerCase().includes(needle.toLowerCase())
    }
    const eqMatch = cond.match(/^([^.]+)\.eq\.(.+)$/)
    if (eqMatch) {
      const [, col, val] = eqMatch
      return String(row[col]) === val
    }
    const isNullMatch = cond.match(/^([^.]+)\.is\.null$/i)
    if (isNullMatch) {
      const [, col] = isNullMatch
      return row[col] === null || row[col] === undefined
    }
    const inMatch = cond.match(/^([^.]+)\.in\.\((.*)\)$/)
    if (inMatch) {
      const [, col, listStr] = inMatch
      const vals = listStr.split(',').map(s => s.trim())
      return vals.includes(String(row[col]))
    }
    return true
  })
}

class MockQueryBuilder {
  private table: string
  private store: MockStore
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: any = null
  private upsertOpts: any = null
  private filters: Array<(row: any) => boolean> = []
  private orders: Array<{ column: string; ascending: boolean }> = []
  private rangeBounds: [number, number] | null = null
  private limitCount: number | null = null
  private isSingle = false
  private isMaybeSingle = false
  private countMode: string | null = null
  private headOnly = false

  constructor(table: string, store: MockStore) {
    this.table = table
    this.store = store
    if (!this.store.tables[table]) {
      this.store.tables[table] = []
    }
  }

  select(_columns = '*', opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.countMode = opts.count
    if (opts?.head) this.headOnly = opts.head
    return this
  }

  insert(values: any) {
    this.operation = 'insert'
    this.payload = values
    return this
  }

  update(values: any) {
    this.operation = 'update'
    this.payload = values
    return this
  }

  upsert(values: any, opts?: any) {
    this.operation = 'upsert'
    this.payload = values
    this.upsertOpts = opts
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: any) {
    this.filters.push(row => row[column] === value)
    return this
  }

  neq(column: string, value: any) {
    this.filters.push(row => row[column] !== value)
    return this
  }

  in(column: string, values: any[]) {
    const set = new Set(values)
    this.filters.push(row => set.has(row[column]))
    return this
  }

  ilike(column: string, pattern: string) {
    const clean = pattern.replace(/^%|%$/g, '').toLowerCase()
    this.filters.push(row => String(row[column] || '').toLowerCase().includes(clean))
    return this
  }

  gte(column: string, value: any) {
    this.filters.push(row => row[column] >= value)
    return this
  }

  lte(column: string, value: any) {
    this.filters.push(row => row[column] <= value)
    return this
  }

  or(expr: string) {
    this.filters.push(row => matchesOrClause(row, expr))
    return this
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending ?? true })
    return this
  }

  range(from: number, to: number) {
    this.rangeBounds = [from, to]
    return this
  }

  limit(n: number) {
    this.limitCount = n
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  maybeSingle() {
    this.isMaybeSingle = true
    return this
  }

  private execute(): { data: any; error: any; count?: number | null } {
    const tableRows = this.store.tables[this.table]
    const now = new Date().toISOString()

    if (this.operation === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted = items.map(item => {
        const newRow = {
          id: item.id || generateUuid(),
          created_at: item.created_at || now,
          updated_at: item.updated_at || now,
          ...(this.table === 'invoices' ? { issued_at: item.issued_at || now } : {}),
          ...(this.table === 'payments' ? { recorded_at: item.recorded_at || now } : {}),
          ...item,
        }
        tableRows.push(newRow)
        return enrichRow(this.table, newRow, this.store)
      })
      const result = this.isSingle || this.isMaybeSingle ? inserted[0] ?? null : inserted
      return { data: result, error: null, count: inserted.length }
    }

    if (this.operation === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      const conflictCols = (this.upsertOpts?.onConflict || 'id')
        .split(',')
        .map((s: string) => s.trim())
      const upserted = items.map(item => {
        const existingIdx = tableRows.findIndex(r =>
          conflictCols.every((col: string) => r[col] !== undefined && r[col] === item[col])
        )
        if (existingIdx >= 0) {
          tableRows[existingIdx] = { ...tableRows[existingIdx], ...item, updated_at: now }
          return enrichRow(this.table, tableRows[existingIdx], this.store)
        } else {
          const newRow = {
            id: item.id || generateUuid(),
            created_at: item.created_at || now,
            updated_at: item.updated_at || now,
            ...item,
          }
          tableRows.push(newRow)
          return enrichRow(this.table, newRow, this.store)
        }
      })
      const result = this.isSingle || this.isMaybeSingle ? upserted[0] ?? null : upserted
      return { data: result, error: null, count: upserted.length }
    }

    if (this.operation === 'update') {
      const matched: any[] = []
      for (let i = 0; i < tableRows.length; i++) {
        if (this.filters.every(fn => fn(tableRows[i]))) {
          tableRows[i] = { ...tableRows[i], ...this.payload }
          matched.push(enrichRow(this.table, tableRows[i], this.store))
        }
      }
      const result = this.isSingle || this.isMaybeSingle ? matched[0] ?? null : matched
      return { data: result, error: null, count: matched.length }
    }

    if (this.operation === 'delete') {
      const remaining: any[] = []
      const deleted: any[] = []
      for (const row of tableRows) {
        if (this.filters.every(fn => fn(row))) {
          deleted.push(row)
        } else {
          remaining.push(row)
        }
      }
      this.store.tables[this.table] = remaining
      const result = this.isSingle || this.isMaybeSingle ? deleted[0] ?? null : deleted
      return { data: result, error: null, count: deleted.length }
    }

    // SELECT
    let results = tableRows.filter(row => this.filters.every(fn => fn(row)))
    const totalCount = results.length

    if (this.headOnly) {
      return { data: null, error: null, count: totalCount }
    }

    for (let i = this.orders.length - 1; i >= 0; i--) {
      const { column, ascending } = this.orders[i]
      results.sort((a, b) => {
        const va = a[column]
        const vb = b[column]
        if (va === vb) return 0
        if (va === null || va === undefined) return 1
        if (vb === null || vb === undefined) return -1
        return ascending ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
      })
    }

    if (this.rangeBounds) {
      const [from, to] = this.rangeBounds
      results = results.slice(from, to + 1)
    } else if (this.limitCount !== null) {
      results = results.slice(0, this.limitCount)
    }

    const enriched = results.map(r => enrichRow(this.table, r, this.store))

    if (this.isSingle || this.isMaybeSingle) {
      return { data: enriched[0] ?? null, error: null, count: totalCount }
    }

    return { data: enriched, error: null, count: totalCount }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const res = this.execute()
      return Promise.resolve(res).then(onfulfilled, onrejected)
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected)
    }
  }
}

export function createMockSupabaseClient() {
  const store = getStore()

  const getCurrentUser = () => {
    if (!store.currentUserId) return null
    const profile = store.tables.profiles.find(p => p.id === store.currentUserId) || store.tables.profiles[0]
    if (!profile) return null
    return {
      id: profile.id,
      email: profile.email,
      user_metadata: { full_name: profile.full_name },
    }
  }

  return {
    from(table: string) {
      return new MockQueryBuilder(table, store)
    },
    async rpc(fnName: string, args: any = {}) {
      const now = new Date().toISOString()
      const caller = getCurrentUser()
      const callerId = caller?.id || ADMIN_USER_ID

      if (fnName === 'record_payment') {
        const { p_invoice_id, p_amount, p_method, p_reference, p_notes } = args
        const inv = store.tables.invoices.find(i => i.id === p_invoice_id)
        if (!inv) return { data: null, error: { message: 'Invoice not found' } }

        const paymentId = generateUuid()
        store.tables.payments.push({
          id: paymentId,
          tenant_id: inv.tenant_id,
          invoice_id: inv.id,
          job_id: inv.job_id,
          amount: Number(p_amount),
          method: p_method,
          reference: p_reference || null,
          notes: p_notes || null,
          recorded_by: callerId,
          recorded_at: now,
        })

        const totalPaid = store.tables.payments
          .filter(p => p.invoice_id === inv.id)
          .reduce((sum, p) => sum + Number(p.amount), 0)

        if (totalPaid >= Number(inv.total) - 0.009) {
          inv.status = 'paid'
          const jobsToRelease = store.tables.jobs.filter(
            j => (inv.job_id && j.id === inv.job_id) || (inv.group_id && j.group_id === inv.group_id)
          )
          for (const j of jobsToRelease) {
            if (j.status === 'awaiting_payment') {
              j.status = 'paid_released'
              j.updated_at = now
              store.tables.job_status_events.push({
                id: generateUuid(),
                tenant_id: j.tenant_id,
                job_id: j.id,
                from_status: 'awaiting_payment',
                to_status: 'paid_released',
                actor_id: callerId,
                notes: `Payment recorded: ${p_method}${p_reference ? ' ref: ' + p_reference : ''}`,
                created_at: now,
              })
            }
          }
        } else {
          inv.status = 'partial'
        }

        return { data: paymentId, error: null }
      }

      if (fnName === 'transition_job_status') {
        const { p_job_id, p_to_status, p_notes } = args
        const job = store.tables.jobs.find(j => j.id === p_job_id)
        if (!job) return { data: null, error: { message: 'Job not found' } }
        const fromStatus = job.status
        job.status = p_to_status
        job.updated_at = now
        store.tables.job_status_events.push({
          id: generateUuid(),
          tenant_id: job.tenant_id,
          job_id: job.id,
          from_status: fromStatus,
          to_status: p_to_status,
          actor_id: callerId,
          notes: p_notes || null,
          created_at: now,
        })
        return { data: null, error: null }
      }

      return { data: null, error: null }
    },
    auth: {
      async getUser() {
        return { data: { user: getCurrentUser() }, error: null }
      },
      async signInWithPassword({ email }: { email: string; password?: string }) {
        const matched = store.tables.profiles.find(
          p => p.email.toLowerCase() === (email || '').trim().toLowerCase()
        )
        const targetProfile = matched || store.tables.profiles[0]
        store.currentUserId = targetProfile.id
        return {
          data: {
            user: getCurrentUser(),
            session: { access_token: 'mock-token', user: getCurrentUser() },
          },
          error: null,
        }
      },
      async signInWithOAuth() {
        store.currentUserId = ADMIN_USER_ID
        return { data: { url: '/dashboard' }, error: null }
      },
      async exchangeCodeForSession() {
        store.currentUserId = ADMIN_USER_ID
        return {
          data: {
            session: { user: getCurrentUser() },
          },
          error: null,
        }
      },
      async signOut() {
        store.currentUserId = ADMIN_USER_ID
        return { error: null }
      },
      async updateUser() {
        return { data: { user: getCurrentUser() }, error: null }
      },
      onAuthStateChange(_callback: (event: string, session: any) => void) {
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        }
      },
      admin: {
        async inviteUserByEmail(email: string, opts?: any) {
          const id = generateUuid()
          return {
            data: {
              user: { id, email, user_metadata: opts?.data || {} },
            },
            error: null,
          }
        },
        async createUser(attrs: any) {
          const id = generateUuid()
          return {
            data: {
              user: { id, email: attrs.email, user_metadata: attrs.user_metadata || {} },
            },
            error: null,
          }
        },
        async deleteUser(_id: string) {
          return { data: {}, error: null }
        },
        async updateUserById(id: string, _attrs: any) {
          return { data: { user: { id } }, error: null }
        },
        async listUsers() {
          return {
            data: {
              users: store.tables.profiles.map(p => ({ id: p.id, email: p.email })),
            },
            error: null,
          }
        },
      },
    },
    storage: {
      from(_bucket: string) {
        return {
          async upload(path: string, body: any) {
            if (typeof body === 'string') {
              store.storage.set(path, body)
            } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
              store.storage.set(path, body.toString('utf-8'))
            } else {
              store.storage.set(path, '')
            }
            return { data: { path }, error: null }
          },
          async download(path: string) {
            if (!store.storage.has(path)) {
              return { data: null, error: { message: 'Not found' } }
            }
            const content = store.storage.get(path) || '{}'
            return {
              data: {
                text: async () => content,
              },
              error: null,
            }
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: path.includes('logo') ? '/Print_DPI_Logo.png' : `/mock-storage/${path}`,
              },
            }
          },
          async list(_prefix?: string) {
            return { data: [], error: null }
          },
          async remove(_paths: string[]) {
            for (const p of _paths) store.storage.delete(p)
            return { data: [], error: null }
          },
        }
      },
    },
    channel(_name: string) {
      const ch = {
        on() {
          return ch
        },
        subscribe() {
          return ch
        },
      }
      return ch
    },
    removeChannel(_ch: any) {
      return Promise.resolve('ok')
    },
  } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>
}
