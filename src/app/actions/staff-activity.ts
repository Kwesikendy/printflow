'use server'

import { createClient } from '@/lib/supabase/server'
import { getWorkdayBounds } from '@/lib/workday'
import type { Role, PrintRoom } from '@/types/database'

export interface FrontOfficeJobItem {
  id: string
  jobNumber: string
  customerName: string
  customerPhone: string | null
  productName: string
  width: number
  height: number
  dimensionUnit: string
  area: number
  quantity: number
  lineTotal: number
  status: string
  notes: string | null
  createdAt: string
}

export interface FrontOfficeWorkerStats {
  profileId: string
  fullName: string
  email: string
  role: Role
  totalJobs: number
  totalGroups: number
  totalRevenue: number
  totalArea: number
  totalQuantity: number
  statusCounts: {
    completed: number
    inProduction: number
    paidReleased: number
    awaitingPayment: number
    other: number
  }
  jobs: FrontOfficeJobItem[]
}

export interface PrintProductionActionItem {
  id: string
  jobId: string
  jobNumber: string
  customerName: string
  productName: string
  width: number
  height: number
  dimensionUnit: string
  area: number
  quantity: number
  actionType: 'started' | 'completed'
  fromStatus: string | null
  toStatus: string
  timestamp: string
  currentJobStatus: string
  notes: string | null
}

export interface PrintRoomWorkerStats {
  profileId: string
  fullName: string
  email: string
  role: Role
  printRoom: PrintRoom | null
  totalCompletedJobs: number
  totalInProductionJobs: number
  totalActions: number
  totalAreaCompleted: number
  totalQuantityCompleted: number
  productTypeCounts: Record<string, number>
  actions: PrintProductionActionItem[]
}

export interface StaffActivityReport {
  shiftBounds: {
    start: string
    end: string
    label: string
    isCurrent: boolean
  }
  frontOffice: {
    workers: FrontOfficeWorkerStats[]
    totalJobs: number
    totalRevenue: number
    topPerformer: string | null
  }
  printRoom: {
    workers: PrintRoomWorkerStats[]
    totalCompleted: number
    totalAreaCompleted: number
    topPerformer: string | null
  }
}

