// Glintt API utility functions

const GLINTT_URL = process.env.GLINTT_URL || '';
const GLINTT_CLIENT_ID = process.env.GLINTT_CLIENT_ID || '';
const GLINTT_CLIENT_SECRET = process.env.GLINTT_CLIENT_SECRET || '';

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface Slot {
  BookingID: string;
  SlotDateTime: string;
  ServiceCode: string;
  HumanResourceCode: string;
  Office: string | null;
  FirstTime: boolean;
  Occupation: boolean;
  Duration: string;
  BestSlot: boolean;
  ExceedFlag: string;
  CritAppointment: string;
  OccupationReason: {
    Code: string;
    Description: string;
  };
  Rubric: string | null;
  MedicalActCode: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  scheduleDate: string;
  appointmentHour: string;  // The actual appointment time - used for slot matching
  duration: string;
  serviceCode: string;
  medicalActCode: string;
  humanResourceCode: string;
  episodeId?: string;
  episodeType?: string;
  status?: string;
  observations?: string;
}

// Merged slot with appointment details attached
export interface MergedSlot extends Slot {
  isOccupied: boolean;
  appointment?: Appointment;
  missingAppointmentDetails?: boolean;
}

// Raw API response type for appointments
interface RawAppointmentResponse {
  appointmentId?: string;
  id?: string;
  patientIdentifier?: {
    id?: string;
    name?: string;
  };
  patientId?: string;
  patientName?: string;
  appointmentHour?: string;
  scheduleDate?: string;
  appointmentDate?: string;
  duration?: string;
  performingService?: {
    code?: string;
  };
  serviceCode?: string;
  medicalAct?: {
    code?: string;
  };
  medicalActCode?: string;
  doctorCode?: string;
  humanResourceCode?: string;
  parentVisit?: {
    id?: string;
    type?: string;
  };
  status?: string;
  observations?: string;
}

