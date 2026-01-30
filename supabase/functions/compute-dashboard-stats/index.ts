// Supabase Edge Function: compute-dashboard-stats
// Computes occupation percentages and reschedule counts for all doctors
// - clinics[] and service_codes[] are aggregated from LAST 30 DAYS
// - occupation_percentage is calculated for TODAY only
// Also computes aggregated stats per clinic
// Scheduled to run at 7:00 AM via pg_cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Glintt API configuration (using existing secret names)
const GLINTT_URL = Deno.env.get("GLINTT_BASE_URL") || "";
const GLINTT_CLIENT_ID = Deno.env.get("GLINTT_CLIENT_ID") || "";
const GLINTT_CLIENT_SECRET = Deno.env.get("GLINTT_CLIENT_SECRET") || "";

// Supabase configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// API Key for authentication
const EDGE_FUNCTIONS_API_KEY = Deno.env.get("EDGE_FUNCTION_APPOINTMENTS_KEY") || "";

interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface Slot {
  SlotDateTime: string;
  ServiceCode?: string;
  OccupationReason?: {
    Code: string;
    Description: string;
  };
  Occupation?: boolean;
}

interface Appointment {
  appointmentId: string;
  appointmentHour: string;
  doctorCode: string;
  serviceCode: string;
  performingService?: {
    code: string;
    description: string;
  };
  status: string;
}

interface DoctorProfile {
  id: string;
  doctor_code: string;
  full_name: string | null;
}

interface DashboardStats {
  doctor_code: string;
  doctor_name: string | null;
  occupation_percentage: number;
  total_slots: number;
  occupied_slots: number;
  total_reschedules_30d: number;
  clinics: string[];
  service_codes: string[];
  // Monthly occupation fields
  monthly_occupation_percentage: number;
  monthly_total_slots: number;
  monthly_occupied_slots: number;
  monthly_days_counted: number;
}

interface ClinicStats {
  clinic: string;
  total_doctors: number;
  avg_occupation_percentage: number;
  total_reschedules_30d: number;
  monthly_occupation_percentage: number;
  total_slots: number;
  total_occupied_slots: number;
  monthly_total_slots: number;
  monthly_occupied_slots: number;
  days_counted: number;
}

// Get Glintt auth token
async function getGlinttAuthToken(): Promise<string> {
  const authUrl = `${GLINTT_URL}/Glintt.GPlatform.APIGateway.CoreWebAPI/token`;

  const formData = new URLSearchParams();
  formData.append("client_id", GLINTT_CLIENT_ID);
  formData.append("client_secret", GLINTT_CLIENT_SECRET);
  formData.append("grant_type", "password");
  formData.append("TenantID", "DEFAULT");
  formData.append("FacilityID", "DEFAULT");
  formData.append("USERNAME", "ADMIN");

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Glintt auth token: ${response.statusText}`);
  }

  const data: AuthToken = await response.json();
  return data.access_token;
}

// Get appointments for a doctor for a specific day
async function getAppointmentsForDay(
  doctorCode: string,
  date: string,
  token: string
): Promise<Appointment[]> {
  const appointmentsUrl = `${GLINTT_URL}/Hms.OutPatient.Api/hms/outpatient/Appointment`;
  const params = new URLSearchParams({
    beginDate: `${date}T00:00:00`,
    endDate: `${date}T23:59:59`,
    doctorCode: doctorCode,
    status: "SCHEDULED",
    medicalAct: "1",
    skip: "0",
    take: "500",
  });

  try {
    const response = await fetch(`${appointmentsUrl}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[getAppointmentsForDay] Failed for doctor=${doctorCode}, date=${date}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[getAppointmentsForDay] Error for doctor=${doctorCode}, date=${date}:`, err);
    return [];
  }
}

// Get slots for a single day from Glintt
async function getSlotsForDay(
  doctorCode: string,
  serviceCode: string,
  date: string,
  token: string
): Promise<Slot[]> {
  const slotsUrl = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots`;
  const slotsRequest = {
    LoadAppointments: true,
    FullSearch: true,
    NumberOfRegisters: 500,
    Patient: {},
    Period: [],
    DaysOfWeek: [],
    ExternalMedicalActSlotsList: [
      {
        StartDate: date,
        EndDate: date,
        MedicalActCode: "1",
        ServiceCode: serviceCode,
        RescheduleFlag: false,
        origin: "MALO_ADMIN",
        HumanResourceCode: doctorCode,
      },
    ],
  };

  try {
    const response = await fetch(slotsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slotsRequest),
    });

    if (!response.ok) {
      console.warn(`[getSlotsForDay] Failed for date=${date}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data?.ExternalSearchSlot || [];
  } catch (err) {
    console.error(`[getSlotsForDay] Error for date=${date}:`, err);
    return [];
  }
}

// Get service codes for a doctor from Glintt
async function getServiceCodesForDoctor(doctorCode: string, token: string): Promise<string[]> {
  try {
    const hrDetailUrl = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/humanresources/search-detail`;
    const params = new URLSearchParams({
      skip: "0",
      take: "100",
    });

    const requestBody = {
      HumanResourceIDs: [doctorCode],
    };

    const response = await fetch(`${hrDetailUrl}?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`[getServiceCodesForDoctor] Failed for doctor ${doctorCode}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    const serviceCodesSet = new Set<string>();
    data.forEach((item: { HumanResourceCode: string; ServiceCode?: string }) => {
      if (item.HumanResourceCode === doctorCode && item.ServiceCode) {
        serviceCodesSet.add(item.ServiceCode);
      }
    });

    return Array.from(serviceCodesSet);
  } catch (error) {
    console.warn(`[getServiceCodesForDoctor] Error for doctor ${doctorCode}:`, error);
    return [];
  }
}

// Extract clinic name from performingService.description
// Format: "Coimbra - Dep. Prótese Fixa" -> "Coimbra"
function extractClinicFromDescription(description: string | undefined): string | null {
  if (!description) return null;
  const parts = description.split(" - ");
  return parts[0]?.trim() || null;
}

// Generate array of dates for last N days (including today)
function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
}

