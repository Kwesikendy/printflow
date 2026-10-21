// PrintFlow -- Database Types

export type Role = 'front_desk' | 'printer' | 'accountant' | 'admin' | 'cleaner' | 'rider'
export type JobStatus =
  | 'draft'
  | 'quoted'
  | 'awaiting_payment'
  | 'paid_released'
  | 'in_production'
  | 'completed'
  | 'picked_up'
  | 'cancelled'
export type PaymentMethod = 'momo' | 'cash' | 'other'
export type JobSource = 'walk_in' | 'marketing'
export type PrintRoom = 'room_1' | 'room_2'
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid'
export type DiscountType = 'none' | 'percentage' | 'fixed'
export type AreaUnit = 'cm2' | 'm2' | 'in2'
export type DimensionUnit = 'cm' | 'm' | 'ft' | 'in'
export type DeliveryMethod = 'pickup' | 'delivery'
export type DeliveryStatus = 'pending' | 'dispatched' | 'delivered'

export interface Tenant {
  id: string
  name: string
  area_unit: AreaUnit
  currency: string
  logo_url: string | null
  created_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  role: Role
  full_name: string
  email: string
  is_active: boolean
  print_room: PrintRoom | null
  phone?: string | null
  department?: string | null
  job_title?: string | null
  employment_type?: 'full_time' | 'part_time' | 'contract'
  employment_start_date?: string | null
  monthly_basic_salary?: number
  monthly_allowances?: number
  monthly_other_deductions?: number
  payroll_deduction_notes?: string | null
  ssnit_number?: string | null
  ghana_card_number?: string | null
  bank_name?: string | null
  bank_account_name?: string | null
  bank_account_number?: string | null
  salary_payment_method?: SalaryPaymentMethod
  created_at: string
}

export interface EmployeeLeaveBalance {
  id: string
  tenant_id: string
  employee_id: string
  leave_year: number
  entitlement: number
  used_days: number
  created_at: string
  updated_at: string
}

export type LeaveRequestType = 'annual' | 'sick' | 'unpaid' | 'other'
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  tenant_id: string
  employee_id: string
  requested_by: string
  start_date: string
  end_date: string
  days: number
  leave_type: LeaveRequestType
  reason: string | null
  status: LeaveRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

export type SalaryPaymentMethod = 'bank' | 'mobile_money' | 'cash'
export type PayrollRunStatus = 'draft' | 'approved' | 'paid'

export interface PayeBand {
  limit: number | null
  rate: number
}

export interface PayrollSettings {
  tenant_id: string
  tax_year: number
  ssnit_employee_rate: number
  ssnit_employer_rate: number
  ssnit_ceiling: number
  paye_bands: PayeBand[]
  updated_by: string | null
  updated_at: string
}

