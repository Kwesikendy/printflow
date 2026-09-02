# PrintFlow MVP

PrintFlow is a multi-tenant SaaS web application designed specifically for graphic printing shops in Ghana to manage their jobs, print queues, and offline payments.

## Features Built
- **Next.js 15 App Router** frontend with Tailwind CSS and shadcn/ui inspired components.
- **Supabase Backend** with Row Level Security (RLS) ensuring strict tenant isolation.
- **Role-based Access Control**: Front Desk, Printer, Accountant, Admin.
- **Realtime Printer Queue** using Supabase Postgres Changes.
- **Atomic Database Transactions** for payment recording and status changes.
- **Dynamic Pricing Engine** (Area × Unit Cost × Quantity).
- **Printable Job Cards & Invoices**.

---

## 🚀 Setup & Local Development

### 1. Prerequisites
- Node.js (v18 or higher)
- A [Supabase](https://supabase.com/) account (Free tier is fine)

### 2. Supabase Setup
1. Create a new project in Supabase.
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Run the migration files located in `supabase/migrations/` in this exact order:
   - `001_schema.sql` (Creates tables and indexes)
   - `002_rls.sql` (Applies security policies)
   - `003_functions.sql` (Creates atomic transaction functions)
   - `004_seed.sql` (Creates demo tenant, products, sizes, and pricing)
4. Go to **Authentication > Providers** and ensure **Email** is enabled (disable 'Confirm email' for easy testing).

### 3. Environment Variables
Copy `.env.local.example` to `.env.local` and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```
*(You can find these in Supabase under Project Settings > API)*

### 4. Create Demo Users
Since this MVP uses Supabase Auth, you need to create the users in your Supabase dashboard:
1. Go to **Authentication > Users** and add 4 users (e.g. `admin@demo.com`, `desk@demo.com`, `printer@demo.com`, `accountant@demo.com`).
2. Go to the **Table Editor** > `profiles` table.
3. For each user you created, insert a row mapping their `auth.users.id` to the demo tenant ID (`00000000-0000-0000-0000-000000000001`) and assign them one of the 4 roles: `admin`, `front_desk`, `printer`, `accountant`.

### 5. Run the App
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`

---

## Architecture Notes
- **Tenancy**: Every business table has a `tenant_id`. Supabase RLS policies enforce that users can only interact with data matching their profile's `tenant_id`.
- **Status Machine**: Job status transitions are strictly validated at the database function level (`transition_job_status`). Pre-payment jobs cannot enter the print queue.
- **Realtime**: The `RealtimeProvider` subscribes directly to the `jobs` table using Supabase's `postgres_changes`.

## Future Roadmap (Out of Scope for MVP)
- Payment Gateway Integrations (Paystack, Hubtel)
- Complex multi-branch setups
- Inventory tracking
- Dynamic product/pricing UI editors (currently read-only in UI, configured in DB)