export interface Patient {
  id: string;
  name: string;
  contacts?: {
    phoneNumber1?: string;
    phoneNumber2?: string;
    email?: string;
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

// ============================================================================
// HELPER: Minute-precision key for slot/appointment matching (timezone-safe)
// ============================================================================

/**
 * Extract minute-precision key from datetime string.
 * "2025-12-22T10:00:00" -> "2025-12-22T10:00"
 * Uses string slicing to avoid timezone conversion issues.
 */
function minuteKey(dt?: string): string | null {
  if (!dt || dt.length < 16) return null;
  return dt.slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

export async function getAuthToken(): Promise<string> {
  // Check if cached token is still valid
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const authUrl = `${GLINTT_URL}/Glintt.GPlatform.APIGateway.CoreWebAPI/token`;
  
  const formData = new URLSearchParams();
  formData.append('client_id', GLINTT_CLIENT_ID);
  formData.append('client_secret', GLINTT_CLIENT_SECRET);
  formData.append('grant_type', 'password');
  formData.append('TenantID', 'DEFAULT');
  formData.append('FacilityID', 'DEFAULT');
  formData.append('USERNAME', 'ADMIN');

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get auth token: ${response.statusText}`);
  }

  const data: AuthToken = await response.json();
  
  // Cache token with 5 minute buffer before expiration
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

// ============================================================================
// CORE SCHEDULE PIPELINE: New implementation with deterministic merging
// ============================================================================

/**
 * Fetches SCHEDULED appointments for a doctor with medicalAct=1.
 * Returns appointments and unique serviceCodes found.
 */
async function getScheduledAppointments(
  doctorCode: string,
  startDate: string,
  endDate: string
): Promise<{ appointments: Appointment[]; serviceCodes: Set<string> }> {
  const token = await getAuthToken();
  
  const appointmentsUrl = `${GLINTT_URL}/Hms.OutPatient.Api/hms/outpatient/Appointment`;
  const appointmentsParams = new URLSearchParams({
    beginDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate + 'T23:59:59').toISOString(),
    skip: '0',
    take: '500',
    doctorCode,
    status: 'SCHEDULED',
    medicalAct: '1',
  });

  const response = await fetch(
    `${appointmentsUrl}?${appointmentsParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const serviceCodes = new Set<string>();
  const appointments: Appointment[] = [];

  if (!response.ok) {
    console.warn(`[getScheduledAppointments] Failed: ${response.statusText}`);
    return { appointments, serviceCodes };
  }

  const data = await response.json() as RawAppointmentResponse[];
  
  if (!data || !Array.isArray(data)) {
    return { appointments, serviceCodes };
  }

  for (const apt of data) {
    const serviceCode = apt.performingService?.code || apt.serviceCode || '';
    if (serviceCode) {
      serviceCodes.add(serviceCode);
    }

    appointments.push({
      id: apt.appointmentId || apt.id || '',
      patientId: apt.patientIdentifier?.id || apt.patientId || '',
      patientName: apt.patientIdentifier?.name || apt.patientName,
      scheduleDate: apt.scheduleDate || apt.appointmentDate || '',
      appointmentHour: apt.appointmentHour || '',  // Key field for matching
      duration: apt.duration || '',
      serviceCode,
      medicalActCode: apt.medicalAct?.code || apt.medicalActCode || '',
      humanResourceCode: apt.doctorCode || apt.humanResourceCode || '',
      episodeId: apt.parentVisit?.id,
      episodeType: apt.parentVisit?.type,
      status: apt.status,
      observations: apt.observations,
    });
  }

  console.log(`[getScheduledAppointments] doctor=${doctorCode} appts=${appointments.length} serviceCodes=[${Array.from(serviceCodes).join(', ')}]`);
  
  return { appointments, serviceCodes };
}

/**
 * Generate an array of date strings (YYYY-MM-DD) from startDate to endDate inclusive.
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set to midnight to avoid timezone issues
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Fetches slots for a SINGLE day from ExternalSearchSlots.
 */
async function getExternalSearchSlotsForDay(
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
    ExternalMedicalActSlotsList: [{
      StartDate: date,
      EndDate: date,  // Same day - this is key for Glintt to return free slots
      MedicalActCode: '1',
      ServiceCode: serviceCode,
      RescheduleFlag: false,
      origin: 'MALO_ADMIN',
      HumanResourceCode: doctorCode,
    }],
  };

  try {
    const response = await fetch(slotsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slotsRequest),
    });

    if (!response.ok) {
      console.warn(`[getExternalSearchSlotsForDay] Failed for date=${date}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data?.ExternalSearchSlot || [];
  } catch (err) {
    console.error(`[getExternalSearchSlotsForDay] Error for date=${date}:`, err);
    return [];
  }
}

/**
 * Fetches slot grid from ExternalSearchSlots for a single serviceCode.
 * IMPORTANT: Due to a Glintt API quirk, searching by date range doesn't return free slots.
 * We must search day by day to get accurate free slot information.
 */
async function getExternalSearchSlots(
  doctorCode: string,
  serviceCode: string,
  startDate: string,
  endDate: string
): Promise<Slot[]> {
  const token = await getAuthToken();
  
  // Generate array of dates to search (day by day)
  const dates = getDateRange(startDate, endDate);
  console.log(`[getExternalSearchSlots] Searching ${dates.length} days for doctor=${doctorCode} service=${serviceCode}`);
  
  // Fetch slots for each day in parallel
  const slotPromises = dates.map(date => 
    getExternalSearchSlotsForDay(doctorCode, serviceCode, date, token)
  );
  
  const slotsPerDay = await Promise.all(slotPromises);
  
  // Flatten all slots into a single array
  const allSlots: Slot[] = [];
  let totalN = 0, totalS = 0, totalB = 0;
  
  for (let i = 0; i < dates.length; i++) {
    const daySlots = slotsPerDay[i];
    allSlots.push(...daySlots);
    
    // Count slot types per day for debugging
    let nCount = 0, sCount = 0, bCount = 0;
    for (const slot of daySlots) {
      const code = slot.OccupationReason?.Code;
      if (code === 'N') { nCount++; totalN++; }
      else if (code === 'S') { sCount++; totalS++; }
      else if (code === 'B') { bCount++; totalB++; }
    }
    
    if (daySlots.length > 0) {
      console.log(`[getExternalSearchSlots] ${dates[i]}: ${daySlots.length} slots (N=${nCount} S=${sCount} B=${bCount})`);
    }
  }
  
  console.log(`[getExternalSearchSlots] TOTAL: doctor=${doctorCode} service=${serviceCode} slots=${allSlots.length} N=${totalN} S=${totalS} B=${totalB}`);
  
  return allSlots;
}

/**
 * Deduplicates slots by SlotDateTime minute key.
 * Keeps the first occurrence of each slot.
 */
function deduplicateSlots(slots: Slot[]): Slot[] {
  const seen = new Map<string, Slot>();
  
  for (const slot of slots) {
    const key = minuteKey(slot.SlotDateTime);
    if (!key) continue;
    
    if (!seen.has(key)) {
      seen.set(key, slot);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Merges slots with appointments using exact minute matching.
 * - "B" slots are excluded
 * - "N" slots are FREE
 * - "S" slots are OCCUPIED with appointment details attached if found
 */
function mergeSlotsWithAppointments(
  slots: Slot[],
  appointments: Appointment[],
  doctorCode: string
): MergedSlot[] {
  // Build appointment index by appointmentHour minute key
  const appointmentIndex = new Map<string, Appointment>();
  for (const apt of appointments) {
    const key = minuteKey(apt.appointmentHour);
    if (key) {
      appointmentIndex.set(key, apt);
    }
  }

  const mergedSlots: MergedSlot[] = [];
  let missingMatchCount = 0;

  for (const slot of slots) {
    const code = slot.OccupationReason?.Code;
    
    // Skip blocked slots entirely
    if (code === 'B') {
      continue;
    }

    // Determine occupation status
    let isOccupied: boolean;
    if (code === 'N') {
      isOccupied = false;
    } else if (code === 'S') {
      isOccupied = true;
    } else {
      // Fallback when code is missing: use Occupation boolean
      isOccupied = slot.Occupation === true;
    }

    const mergedSlot: MergedSlot = {
      ...slot,
      isOccupied,
    };

    // For occupied slots, try to match appointment
    if (isOccupied) {
      const key = minuteKey(slot.SlotDateTime);
      const matchedAppointment = key ? appointmentIndex.get(key) : undefined;
      
      if (matchedAppointment) {
        mergedSlot.appointment = matchedAppointment;
      } else {
        mergedSlot.missingAppointmentDetails = true;
        missingMatchCount++;
        console.warn(`[mergeSlotsWithAppointments] Occupied slot ${slot.SlotDateTime} (doctor=${doctorCode}, service=${slot.ServiceCode}) has no matching appointment`);
      }
    }

    mergedSlots.push(mergedSlot);
  }

  // Sort by SlotDateTime
  mergedSlots.sort((a, b) => {
    const aKey = minuteKey(a.SlotDateTime) || '';
    const bKey = minuteKey(b.SlotDateTime) || '';
    return aKey.localeCompare(bKey);
  });

  console.log(`[mergeSlotsWithAppointments] merged=${mergedSlots.length} missingMatches=${missingMatchCount}`);
  
  return mergedSlots;
}

/**
 * Main schedule function: orchestrates the new pipeline.
 * 1. Fetch SCHEDULED appointments (status=SCHEDULED, medicalAct=1)
 * 2. Extract unique serviceCodes (or fallback to doctor profile lookup)
 * 3. Fetch slots for each serviceCode
 * 4. Deduplicate and merge slots with appointments
 */
export async function getDoctorSchedule(
  doctorCode: string,
  startDate: string,
  endDate: string
): Promise<{ slots: MergedSlot[]; appointments: Appointment[] }> {
  // Step 1: Get SCHEDULED appointments
  const { appointments, serviceCodes } = await getScheduledAppointments(
    doctorCode,
    startDate,
    endDate
  );

  // Step 2: Determine serviceCodes to use
  let codesToUse = serviceCodes;
  
  if (codesToUse.size === 0) {
    console.warn(`[getDoctorSchedule] No appointments found for doctor=${doctorCode}, using fallback serviceCode lookup`);
    const fallbackCodes = await getServiceCodesForDoctor(doctorCode);
    if (fallbackCodes.length > 0) {
      codesToUse = new Set(fallbackCodes);
      console.log(`[getDoctorSchedule] Fallback serviceCodes: [${fallbackCodes.join(', ')}]`);
    } else {
      console.warn(`[getDoctorSchedule] No serviceCodes found for doctor=${doctorCode}, returning empty`);
      return { slots: [], appointments: [] };
    }
  }

  // Step 3: Fetch slots for each serviceCode
  const allSlots: Slot[] = [];
  for (const serviceCode of codesToUse) {
    const slots = await getExternalSearchSlots(doctorCode, serviceCode, startDate, endDate);
    allSlots.push(...slots);
  }

  // Step 4: Deduplicate slots (same time may appear for multiple serviceCodes)
  const uniqueSlots = deduplicateSlots(allSlots);
  console.log(`[getDoctorSchedule] Total slots after dedup: ${uniqueSlots.length} (from ${allSlots.length})`);

  // Step 5: Merge slots with appointments
  const mergedSlots = mergeSlotsWithAppointments(uniqueSlots, appointments, doctorCode);

  return { slots: mergedSlots, appointments };
}

export async function getFutureAppointments(
  startDate: string,
  endDate: string,
  serviceCode: string,
  doctorCode: string
): Promise<Appointment[]> {
  const token = await getAuthToken();
  
  const appointmentsUrl = `${GLINTT_URL}/Hms.OutPatient.Api/hms/outpatient/Appointment`;
  const appointmentsParams = new URLSearchParams({
    beginDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate + 'T23:59:59').toISOString(),
    skip: '0',
    take: '20', // Reduced to 20 - we only need 10 patients
    serviceCode, // Filter by service code
    doctorCode, // Filter by doctor code
  });

  const response = await fetch(
    `${appointmentsUrl}?${appointmentsParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get appointments: ${response.statusText}`);
  }

  const data = await response.json() as RawAppointmentResponse[];
  
  // Map to our structure (filtering by service code and doctor code is done server-side)
  return (data || []).map((apt: RawAppointmentResponse) => ({
    id: apt.appointmentId || apt.id || '',
    patientId: apt.patientIdentifier?.id || apt.patientId || '',
    patientName: apt.patientIdentifier?.name || apt.patientName,
    scheduleDate: apt.scheduleDate || apt.appointmentDate || '',
    appointmentHour: apt.appointmentHour || '',
    duration: apt.duration || '',
    serviceCode: apt.performingService?.code || apt.serviceCode || '',
    medicalActCode: apt.medicalAct?.code || apt.medicalActCode || '',
    humanResourceCode: apt.doctorCode || apt.humanResourceCode || '',
    episodeId: apt.parentVisit?.id,
    episodeType: apt.parentVisit?.type,
    status: apt.status,
    observations: apt.observations,
  }));
}

export interface HumanResource {
  HumanResourceCode: string;
  HumanResourceName: string;
  ServiceCode?: string;
  ServiceDescription?: string;
  Type?: string;
}

// Response type from /humanresources/search-detail endpoint
interface HumanResourceDetail {
  ServiceCode?: string;
  ServiceDescription?: string;
  HumanResourceCode: string;
  HumanResourceName?: string;
  MarcFlag?: boolean;
  RegFlag?: boolean;
  Valid?: boolean;
  Deleted?: boolean;
}

// Cache for service codes per doctor (5 minute TTL)
const serviceCodeCache = new Map<string, { codes: string[]; expiresAt: number }>();

/**
 * Fetches service codes for a doctor from the /humanresources/search-detail endpoint.
 * Returns an array of unique service codes, or empty array if none found or on error.
 */
async function getServiceCodesForDoctor(doctorCode: string): Promise<string[]> {
  // Check cache first
  const cached = serviceCodeCache.get(doctorCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.codes;
  }

  try {
    const token = await getAuthToken();
    
    const hrDetailUrl = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/humanresources/search-detail`;
    const params = new URLSearchParams({
      skip: '0',
      take: '100',
    });

    const requestBody = {
      HumanResourceIDs: [doctorCode],
    };

    const response = await fetch(`${hrDetailUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(
        `[getServiceCodesForDoctor] Failed to fetch service codes for doctor ${doctorCode}: ${response.statusText}`
      );
      return [];
    }

    const data: HumanResourceDetail[] = await response.json();
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(
        `[getServiceCodesForDoctor] No service details found for doctor ${doctorCode}`
      );
      return [];
    }

    // Filter by doctorCode and collect unique service codes
    const serviceCodesSet = new Set<string>();
    data.forEach((item) => {
      if (item.HumanResourceCode === doctorCode && item.ServiceCode) {
        serviceCodesSet.add(item.ServiceCode);
      }
    });

    const codes = Array.from(serviceCodesSet);

    // Cache the result for 5 minutes
    serviceCodeCache.set(doctorCode, {
      codes,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return codes;
  } catch (error) {
    console.warn(
      `[getServiceCodesForDoctor] Error fetching service codes for doctor ${doctorCode}:`,
      error
    );
    return [];
  }
}

export interface DoctorSearchResult {
  id: string;
  code?: string;
  name: string;
}

export async function getHumanResource(humanResourceCode: string): Promise<HumanResource | null> {
  const token = await getAuthToken();
  
  const hrUrl = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/humanresources/search`;
  const params = new URLSearchParams({
    skip: '0',
    take: '1',
  });

  const requestBody = {
    SearchString: '',
    HumanResourceIDs: [humanResourceCode],
    Types: ['MED'], // Filter by doctor type
  };

  const response = await fetch(`${hrUrl}?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data || data.length === 0) {
    return null;
  }

  const hr = data[0];
  return {
    HumanResourceCode: hr.HumanResourceCode || hr.ID || humanResourceCode,
    HumanResourceName: hr.HumanResourceName || hr.Name || '',
    ServiceCode: hr.ServiceCode,
    ServiceDescription: hr.ServiceDescription,
    Type: hr.Type,
  };
}

export async function getPatient(patientId: string): Promise<Patient | null> {
  const token = await getAuthToken();
  
  const patientUrl = `${GLINTT_URL}/Hms.PatientAdministration.Api/hms/patientadministration/Patient/search`;
  const params = new URLSearchParams({
    patientId,
    skip: '0',
    take: '1', // Optimized - we only need one patient
  });

  const response = await fetch(`${patientUrl}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data || data.length === 0) {
    return null;
  }

  const patient = data[0];
  return {
    id: patient.id,
    name: patient.name,
    contacts: patient.contacts,
  };
}

// ============================================================================
// RECOMMENDATION ENGINE TYPES AND FUNCTIONS
// ============================================================================

/**
 * Normalized appointment for the recommendation engine.
 * Includes computed start/end times and duration in minutes.
 */
export interface ComparableAppointment {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  doctorCode: string;
  serviceCode?: string;
  medicalActCode?: string;
  startDateTime: string; // ISO string
  endDateTime: string;   // ISO string
  durationMinutes: number;
  status?: string;
}

/**
 * A conciliated block represents one or more consecutive appointments
 * for the same patient on the same day with the same doctor.
 */
export interface ConciliatedBlock {
  blockId: string;
  patientId: string;
  patientName?: string;
  doctorCode: string;
  startDateTime: string;  // start of the first appointment
  endDateTime: string;    // end of the last appointment
  durationMinutes: number; // total duration of the block
  appointments: ComparableAppointment[];
}

/**
 * Helper to parse duration string (HH:MM:SS) to minutes.
 */
function parseDurationToMinutes(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return 0;
}

/**
 * Helper to compute end time from start time and duration.
 */
function computeEndDateTime(startDateTime: string, durationMinutes: number): string {
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
}

/**
 * Fetches all appointments for a doctor within a time window (e.g., 30 days).
 * Returns normalized ComparableAppointment objects.
 */
export async function getDoctorAppointmentsForWindow(
  doctorCode: string,
  fromDate: string,
  toDate: string
): Promise<ComparableAppointment[]> {
  const token = await getAuthToken();
  
  const appointmentsUrl = `${GLINTT_URL}/Hms.OutPatient.Api/hms/outpatient/Appointment`;
  const appointmentsParams = new URLSearchParams({
    beginDate: new Date(fromDate).toISOString(),
    endDate: new Date(toDate + 'T23:59:59').toISOString(),
    skip: '0',
    take: '500', // Fetch more for 30-day window
    doctorCode,
  });

  const response = await fetch(
    `${appointmentsUrl}?${appointmentsParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    console.warn(
      `[getDoctorAppointmentsForWindow] Failed to fetch appointments for doctor ${doctorCode}: ${response.statusText}`
    );
    return [];
  }

  const data = await response.json() as RawAppointmentResponse[];
  
  if (!data || !Array.isArray(data)) {
    return [];
  }

  // Normalize to ComparableAppointment, excluding ANNULLED and RESCHEDULED
  const appointments: ComparableAppointment[] = [];
  
  for (const apt of data) {
    // Skip cancelled/rescheduled appointments - they are not valid candidates
    const status = apt.status?.toUpperCase();
    if (status === 'ANNULLED' || status === 'RESCHEDULED') {
      continue;
    }

    // Only include appointments with MedicalActCode = '1' (business rule)
    const medicalActCode = apt.medicalAct?.code || apt.medicalActCode || '';
    if (medicalActCode !== '1') {
      continue;
    }

    const startDateTime = apt.appointmentHour || apt.scheduleDate || apt.appointmentDate || '';
    if (!startDateTime) continue;

    const durationStr = apt.duration || '00:30:00'; // Default 30 min if not specified
    const durationMinutes = parseDurationToMinutes(durationStr);
    const endDateTime = computeEndDateTime(startDateTime, durationMinutes);

    appointments.push({
      appointmentId: apt.appointmentId || apt.id || '',
      patientId: apt.patientIdentifier?.id || apt.patientId || '',
      patientName: apt.patientIdentifier?.name || apt.patientName,
      doctorCode: apt.doctorCode || apt.humanResourceCode || doctorCode,
      serviceCode: apt.performingService?.code || apt.serviceCode,
      medicalActCode, // Already extracted and validated as '1'
      startDateTime,
      endDateTime,
      durationMinutes,
      status: apt.status,
    });
  }

  return appointments;
}

/**
 * Builds conciliated (aggregated) blocks from a list of appointments.
 * Groups consecutive appointments by patient + date + doctor.
 */
export function buildConciliatedBlocks(
  appointments: ComparableAppointment[],
  doctorCode: string
): ConciliatedBlock[] {
  // Filter by doctor and ensure we have valid data
  const filtered = appointments.filter(
    apt => apt.doctorCode === doctorCode && apt.patientId && apt.startDateTime
  );

  if (filtered.length === 0) {
    return [];
  }

  // Group by patient + date
  const groupKey = (apt: ComparableAppointment): string => {
    const dateOnly = apt.startDateTime.split('T')[0];
    return `${apt.patientId}-${dateOnly}`;
  };

  const groups = new Map<string, ComparableAppointment[]>();
  
  for (const apt of filtered) {
    const key = groupKey(apt);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(apt);
  }

  const blocks: ConciliatedBlock[] = [];

  for (const [, groupAppts] of groups) {
    // Sort by start time within each group
    groupAppts.sort((a, b) => 
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );

    // Build blocks by detecting consecutive appointments
    let currentBlock: ComparableAppointment[] = [];

    for (let i = 0; i < groupAppts.length; i++) {
      const apt = groupAppts[i];

      if (currentBlock.length === 0) {
        currentBlock.push(apt);
      } else {
        const lastApt = currentBlock[currentBlock.length - 1];
        const lastEndTime = new Date(lastApt.endDateTime).getTime();
        const currentStartTime = new Date(apt.startDateTime).getTime();

        // Check if consecutive (allow 1 minute tolerance)
        const toleranceMs = 60 * 1000; // 1 minute
        if (Math.abs(currentStartTime - lastEndTime) <= toleranceMs) {
          // Consecutive - add to current block
          currentBlock.push(apt);
        } else {
          // Not consecutive - close current block and start new one
          blocks.push(createBlockFromAppointments(currentBlock, doctorCode));
          currentBlock = [apt];
        }
      }
    }

    // Don't forget the last block
    if (currentBlock.length > 0) {
      blocks.push(createBlockFromAppointments(currentBlock, doctorCode));
    }
  }

  return blocks;
}

/**
 * Creates a ConciliatedBlock from a list of appointments.
 */
function createBlockFromAppointments(
  appointments: ComparableAppointment[],
  doctorCode: string
): ConciliatedBlock {
  const first = appointments[0];
  const last = appointments[appointments.length - 1];
  const totalDuration = appointments.reduce((sum, apt) => sum + apt.durationMinutes, 0);

  // Use first appointment's start time for block ID
  const dateOnly = first.startDateTime.split('T')[0];
  const timeOnly = first.startDateTime.split('T')[1]?.split('.')[0] || '00:00:00';
  const blockId = `${first.patientId}-${dateOnly}-${timeOnly}`;

  return {
    blockId,
    patientId: first.patientId,
    patientName: first.patientName,
    doctorCode,
    startDateTime: first.startDateTime,
    endDateTime: last.endDateTime,
    durationMinutes: totalDuration,
    appointments,
  };
}

// ============================================================================
// RESCHEDULE FUNCTIONALITY
// ============================================================================

/**
 * Parameters for rescheduling an appointment.
 */
export interface RescheduleParams {
  appointmentId: string;      // The appointment to reschedule (used as Episode ID)
  patientId: string;
  serviceCode: string;
  medicalActCode: string;
  // Target slot info
  targetSlotDateTime: string; // Where to move it (ISO string)
  targetBookingID: string;    // From ExternalSearchSlots
  targetDuration: string;     // From ExternalSearchSlots (e.g., "2008-09-01T01:00:00")
  targetDoctorCode: string;   // HumanResourceCode
}

/**
 * Result of a reschedule operation.
 */
export interface RescheduleResult {
  success: boolean;
  appointmentId: string;      // Original appointment ID
  newAppointmentId?: string;  // New appointment ID (if returned by Glintt)
  error?: string;
}

/**
 * Reschedules a single appointment to a new slot in Glintt.
 *
 * Uses ExternalScheduleAppointment with RescheduleFlag=true and Episode context.
 * Based on working implementation from backend/glintt-tests/glintt_client.py
 *
 * @param params - Reschedule parameters
 * @returns Result indicating success/failure
 */
export async function rescheduleAppointment(params: RescheduleParams): Promise<RescheduleResult> {
  console.log(`[rescheduleAppointment] Starting reschedule:`);
  console.log(`  - appointmentId (Episode): ${params.appointmentId}`);
  console.log(`  - patientId: ${params.patientId}`);
  console.log(`  - serviceCode: ${params.serviceCode}`);
  console.log(`  - medicalActCode: ${params.medicalActCode}`);
  console.log(`  - targetSlotDateTime: ${params.targetSlotDateTime}`);
  console.log(`  - targetBookingID: ${params.targetBookingID}`);
  console.log(`  - targetDuration: ${params.targetDuration}`);
  console.log(`  - targetDoctorCode: ${params.targetDoctorCode}`);

  try {
    const token = await getAuthToken();

    // Build the appointment data payload (from working test harness)
    const appointmentData = {
      ServiceCode: params.serviceCode,
      MedicalActCode: params.medicalActCode,
      HumanResourceCode: params.targetDoctorCode,
      FinancialEntity: {
        EntityCode: "998",  // Standard value from test harness
        EntityCard: "",
        Exemption: "S"
      },
      ScheduleDate: params.targetSlotDateTime,
      Duration: params.targetDuration,
      Origin: "MALO_ADMIN",
      BookingID: params.targetBookingID,
      Patient: {
        PatientType: "MC",
        PatientID: params.patientId
      },
      // CRITICAL for reschedule:
      RescheduleFlag: true,
      Episode: {
        EpisodeType: "Consultas",
        EpisodeID: params.appointmentId  // The appointment being rescheduled
      }
    };

    // Glintt expects array
    const requestBody = [appointmentData];

    console.log(`[rescheduleAppointment] Request payload:`, JSON.stringify(requestBody, null, 2));

    const endpoint = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalScheduleAppointment`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    console.log(`[rescheduleAppointment] Response status: ${response.status}`);
    console.log(`[rescheduleAppointment] Response data:`, JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      const errorMsg = typeof responseData === 'object'
        ? (responseData.errorDetails || responseData.message || JSON.stringify(responseData))
        : String(responseData);

      console.error(`[rescheduleAppointment] HTTP error ${response.status}: ${errorMsg}`);

      return {
        success: false,
        appointmentId: params.appointmentId,
        error: `HTTP ${response.status}: ${errorMsg}`,
      };
    }

    // Check for errors in response body
    if (typeof responseData === 'object') {
      if (responseData.errorDetails) {
        console.error(`[rescheduleAppointment] Glintt error:`, responseData.errorDetails);
        return {
          success: false,
          appointmentId: params.appointmentId,
          error: responseData.errorDetails,
        };
      }
    }

    // Extract new appointment ID if present
    const newAppointmentId = responseData?.appointmentID || responseData?.AppointmentID;

    console.log(`[rescheduleAppointment] SUCCESS - appointmentId: ${params.appointmentId} -> newAppointmentId: ${newAppointmentId || 'not returned'}`);

    return {
      success: true,
      appointmentId: params.appointmentId,
      newAppointmentId: newAppointmentId || undefined,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[rescheduleAppointment] Exception:`, errorMsg);

    return {
      success: false,
      appointmentId: params.appointmentId,
      error: errorMsg,
    };
  }
}