// Check if a date is a weekend (Saturday or Sunday)
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Get business days (excluding weekends) for the last month
// From same day last month to yesterday
function getMonthlyBusinessDays(): string[] {
  const dates: string[] = [];
  const today = new Date();

  // End date: yesterday
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1);

  // Start date: same day last month
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 1);

  const current = new Date(startDate);
  while (current <= endDate) {
    if (!isWeekend(current)) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Calculate monthly occupation for a doctor (last month, excluding weekends)
async function calculateMonthlyOccupationForDoctor(
  doctorCode: string,
  serviceCodes: string[],
  token: string
): Promise<{
  monthlyOccupationPercentage: number;
  monthlyTotalSlots: number;
  monthlyOccupiedSlots: number;
  monthlyDaysCounted: number;
}> {
  if (serviceCodes.length === 0) {
    return {
      monthlyOccupationPercentage: 0,
      monthlyTotalSlots: 0,
      monthlyOccupiedSlots: 0,
      monthlyDaysCounted: 0,
    };
  }

  const businessDays = getMonthlyBusinessDays();
  console.log(`[calculateMonthlyOccupation] Doctor ${doctorCode}: Calculating for ${businessDays.length} business days`);

  let totalSlots = 0;
  let occupiedSlots = 0;

  // Process days in batches to avoid overwhelming the API
  const DAY_BATCH_SIZE = 5;
  for (let i = 0; i < businessDays.length; i += DAY_BATCH_SIZE) {
    const dayBatch = businessDays.slice(i, i + DAY_BATCH_SIZE);

    for (const day of dayBatch) {
      let daySlots: Slot[] = [];

      // Get slots for each service code
      for (const serviceCode of serviceCodes) {
        try {
          const slots = await getSlotsForDay(doctorCode, serviceCode, day, token);
          daySlots = daySlots.concat(slots);
        } catch (err) {
          // Skip errors for individual days/services
        }
      }

      // Deduplicate slots by SlotDateTime
      const uniqueSlots = new Map<string, Slot>();
      for (const slot of daySlots) {
        const key = slot.SlotDateTime?.slice(0, 16);
        if (key && !uniqueSlots.has(key)) {
          uniqueSlots.set(key, slot);
        }
      }

      // Count occupied vs free (excluding blocked)
      for (const slot of uniqueSlots.values()) {
        const code = slot.OccupationReason?.Code;
        if (code === "B") continue; // Skip blocked

        totalSlots++;
        if (code === "S" || slot.Occupation === true) {
          occupiedSlots++;
        }
      }
    }

    // Small delay between batches
    if (i + DAY_BATCH_SIZE < businessDays.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const percentage = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

  console.log(
    `[calculateMonthlyOccupation] Doctor ${doctorCode}: ${occupiedSlots}/${totalSlots} = ${percentage.toFixed(2)}% (monthly)`
  );

  return {
    monthlyOccupationPercentage: Math.round(percentage * 100) / 100,
    monthlyTotalSlots: totalSlots,
    monthlyOccupiedSlots: occupiedSlots,
    monthlyDaysCounted: businessDays.length,
  };
}

// Calculate occupation percentage for a doctor and extract clinics from last 30 days
async function calculateOccupationForDoctor(
  doctorCode: string,
  token: string
): Promise<{
  occupationPercentage: number;
  totalSlots: number;
  occupiedSlots: number;
  serviceCodes: string[];
  clinics: string[];
}> {
  // Get service codes for this doctor
  const serviceCodes = await getServiceCodesForDoctor(doctorCode, token);

  if (serviceCodes.length === 0) {
    console.warn(`[calculateOccupation] No service codes found for doctor ${doctorCode}`);
    return { occupationPercentage: 0, totalSlots: 0, occupiedSlots: 0, serviceCodes: [], clinics: [] };
  }

  // Get dates for last 30 days
  const last30Days = getLastNDays(30);
  const todayStr = last30Days[0]; // First element is today

  // ============================================================
  // PART 1: Get clinics from appointments of LAST 30 DAYS
  // ============================================================
  const clinicsSet = new Set<string>();
  const serviceCodesFromAppointments = new Set<string>();

  console.log(`[calculateOccupation] Doctor ${doctorCode}: Fetching appointments for last 30 days...`);

  // Fetch appointments for each day (with some parallelization)
  // Process in batches of 5 days to avoid overwhelming the API
  const BATCH_SIZE = 5;
  for (let i = 0; i < last30Days.length; i += BATCH_SIZE) {
    const batch = last30Days.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(date => getAppointmentsForDay(doctorCode, date, token));
    const batchResults = await Promise.all(batchPromises);

    for (const appointments of batchResults) {
      for (const apt of appointments) {
        // Extract clinic from performingService.description
        const clinic = extractClinicFromDescription(apt.performingService?.description);
        if (clinic) {
          clinicsSet.add(clinic);
        }
        // Also collect service codes from appointments
        if (apt.serviceCode) {
          serviceCodesFromAppointments.add(apt.serviceCode);
        }
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < last30Days.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Merge service codes from HR API and from appointments
  const allServiceCodes = [...new Set([...serviceCodes, ...serviceCodesFromAppointments])];

  // ============================================================
  // PART 2: Get slots for TODAY only (for occupation calculation)
  // ============================================================
  let allSlots: Slot[] = [];
  for (const serviceCode of serviceCodes) {
    const slots = await getSlotsForDay(doctorCode, serviceCode, todayStr, token);
    allSlots = allSlots.concat(slots);
  }

  // Deduplicate slots by SlotDateTime
  const uniqueSlots = new Map<string, Slot>();
  for (const slot of allSlots) {
    const key = slot.SlotDateTime?.slice(0, 16); // YYYY-MM-DDTHH:mm
    if (key && !uniqueSlots.has(key)) {
      uniqueSlots.set(key, slot);
    }
  }

  // Count occupied vs free (excluding blocked)
  let totalSlots = 0;
  let occupiedSlots = 0;

  for (const slot of uniqueSlots.values()) {
    const code = slot.OccupationReason?.Code;

    // Skip blocked slots (B)
    if (code === "B") continue;

    totalSlots++;

    // S = Scheduled (occupied), N = Not occupied (free)
    if (code === "S" || slot.Occupation === true) {
      occupiedSlots++;
    }
  }

  const occupationPercentage = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

  console.log(
    `[calculateOccupation] Doctor ${doctorCode}: ${occupiedSlots}/${totalSlots} = ${occupationPercentage.toFixed(2)}% (today), clinics (30d): [${Array.from(clinicsSet).join(", ")}]`
  );

  return {
    occupationPercentage: Math.round(occupationPercentage * 100) / 100,
    totalSlots,
    occupiedSlots,
    serviceCodes: allServiceCodes,
    clinics: Array.from(clinicsSet),
  };
}

// Count reschedules in the last 30 days for a doctor
async function countReschedulesLast30Days(
  supabase: ReturnType<typeof createClient>,
  doctorCode: string
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count, error } = await supabase
    .schema("appointments_app")
    .from("reschedules")
    .select("*", { count: "exact", head: true })
    .eq("doctor_code", doctorCode)
    .gte("new_datetime", thirtyDaysAgo.toISOString())
    .eq("status", "completed");

  if (error) {
    console.error(`[countReschedules] Error for doctor ${doctorCode}:`, error);
    return 0;
  }

  return count || 0;
}

// Calculate and save clinic stats
// Note: A doctor appears in a clinic's stats if they worked there in the last 30 days
// (based on clinics[] array which aggregates last 30 days)
async function computeAndSaveClinicStats(
  supabase: ReturnType<typeof createClient>,
  doctorStats: DashboardStats[]
): Promise<void> {
  console.log("[computeClinicStats] Computing clinic stats (based on 30-day clinic history)...");

  // Group doctors by clinic (a doctor can appear in multiple clinics)
  const clinicDoctorsMap = new Map<string, DashboardStats[]>();

  for (const stat of doctorStats) {
    for (const clinic of stat.clinics) {
      if (!clinicDoctorsMap.has(clinic)) {
        clinicDoctorsMap.set(clinic, []);
      }
      clinicDoctorsMap.get(clinic)!.push(stat);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  // Calculate stats for each clinic
  for (const [clinic, doctors] of clinicDoctorsMap) {
    const totalDoctors = doctors.length;
    const avgOccupation = doctors.reduce((sum, d) => sum + d.occupation_percentage, 0) / totalDoctors;
    const totalReschedules = doctors.reduce((sum, d) => sum + d.total_reschedules_30d, 0);
    const totalSlots = doctors.reduce((sum, d) => sum + d.total_slots, 0);
    const totalOccupiedSlots = doctors.reduce((sum, d) => sum + d.occupied_slots, 0);

    // Monthly occupation is the same as daily average for now
    // (occupation_percentage in doctor stats is today's occupation)
    const monthlyOccupation = avgOccupation;

    const clinicStat: ClinicStats = {
      clinic,
      total_doctors: totalDoctors,
      avg_occupation_percentage: Math.round(avgOccupation * 100) / 100,
      total_reschedules_30d: totalReschedules,
      monthly_occupation_percentage: Math.round(monthlyOccupation * 100) / 100,
      total_slots: totalSlots,
      total_occupied_slots: totalOccupiedSlots,
      monthly_total_slots: totalSlots,
      monthly_occupied_slots: totalOccupiedSlots,
      days_counted: 30, // We're using 30-day window for clinics
    };

    console.log(`[computeClinicStats] ${clinic}: ${totalDoctors} doctors (30d), ${avgOccupation.toFixed(2)}% avg occupation`);

    // Delete existing record for today (if any) then insert new one
    await supabase
      .schema("appointments_app")
      .from("clinic_stats")
      .delete()
      .eq("clinic", clinic)
      .gte("computed_at", `${today}T00:00:00`)
      .lt("computed_at", `${today}T23:59:59`);

    const { error: insertError } = await supabase
      .schema("appointments_app")
      .from("clinic_stats")
      .insert(clinicStat);

    if (insertError) {
      console.error(`[computeClinicStats] Insert error for ${clinic}:`, insertError);
    }
  }

  console.log(`[computeClinicStats] Completed. Processed ${clinicDoctorsMap.size} clinics.`);
}

// Main handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate API key
  const apiKey = req.headers.get("api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== EDGE_FUNCTIONS_API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[compute-dashboard-stats] Starting computation...");

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Get all doctors from user_profiles (users with doctor_code)
    const { data: doctors, error: doctorsError } = await supabase
      .schema("appointments_app")
      .from("user_profiles")
      .select("id, doctor_code, full_name")
      .not("doctor_code", "is", null);

    if (doctorsError) {
      throw new Error(`Failed to fetch doctors: ${doctorsError.message}`);
    }

    if (!doctors || doctors.length === 0) {
      console.log("[compute-dashboard-stats] No doctors found with doctor_code");
      return new Response(
        JSON.stringify({ success: true, message: "No doctors to process", count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[compute-dashboard-stats] Found ${doctors.length} doctors to process`);

    // Get Glintt auth token
    const glinttToken = await getGlinttAuthToken();

    // Process doctors in parallel batches
    const stats: DashboardStats[] = [];
    const DOCTOR_BATCH_SIZE = 10;

    // Helper function to process a single doctor
    async function processDoctor(doctor: DoctorProfile): Promise<DashboardStats | null> {
      try {
        console.log(`[compute-dashboard-stats] Processing doctor: ${doctor.doctor_code}`);

        // Calculate occupation and get clinics/service codes
        const { occupationPercentage, totalSlots, occupiedSlots, serviceCodes, clinics } =
          await calculateOccupationForDoctor(doctor.doctor_code, glinttToken);

        // Calculate monthly occupation
        const { monthlyOccupationPercentage, monthlyTotalSlots, monthlyOccupiedSlots, monthlyDaysCounted } =
          await calculateMonthlyOccupationForDoctor(doctor.doctor_code, serviceCodes, glinttToken);

        // Count reschedules
        const rescheduleCount = await countReschedulesLast30Days(supabase, doctor.doctor_code);

        return {
          doctor_code: doctor.doctor_code,
          doctor_name: doctor.full_name,
          occupation_percentage: occupationPercentage,
          total_slots: totalSlots,
          occupied_slots: occupiedSlots,
          total_reschedules_30d: rescheduleCount,
          clinics: clinics,
          service_codes: serviceCodes,
          monthly_occupation_percentage: monthlyOccupationPercentage,
          monthly_total_slots: monthlyTotalSlots,
          monthly_occupied_slots: monthlyOccupiedSlots,
          monthly_days_counted: monthlyDaysCounted,
        };
      } catch (err) {
        console.error(`[compute-dashboard-stats] Error processing doctor ${doctor.doctor_code}:`, err);
        return null;
      }
    }

    // Process doctors in parallel batches of 10
    const doctorList = doctors as DoctorProfile[];
    for (let i = 0; i < doctorList.length; i += DOCTOR_BATCH_SIZE) {
      const batch = doctorList.slice(i, i + DOCTOR_BATCH_SIZE);
      console.log(`[compute-dashboard-stats] Processing batch ${Math.floor(i / DOCTOR_BATCH_SIZE) + 1}/${Math.ceil(doctorList.length / DOCTOR_BATCH_SIZE)} (${batch.length} doctors)`);

      const batchResults = await Promise.all(batch.map(doctor => processDoctor(doctor)));

      // Collect successful results
      for (const result of batchResults) {
        if (result) {
          stats.push(result);
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + DOCTOR_BATCH_SIZE < doctorList.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Upsert stats into admin_dashboard_stats table
    const today = new Date().toISOString().split("T")[0];

    for (const stat of stats) {
      // Delete existing record for today (if any) then insert new one
      // This handles the unique constraint on (doctor_code, computed_at::date)
      await supabase
        .schema("appointments_app")
        .from("admin_dashboard_stats")
        .delete()
        .eq("doctor_code", stat.doctor_code)
        .gte("computed_at", `${today}T00:00:00`)
        .lt("computed_at", `${today}T23:59:59`);

      const { error: insertError } = await supabase
        .schema("appointments_app")
        .from("admin_dashboard_stats")
        .insert({
          doctor_code: stat.doctor_code,
          doctor_name: stat.doctor_name,
          occupation_percentage: stat.occupation_percentage,
          total_slots: stat.total_slots,
          occupied_slots: stat.occupied_slots,
          total_reschedules_30d: stat.total_reschedules_30d,
          clinics: stat.clinics,
          service_codes: stat.service_codes,
          monthly_occupation_percentage: stat.monthly_occupation_percentage,
          monthly_total_slots: stat.monthly_total_slots,
          monthly_occupied_slots: stat.monthly_occupied_slots,
          monthly_days_counted: stat.monthly_days_counted,
        });

      if (insertError) {
        console.error(`[compute-dashboard-stats] Insert error for ${stat.doctor_code}:`, insertError);
      }
    }

    // Compute and save clinic stats
    await computeAndSaveClinicStats(supabase, stats);

    console.log(`[compute-dashboard-stats] Completed. Processed ${stats.length} doctors.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stats.length} doctors`,
        stats,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[compute-dashboard-stats] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
