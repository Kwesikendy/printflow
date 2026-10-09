-- Create Materials table
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT DEFAULT 'roll',
    roll_width NUMERIC NOT NULL,
    roll_length NUMERIC NOT NULL,
    qty_rolls NUMERIC DEFAULT 0,
    unit_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Enable RLS for materials
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view materials for their tenant" 
    ON public.materials FOR SELECT 
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins and Manager can manage materials for their tenant" 
    ON public.materials FOR ALL 
    USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) AND
        (
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR
            (SELECT email FROM public.profiles WHERE id = auth.uid()) = 'd.opare@printdpigh.com'
        )
    );

-- Create Inventory Logs table
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'add_stock', 'job_deduction', 'manual_adjustment'
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    qty_change_rolls NUMERIC NOT NULL,
    qty_change_area NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for inventory_logs
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory logs for their tenant" 
    ON public.inventory_logs FOR SELECT 
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert inventory logs for their tenant" 
    ON public.inventory_logs FOR INSERT 
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Alter product_types table to link to materials
ALTER TABLE public.product_types 
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL;