export interface PayrollRun {
  id: string
  tenant_id: string
  period_month: string
  status: PayrollRunStatus
  total_basic_salary: number
  total_allowances: number
  total_gross_salary: number
  total_employee_ssnit: number
  total_paye: number
  total_other_deductions: number
  total_net_salary: number
  total_employer_ssnit: number
  total_employer_cost: number
  created_by: string
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface PayrollEntry {
  id: string
  run_id: string
  tenant_id: string
  employee_id: string
  basic_salary: number
  allowances: number
  gross_salary: number
  employee_ssnit: number
  paye: number
  other_deductions: number
  net_salary: number
  employer_ssnit: number
  employer_cost: number
  deduction_notes: string | null
  created_at: string
}

export interface ProductType {
  id: string
  tenant_id: string
  name: string
  is_active: boolean
  is_fixed_price: boolean
  created_at: string
}

export type UnitRates = Partial<Record<DimensionUnit, number>>

export interface ProductPricingScheme {
  walk_in?: UnitRates
  marketing?: UnitRates
  default_unit?: DimensionUnit
}

export type UnitPricingConfig = Record<string, ProductPricingScheme>

export interface PricingRule {
  id: string
  tenant_id: string
  product_type_id: string
  source: JobSource
  unit_cost: number
  created_at: string
  updated_at: string
  product_types?: ProductType
}

export interface StandardSize {
  id: string
  tenant_id: string
  name: string
  width: number
  height: number
}

export interface JobGroup {
  id: string
  tenant_id: string
  customer_name: string
  customer_phone: string | null
  source: JobSource
  created_by: string
  created_at: string
  delivery_method?: DeliveryMethod
  delivery_address?: string | null
  delivery_phone?: string | null
  jobs?: Job[]
  invoices?: Invoice[]
}

export interface Job {
  id: string
  tenant_id: string
  group_id: string | null
  job_number: string
  source: JobSource
  customer_name: string
  customer_phone: string | null
  product_type_id: string
  width: number
  height: number
  area: number
  quantity: number
  unit_cost_applied: number
  line_total: number
  notes: string | null
  artwork_url: string | null
  dimension_unit: DimensionUnit
  print_room: PrintRoom | null
  status: JobStatus
  pickup_name: string | null
  pickup_phone: string | null
  delivery_method?: DeliveryMethod
  delivery_address?: string | null
  delivery_phone?: string | null
  delivery_rider_name?: string | null
  delivery_rider_phone?: string | null
  delivery_status?: DeliveryStatus
  delivery_dispatched_at?: string | null
  delivery_delivered_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  product_types?: ProductType
  profiles?: Profile
  invoices?: Invoice[]
}

export interface Customer {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  email: string | null
  created_at: string
}

export interface Invoice {
  id: string
  tenant_id: string
  job_id: string | null
  group_id: string | null
  invoice_number: string
  total: number
  subtotal?: number
  discount_type?: DiscountType
  discount_value?: number
  discount_amount?: number
  discount_reason?: string | null
  is_flagged?: boolean
  flag_reason?: string | null
  flagged_at?: string | null
  flagged_by?: string | null
  status: InvoiceStatus
  issued_at: string
  // Joined
  jobs?: Job
  job_group?: JobGroup
  payments?: Payment[]
}

export interface Expenditure {
  id: string
  tenant_id: string
  category: string
  description: string
  amount: number
  vendor: string | null
  reference: string | null
  notes: string | null
  spent_at: string
  recorded_by: string
  created_at: string
  profiles?: Pick<Profile, 'full_name'> | null
}

export interface Payment {
  id: string
  tenant_id: string
  invoice_id: string
  job_id: string | null
  amount: number
  method: PaymentMethod
  reference: string | null
  notes: string | null
  recorded_by: string
  recorded_at: string
  // Joined
  profiles?: Profile
  jobs?: Job
  invoices?: Invoice
}

export interface JobStatusEvent {
  id: string
  tenant_id: string
  job_id: string
  from_status: JobStatus | null
  to_status: JobStatus
  actor_id: string
  notes: string | null
  created_at: string
  // Joined
  profiles?: Profile
}

// Auth session user context
export interface UserSession {
  user: {
    id: string
    email: string
  }
  profile: Profile
  tenant: Tenant
}

// Database shape for Supabase client
export type Database = {
  public: {
    Tables: {
      tenants: { Row: Tenant; Insert: Omit<Tenant, 'id' | 'created_at'>; Update: Partial<Tenant> }
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> }
      employee_leave_balances: { Row: EmployeeLeaveBalance; Insert: Omit<EmployeeLeaveBalance, 'id' | 'created_at' | 'updated_at'>; Update: Partial<EmployeeLeaveBalance> }
      leave_requests: { Row: LeaveRequest; Insert: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>; Update: Partial<LeaveRequest> }
      payroll_settings: { Row: PayrollSettings; Insert: Omit<PayrollSettings, 'updated_at'>; Update: Partial<PayrollSettings> }
      payroll_runs: { Row: PayrollRun; Insert: Omit<PayrollRun, 'id' | 'created_at' | 'updated_at'>; Update: Partial<PayrollRun> }
      payroll_entries: { Row: PayrollEntry; Insert: Omit<PayrollEntry, 'id' | 'created_at'>; Update: Partial<PayrollEntry> }
      product_types: { Row: ProductType; Insert: Omit<ProductType, 'id' | 'created_at'>; Update: Partial<ProductType> }
      pricing_rules: { Row: PricingRule; Insert: Omit<PricingRule, 'id' | 'created_at' | 'updated_at'>; Update: Partial<PricingRule> }
      standard_sizes: { Row: StandardSize; Insert: Omit<StandardSize, 'id'>; Update: Partial<StandardSize> }
      job_groups: { Row: JobGroup; Insert: Omit<JobGroup, 'id' | 'created_at'>; Update: Partial<JobGroup> }
      jobs: { Row: Job; Insert: Omit<Job, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Job> }
      customers: { Row: Customer; Insert: Omit<Customer, 'id' | 'created_at'>; Update: Partial<Customer> }
      invoices: { Row: Invoice; Insert: Omit<Invoice, 'id' | 'issued_at'>; Update: Partial<Invoice> }
      expenditures: { Row: Expenditure; Insert: Omit<Expenditure, 'id' | 'created_at'>; Update: Partial<Expenditure> }
      payments: { Row: Payment; Insert: Omit<Payment, 'id' | 'recorded_at'>; Update: Partial<Payment> }
      job_status_events: { Row: JobStatusEvent; Insert: Omit<JobStatusEvent, 'id' | 'created_at'>; Update: never }
    }
    Functions: {
      create_job_group: {
        Args: { p_customer_name: string; p_customer_phone: string | null; p_source: string; p_items: any }
        Returns: { group_id: string; invoice_id: string; invoice_number: string; grand_total: number; jobs: any[] }
      }
      record_payment: {
        Args: { p_invoice_id: string; p_amount: number; p_method: PaymentMethod; p_reference: string | null; p_notes: string | null }
        Returns: string
      }
      transition_job_status: {
        Args: { p_job_id: string; p_to_status: JobStatus; p_notes: string | null }
        Returns: void
      }
    }
  }
}
