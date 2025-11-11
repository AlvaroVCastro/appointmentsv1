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
  
  // Get appointments - optimized to only fetch what we need
  const appointmentsUrl = `${GLINTT_URL}/Hms.OutPatient.Api/hms/outpatient/Appointment`;
  const appointmentsParams = new URLSearchParams({
    beginDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate + 'T23:59:59').toISOString(),
    skip: '0',
    take: '100',
    doctorCode, // Filter by doctor code
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
  if (appointmentsResponse.ok) {
    const appointmentsData = await appointmentsResponse.json() as RawAppointmentResponse[];
    // Map to our structure (filtering by doctor code is done server-side now)
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
  }

  // Get availability slots - optimized settings
  const slotsUrl = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots`;
  
  const slotsRequest = {
    LoadAppointments: false, // We fetch appointments separately, so no need to load here
    FullSearch: true,
    NumberOfRegisters: 50, // Reduced from 100 - 7 days shouldn't need more slots
    Patient: {
      PatientType: 'MC',
    },
    Period: [],
    DaysOfWeek: [],
    ExternalMedicalActSlotsList: [
      {
        StartDate: startDate,
        EndDate: endDate,
        MedicalActCode: '1', // Default, can be parameterized later
        ServiceCode: '36', // Default, can be parameterized later
        RescheduleFlag: false,
        HumanResourceCode: doctorCode, // Already filtered by doctor
        Origin: 'MALO_ADMIN',
      },
    ],
  };

  const slotsResponse = await fetch(slotsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(slotsRequest),
  });

  if (!slotsResponse.ok) {
    throw new Error(`Failed to get slots: ${slotsResponse.statusText}`);
  }

  const slotsData = await slotsResponse.json();
  const slots: Slot[] = slotsData?.ExternalSearchSlot || [];

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