export async function getStaffDailyWorkAction(dateIso?: string): Promise<{ data?: StaffActivityReport; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Authentication required' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single() as { data: { tenant_id: string, role: string } | null, error: any }

    if (!profile || !['admin', 'accountant'].includes(profile.role)) {
      return { error: 'Permission denied. Only Admins and Accountants can access staff activity reports.' }
    }

    const bounds = getWorkdayBounds(dateIso || new Date())
    const shiftStart = bounds.start.toISOString()
    const shiftEnd = bounds.end.toISOString()

    // 1. Fetch all tenant profiles
    const { data: staffProfiles, error: staffError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, print_room, is_active')
      .eq('tenant_id', profile.tenant_id)
      .in('role', ['front_desk', 'printer', 'admin'])
      .order('full_name', { ascending: true }) as { data: Array<{ id: string, full_name: string, email: string, role: Role, print_room: PrintRoom | null, is_active: boolean }> | null, error: any }

    if (staffError) throw new Error('Failed to load profiles: ' + staffError.message)

    // 2. Fetch jobs created during this shift
    const { data: shiftJobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        group_id,
        job_number,
        customer_name,
        customer_phone,
        source,
        width,
        height,
        dimension_unit,
        area,
        quantity,
        unit_cost_applied,
        line_total,
        notes,
        print_room,
        status,
        created_by,
        created_at,
        updated_at,
        product_types ( name )
      `)
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', shiftStart)
      .lte('created_at', shiftEnd)
      .order('created_at', { ascending: false }) as { data: any[] | null, error: any }

    if (jobsError) throw new Error('Failed to load shift jobs: ' + jobsError.message)

    // 3. Fetch print production events in this shift
    const { data: shiftEvents, error: eventsError } = await supabase
      .from('job_status_events')
      .select(`
        id,
        job_id,
        from_status,
        to_status,
        actor_id,
        notes,
        created_at,
        jobs (
          id,
          job_number,
          customer_name,
          width,
          height,
          dimension_unit,
          area,
          quantity,
          status,
          product_types ( name )
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', shiftStart)
      .lte('created_at', shiftEnd)
      .in('to_status', ['in_production', 'completed'])
      .order('created_at', { ascending: false }) as { data: any[] | null, error: any }

    if (eventsError) throw new Error('Failed to load production events: ' + eventsError.message)

    const allProfiles = staffProfiles || []
    const allJobs = shiftJobs || []
    const allEvents = shiftEvents || []

    // --- AGGREGATE FRONT OFFICE WORKERS ---
    const frontOfficeWorkers: FrontOfficeWorkerStats[] = []
    let totalFoJobs = 0
    let totalFoRevenue = 0

    // Front office includes front_desk staff, plus admins who created jobs
    const foProfiles = allProfiles.filter(p => p.role === 'front_desk' || (p.role === 'admin' && allJobs.some(j => j.created_by === p.id)))

    for (const p of foProfiles) {
      const userJobs = allJobs.filter(j => j.created_by === p.id)
      const groupIds = new Set(userJobs.map(j => j.group_id || j.id))

      let rev = 0
      let totalArea = 0
      let totalQty = 0
      const statusCounts = {
        completed: 0,
        inProduction: 0,
        paidReleased: 0,
        awaitingPayment: 0,
        other: 0,
      }

      const formattedJobs: FrontOfficeJobItem[] = []

      for (const j of userJobs) {
        rev += Number(j.line_total || 0)
        totalArea += Number(j.area || 0)
        totalQty += Number(j.quantity || 1)

        if (j.status === 'completed' || j.status === 'picked_up') {
          statusCounts.completed++
        } else if (j.status === 'in_production') {
          statusCounts.inProduction++
        } else if (j.status === 'paid_released') {
          statusCounts.paidReleased++
        } else if (['awaiting_payment', 'quoted', 'draft'].includes(j.status)) {
          statusCounts.awaitingPayment++
        } else {
          statusCounts.other++
        }

        formattedJobs.push({
          id: j.id,
          jobNumber: j.job_number,
          customerName: j.customer_name,
          customerPhone: j.customer_phone,
          productName: (j.product_types as any)?.name || 'Custom Product',
          width: Number(j.width),
          height: Number(j.height),
          dimensionUnit: j.dimension_unit || 'cm',
          area: Number(j.area),
          quantity: Number(j.quantity),
          lineTotal: Number(j.line_total),
          status: j.status,
          notes: j.notes,
          createdAt: j.created_at,
        })
      }

      totalFoJobs += userJobs.length
      totalFoRevenue += rev

      frontOfficeWorkers.push({
        profileId: p.id,
        fullName: p.full_name,
        email: p.email,
        role: p.role,
        totalJobs: userJobs.length,
        totalGroups: groupIds.size,
        totalRevenue: rev,
        totalArea: Math.round(totalArea * 100) / 100,
        totalQuantity: totalQty,
        statusCounts,
        jobs: formattedJobs,
      })
    }

    // Sort front office by jobs created descending
    frontOfficeWorkers.sort((a, b) => b.totalJobs - a.totalJobs)
    const topFo = frontOfficeWorkers.length > 0 && frontOfficeWorkers[0].totalJobs > 0 
      ? frontOfficeWorkers[0].fullName 
      : null

    // --- AGGREGATE PRINT ROOM WORKERS ---
    const printRoomWorkers: PrintRoomWorkerStats[] = []
    let totalPrCompleted = 0
    let totalPrArea = 0

    // Print room includes printers, plus admins who performed production events
    const prProfiles = allProfiles.filter(p => p.role === 'printer' || (p.role === 'admin' && allEvents.some(e => e.actor_id === p.id)))

    for (const p of prProfiles) {
      const userEvents = allEvents.filter(e => e.actor_id === p.id)

      let completedCount = 0
      let inProdCount = 0
      let completedArea = 0
      let completedQty = 0
      const prodTypes: Record<string, number> = {}

      const formattedActions: PrintProductionActionItem[] = []

      // Keep track of unique completed job IDs for this printer in this shift
      const completedJobIds = new Set<string>()

      for (const ev of userEvents) {
        const j = ev.jobs as any
        const actionType: 'started' | 'completed' = ev.to_status === 'completed' ? 'completed' : 'started'
        const pName = j?.product_types?.name || 'Item'

        if (actionType === 'completed') {
          completedCount++
          if (j?.id && !completedJobIds.has(j.id)) {
            completedJobIds.add(j.id)
            completedArea += Number(j?.area || 0)
            completedQty += Number(j?.quantity || 1)
          }
          prodTypes[pName] = (prodTypes[pName] || 0) + 1
        } else {
          inProdCount++
        }

        formattedActions.push({
          id: ev.id,
          jobId: ev.job_id,
          jobNumber: j?.job_number || 'Unknown',
          customerName: j?.customer_name || 'Client',
          productName: pName,
          width: Number(j?.width || 0),
          height: Number(j?.height || 0),
          dimensionUnit: j?.dimension_unit || 'cm',
          area: Number(j?.area || 0),
          quantity: Number(j?.quantity || 1),
          actionType,
          fromStatus: ev.from_status,
          toStatus: ev.to_status,
          timestamp: ev.created_at,
          currentJobStatus: j?.status || ev.to_status,
          notes: ev.notes,
        })
      }

      totalPrCompleted += completedCount
      totalPrArea += completedArea

      printRoomWorkers.push({
        profileId: p.id,
        fullName: p.full_name,
        email: p.email,
        role: p.role,
        printRoom: p.print_room,
        totalCompletedJobs: completedCount,
        totalInProductionJobs: inProdCount,
        totalActions: userEvents.length,
        totalAreaCompleted: Math.round(completedArea * 100) / 100,
        totalQuantityCompleted: completedQty,
        productTypeCounts: prodTypes,
        actions: formattedActions,
      })
    }

    // Sort printers by completed jobs descending
    printRoomWorkers.sort((a, b) => b.totalCompletedJobs - a.totalCompletedJobs)
    const topPr = printRoomWorkers.length > 0 && printRoomWorkers[0].totalCompletedJobs > 0
      ? printRoomWorkers[0].fullName
      : null

    return {
      data: {
        shiftBounds: {
          start: bounds.start.toISOString(),
          end: bounds.end.toISOString(),
          label: bounds.label,
          isCurrent: bounds.isCurrent,
        },
        frontOffice: {
          workers: frontOfficeWorkers,
          totalJobs: totalFoJobs,
          totalRevenue: totalFoRevenue,
          topPerformer: topFo,
        },
        printRoom: {
          workers: printRoomWorkers,
          totalCompleted: totalPrCompleted,
          totalAreaCompleted: Math.round(totalPrArea * 100) / 100,
          topPerformer: topPr,
        },
      },
    }
  } catch (err: any) {
    console.error('Error in getStaffDailyWorkAction:', err)
    return { error: err.message || 'Failed to generate staff activity report' }
  }
}
