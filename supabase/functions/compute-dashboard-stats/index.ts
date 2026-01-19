// Supabase Edge Function: compute-dashboard-stats
// Computes daily occupation percentages and reschedule counts for all doctors
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
  OccupationReason?: {
    Code: string;
    Description: string;
  };
  Occupation?: boolean;
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

// Calculate occupation percentage for a doctor
async function calculateOccupationForDoctor(
  doctorCode: string,
  token: string
): Promise<{ occupationPercentage: number; totalSlots: number; occupiedSlots: number }> {
  // Get service codes for this doctor
  const serviceCodes = await getServiceCodesForDoctor(doctorCode, token);

  if (serviceCodes.length === 0) {
    console.warn(`[calculateOccupation] No service codes found for doctor ${doctorCode}`);
    return { occupationPercentage: 0, totalSlots: 0, occupiedSlots: 0 };
  }

  // Get today's date
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];

  // Fetch slots for today for each service code
  let allSlots: Slot[] = [];
  for (const serviceCode of serviceCodes) {
    const slots = await getSlotsForDay(doctorCode, serviceCode, dateStr, token);
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
    `[calculateOccupation] Doctor ${doctorCode}: ${occupiedSlots}/${totalSlots} = ${occupationPercentage.toFixed(2)}%`
  );

  return {
    occupationPercentage: Math.round(occupationPercentage * 100) / 100,
    totalSlots,
    occupiedSlots,
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

    // Process each doctor
    const stats: DashboardStats[] = [];

    for (const doctor of doctors as DoctorProfile[]) {
      try {
        console.log(`[compute-dashboard-stats] Processing doctor: ${doctor.doctor_code}`);

        // Calculate occupation
        const { occupationPercentage, totalSlots, occupiedSlots } = await calculateOccupationForDoctor(
          doctor.doctor_code,
          glinttToken
        );

        // Count reschedules
        const rescheduleCount = await countReschedulesLast30Days(supabase, doctor.doctor_code);

        stats.push({
          doctor_code: doctor.doctor_code,
          doctor_name: doctor.full_name,
          occupation_percentage: occupationPercentage,
          total_slots: totalSlots,
          occupied_slots: occupiedSlots,
          total_reschedules_30d: rescheduleCount,
        });

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`[compute-dashboard-stats] Error processing doctor ${doctor.doctor_code}:`, err);
        // Continue with next doctor
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
        });

      if (insertError) {
        console.error(`[compute-dashboard-stats] Insert error for ${stat.doctor_code}:`, insertError);
      }
    }

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
