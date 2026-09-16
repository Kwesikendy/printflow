// PrintFlow -- Database Types

export type Role = 'front_desk' | 'printer' | 'accountant' | 'admin'
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
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid'
export type AreaUnit = 'cm2' | 'm2' | 'in2'
export type DimensionUnit = 'cm' | 'm' | 'ft' | 'in'

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
  created_at: string
}

export interface ProductType {
  id: string
  tenant_id: string
  name: string
  is_active: boolean
  created_at: string
}

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
  status: JobStatus
  pickup_name: string | null
  pickup_phone: string | null
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
  status: InvoiceStatus
  issued_at: string
  // Joined
  jobs?: Job
  job_group?: JobGroup
  payments?: Payment[]
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
      product_types: { Row: ProductType; Insert: Omit<ProductType, 'id' | 'created_at'>; Update: Partial<ProductType> }
      pricing_rules: { Row: PricingRule; Insert: Omit<PricingRule, 'id' | 'created_at' | 'updated_at'>; Update: Partial<PricingRule> }
      standard_sizes: { Row: StandardSize; Insert: Omit<StandardSize, 'id'>; Update: Partial<StandardSize> }
      job_groups: { Row: JobGroup; Insert: Omit<JobGroup, 'id' | 'created_at'>; Update: Partial<JobGroup> }
      jobs: { Row: Job; Insert: Omit<Job, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Job> }
      customers: { Row: Customer; Insert: Omit<Customer, 'id' | 'created_at'>; Update: Partial<Customer> }
      invoices: { Row: Invoice; Insert: Omit<Invoice, 'id' | 'issued_at'>; Update: Partial<Invoice> }
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
