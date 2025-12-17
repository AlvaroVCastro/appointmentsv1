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
  duration: string;
  serviceCode: string;
  medicalActCode: string;
  humanResourceCode: string;
  episodeId?: string;
  episodeType?: string;
  status?: string;
  observations?: string;
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

export async function getDoctorSchedule(
  doctorCode: string,
  startDate: string,
  endDate: string
): Promise<{ slots: Slot[]; appointments: Appointment[] }> {
  const token = await getAuthToken();

  // Step 1: Get appointments FIRST
  const appointmentsUrl = `${GLINTT_URL}/Hms.OutPatient.Api/hms/outpatient/Appointment`;
  const appointmentsParams = new URLSearchParams({
    beginDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate + 'T23:59:59').toISOString(),
    skip: '0',
    take: '100',
    doctorCode,
  });

  const appointmentsResponse = await fetch(
    `${appointmentsUrl}?${appointmentsParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  let appointments: Appointment[] = [];
  let serviceCode: string | null = null;
  
  if (appointmentsResponse.ok) {
    const appointmentsData = await appointmentsResponse.json() as RawAppointmentResponse[];
    appointments = (appointmentsData || []).map((apt: RawAppointmentResponse) => ({
      id: apt.appointmentId || apt.id || '',
      patientId: apt.patientIdentifier?.id || apt.patientId || '',
      patientName: apt.patientIdentifier?.name || apt.patientName,
      scheduleDate: apt.appointmentHour || apt.scheduleDate || apt.appointmentDate || '',
      duration: apt.duration || '',
      serviceCode: apt.performingService?.code || apt.serviceCode || '',
      medicalActCode: apt.medicalAct?.code || apt.medicalActCode || '',
      humanResourceCode: apt.doctorCode || apt.humanResourceCode || '',
      episodeId: apt.parentVisit?.id,
      episodeType: apt.parentVisit?.type,
      status: apt.status,
      observations: apt.observations,
    }));
    
    // Get service code from first appointment
    serviceCode = appointments[0]?.serviceCode || null;
  }

  console.log(`[getDoctorSchedule] Using serviceCode from appointments: ${serviceCode}`);

  if (!serviceCode) {
    console.warn(`[getDoctorSchedule] No service code found in appointments`);
    return { slots: [], appointments };
  }

  // Step 2: Make ONE ExternalSearchSlots request
  const slotsUrl = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots`;
  const slotsRequest = {
    LoadAppointments: true,
    FullSearch: true,
    NumberOfRegisters: 50,
    Patient: {},
    Period: [],
    DaysOfWeek: [],
    ExternalMedicalActSlotsList: [{
      StartDate: startDate,
      EndDate: endDate,
      MedicalActCode: '1',
      ServiceCode: serviceCode,
      RescheduleFlag: false,
      origin: 'MALO_ADMIN',
      HumanResourceCode: doctorCode,
    }],
  };

  console.log(`[getDoctorSchedule] REQUEST:`, JSON.stringify(slotsRequest, null, 2));

  let slots: Slot[] = [];
  try {
    const slotsResponse = await fetch(slotsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slotsRequest),
    });

    if (slotsResponse.ok) {
      const slotsData = await slotsResponse.json();
      console.log(`[getDoctorSchedule] RESPONSE:`, JSON.stringify(slotsData, null, 2));
      slots = slotsData?.ExternalSearchSlot || [];
    }
  } catch (err) {
    console.error(`[getDoctorSchedule] Error:`, err);
  }

  console.log(`[getDoctorSchedule] Total slots: ${slots.length}`);

  // ============================================================================
  // TEMPORARY: Hardcoded empty slots at 14:00 for testing - DELETE THIS BLOCK
  // ============================================================================
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    slots.push({
      BookingID: `TEST-${dateStr}-14`,
      SlotDateTime: `${dateStr}T14:00:00`,
      ServiceCode: serviceCode || '36',
      HumanResourceCode: doctorCode,
      Office: null,
      FirstTime: false,
      Occupation: false,  // FALSE = empty/free slot
      Duration: '2020-05-01T00:30:00',
      BestSlot: false,
      ExceedFlag: '',
      CritAppointment: '',
      OccupationReason: {
        Code: 'N',  // N = free slot
        Description: 'Slot livre',
      },
      Rubric: null,
      MedicalActCode: '1',
    });
  }
  console.log(`[getDoctorSchedule] Added ${end.getDate() - start.getDate() + 1} TEST empty slots at 14:00`);
  // ============================================================================
  // END TEMPORARY BLOCK
  // ============================================================================

  return { slots, appointments };
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
    scheduleDate: apt.appointmentHour || apt.scheduleDate || apt.appointmentDate || '',
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

