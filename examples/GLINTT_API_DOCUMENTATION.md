# Glintt HMS API Documentation

This document provides comprehensive documentation for the Glintt HMS API endpoints used in the voice agent system. All endpoints require authentication via bearer token.

## Table of Contents

1. [Authentication](#authentication)
2. [Patient Endpoints](#patient-endpoints)
3. [Appointment Endpoints](#appointment-endpoints)
4. [Human Resources Endpoints](#human-resources-endpoints)
5. [Financial Document Endpoints](#financial-document-endpoints)

---

## Authentication

### Get Authentication Token

**Endpoint:** `POST /Glintt.GPlatform.APIGateway.CoreWebAPI/token`

**Headers:**
- `Content-Type: application/x-www-form-urlencoded`

**Request Body (form-data):**
- `client_id` (required): Application client ID
- `client_secret` (required): Application client secret
- `grant_type` (required): Always "password"
- `TenantID` (required): Tenant ID (typically "DEFAULT")
- `FacilityID` (required): Facility ID (typically "DEFAULT")
- `USERNAME` (required): Username (typically "ADMIN")

**Example:**
```python
auth_data = {
    'client_id': 'MALO_AUGUSTALABS',
    'client_secret': '06B1AB3A-AA9A-EF4E-E063-0901820A785F',
    'grant_type': 'password',
    'TenantID': 'DEFAULT',
    'FacilityID': 'DEFAULT',
    'USERNAME': 'ADMIN'
}
```

**Response:**
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## Patient Endpoints

### 1. Create/Update Patient

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI.ExternalAccess/api/hms/Patient/CreateUpdatePatient?callingApp={callingApp}`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`
- `Accept: text/plain`
- `Accept-Encoding: gzip, deflate, br`

**Request Body:**
```json
{
  "Patient": {
    "PatientType": "MC"  // Required - Patient type (e.g., "MC")
  },
  "Name": "João Silva",  // Required - Patient name
  "PatientData": {
    "Gender": "M",  // Required - Gender (M/F)
    "Birthdate": "1990-05-15",  // Required - Birthdate (YYYY-MM-DD format)
    "FinancialEntityID": "998",  // Required - Financial entity ID
    "PhoneNumber1": "+351912345678",  // Optional - Primary phone number
    "Email": "joao.silva@example.com"  // Optional - Email address
  }
}
```

**Required Fields:**
- `Patient.PatientType` - Patient type
- `Name` - Patient name
- `PatientData.Gender` - Gender (M/F)
- `PatientData.Birthdate` - Birthdate in YYYY-MM-DD format
- `PatientData.FinancialEntityID` - Financial entity ID

**Optional Fields:**
- `PatientData.PhoneNumber1` - Primary phone
- `PatientData.PhoneNumber2` - Secondary phone
- `PatientData.Email` - Email address
- `PatientData.Address` - Address
- `PatientData.CountryID` - Country ID
- `PatientData.City` - City
- `PatientData.PostalCode` - Postal code
- `PatientData.CitizenNumber` - Citizen number
- `PatientData.TaxPayerNumber` - Tax payer number
- `PatientData.Observations` - Observations

**Note:** Gender, Birthdate, and FinancialEntityID are required fields. Without them, the API will return validation errors.

---

### 2. Search Patient by ID

**Endpoint:** `GET /Hms.PatientAdministration.Api/hms/patientadministration/Patient/search`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Query Parameters:**
- `patientId` (required): Patient ID to search for
- `skip` (optional): Number of records to skip (default: 0)
- `take` (optional): Number of records to take (default: 10)

**Example:**
```
GET /Hms.PatientAdministration.Api/hms/patientadministration/Patient/search?patientId=150846&skip=0&take=10
```

**Response:**
```json
[
  {
    "id": "150846",
    "name": "Patient Name",
    "type": "MC",
    "administrativeGender": "M",
    "birthDate": "1990-05-15",
    "fiscalNumber": "123456789",
    "citizenCard": "12345678",
    "nationalHealthCard": "123456789012",
    "deceased": false,
    "address": {
      "streetName": "Rua das Flores",
      "city": "Lisboa",
      "zipCode": "1000-001",
      "country": "PT"
    },
    "contacts": {
      "phoneNumber1": "+351912345678",
      "phoneNumber2": "+351987654321",
      "email": "patient@example.com"
    }
  }
]
```

---

## Appointment Endpoints

### 1. Search Available Slots

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "LoadAppointments": false,  // Optional - Load appointments or just available slots
  "FullSearch": true,  // Optional - Full search flag
  "NumberOfRegisters": 20,  // Optional - Number of results
  "Patient": {
    "PatientType": "MC",  // Optional - Patient type
    "PatientID": "150846"  // Optional - Patient ID
  },
  "Period": [],  // Optional - Empty list
  "DaysOfWeek": [],  // Optional - Empty list
  "ExternalMedicalActSlotsList": [
    {
      "StartDate": "2025-10-28",  // Required - Start date (YYYY-MM-DD)
      "EndDate": "2025-10-30",  // Required - End date (YYYY-MM-DD)
      "MedicalActCode": "1",  // Required - Medical act code
      "ServiceCode": "36",  // Required - Service code
      "RescheduleFlag": false,  // Optional - Reschedule flag
      "origin": "MALO_ADMIN",  // Optional - Origin identifier
      "HumanResourceCode": "22"  // Optional - Doctor/resource code
    }
  ]
}
```

**Required Fields:**
- `ExternalMedicalActSlotsList[].StartDate` - Start date in YYYY-MM-DD format
- `ExternalMedicalActSlotsList[].EndDate` - End date in YYYY-MM-DD format
- `ExternalMedicalActSlotsList[].MedicalActCode` - Medical act code
- `ExternalMedicalActSlotsList[].ServiceCode` - Service code

**Optional Fields:**
- `LoadAppointments` - Load appointments or slots
- `FullSearch` - Full search flag
- `NumberOfRegisters` - Number of results to return
- `Patient.PatientType` - Patient type
- `Patient.PatientID` - Patient ID
- `HumanResourceCode` - Filter by specific doctor/resource
- `RescheduleFlag` - Indicates if this is a reschedule request
- `origin` - Origin identifier

**Response:** Array of available time slots with booking information

---

### 2. Schedule Appointment (First Time)

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalScheduleAppointment`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
[
  {
    "serviceCode": "36",  // Required - Service code
    "MedicalActCode": "1",  // Required - Medical act code
    "HumanResourceCode": "1748",  // Required - Doctor/resource code
    "FinancialEntity": {
      "code": "998",  // Required - Financial entity code
      "description": "PARTICULARES",  // Optional - Description
      "exemption": "S"  // Optional - Exemption status
    },
    "ScheduleDate": "2025-09-24T17:00:00",  // Required - Appointment date/time (ISO 8601)
    "Duration": "01:00:00",  // Required - Duration (HH:MM:SS)
    "FirstTime": true,  // Optional - First time flag
    "origin": "MALO_ADMIN",  // Optional - Origin identifier
    "Patient": {
      "PatientType": "MC",  // Required - Patient type
      "PatientID": "150846"  // Required - Patient ID
    }
  }
]
```

**Required Fields:**
- `serviceCode` - Service code
- `MedicalActCode` - Medical act code
- `HumanResourceCode` - Doctor/resource code
- `FinancialEntity.code` - Financial entity code
- `ScheduleDate` - Appointment date/time (YYYY-MM-DDTHH:MM:SS format)
- `Duration` - Duration (HH:MM:SS format)
- `Patient.PatientType` - Patient type
- `Patient.PatientID` - Patient ID

**Optional Fields:**
- `FinancialEntity.description` - Financial entity description
- `FinancialEntity.exemption` - Exemption status
- `FirstTime` - First time flag
- `origin` - Origin identifier

**Note:** Request body must be an array containing one or more appointment objects.

---

### 3. Reschedule Appointment

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalScheduleAppointment`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
[
  {
    "ServiceCode": "36",  // Required - Service code
    "MedicalActCode": "1",  // Required - Medical act code
    "HumanResourceCode": "22",  // Required - Doctor/resource code
    "FinancialEntity": {
      "EntityCode": "998",  // Required - Financial entity code
      "EntityCard": "",  // Optional - Entity card
      "Exemption": "S"  // Optional - Exemption status
    },
    "ScheduleDate": "2025-09-25T10:30:00",  // Required - New appointment date/time
    "Duration": "01:00:00",  // Required - Duration (comes from slot search)
    "RescheduleFlag": true,  // Required - Must be true for reschedule
    "BookingID": "391",  // Required - Booking ID from slot search
    "Origin": "MALO_ADMIN",  // Optional - Origin identifier
    "Patient": {
      "PatientType": "MC",  // Required - Patient type
      "PatientID": "150847"  // Required - Patient ID
    },
    "Episode": {
      "EpisodeType": "Consultas",  // Required - Episode type
      "EpisodeID": "2722802"  // Required - Current appointment ID
    }
  }
]
```

**Required Fields:**
- `ServiceCode` - Service code
- `MedicalActCode` - Medical act code
- `HumanResourceCode` - Doctor/resource code
- `FinancialEntity.EntityCode` - Financial entity code
- `ScheduleDate` - New appointment date/time
- `Duration` - Duration from slot search
- `RescheduleFlag` - Must be true
- `BookingID` - Booking ID from slot search
- `Patient.PatientType` - Patient type
- `Patient.PatientID` - Patient ID
- `Episode.EpisodeType` - Episode type
- `Episode.EpisodeID` - Current appointment ID

**Note:** The `BookingID` and `Duration` must come from the result of the availability endpoint (ExternalSearchSlots). When rescheduling, include the Episode information with the current appointment details.

---

### 4. Get Appointments by Date Range

**Endpoint:** `GET /Hms.OutPatient.Api/hms/outpatient/Appointment`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Query Parameters:**
- `beginDate` (required): Start date (ISO 8601 format)
- `endDate` (required): End date (ISO 8601 format)
- `skip` (optional): Number of records to skip
- `take` (optional): Number of records to take

**Example:**
```
GET /Hms.OutPatient.Api/hms/outpatient/Appointment?beginDate=2025-10-29T08:00:00&endDate=2025-10-29T08:30:59&skip=0&take=100
```

**Response:** Array of appointment objects

---

### 5. Process Appointments (Update Observations)

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI/api/hms/appointment/ProcessAppointmentsV2`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
[
  {
    "AppointmentNumber": "2722830",  // Required - Appointment number
    "Action": "AO",  // Required - Action code (AO = Appointment Operation)
    "ActionObservations": "teste de rescrita"  // Optional - Observations/notes
  }
]
```

**Required Fields:**
- `AppointmentNumber` - The appointment number
- `Action` - Action code (e.g., "AO" for Appointment Operation)

**Optional Fields:**
- `ActionObservations` - Observations or notes to add

**Note:** This endpoint is used to update appointment observations or perform other actions on appointments.

---

## Human Resources Endpoints

### 1. Search Human Resources

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI/api/hms/humanresources/search`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Query Parameters:**
- `skip` (optional): Number of records to skip (default: 0)
- `take` (optional): Number of records to take (default: 9999)

**Request Body:**
```json
{
  "SearchString": "Antonio Bastos",  // Optional - Search string
  "HumanResourceIDs": [],  // Optional - Filter by IDs (empty array for all)
  "Types": ["MED", "ENF", "TEC"]  // Optional - Filter by types
}
```

**Required Fields:** None

**Optional Fields:**
- `SearchString` - Search string to filter by name
- `HumanResourceIDs` - Array of specific resource IDs to search for
- `Types` - Array of types to filter: "MED" (Doctor), "ENF" (Nurse), "TEC" (Technician)

**Response:** Array of human resources matching the search criteria

---

### 2. Get Human Resources Details

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI/api/hms/humanresources/search-detail`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Query Parameters:**
- `skip` (optional): Number of records to skip
- `take` (optional): Number of records to take

**Request Body:**
```json
{
  "HumanResourceIDs": ["22"]  // Required - Array of human resource IDs
}
```

**Required Fields:**
- `HumanResourceIDs` - Array of human resource IDs

**Response:** Detailed information about the specified human resources

---

## Financial Document Endpoints

### 1. Get Financial Documents

**Endpoint:** `POST /Glintt.HMS.CoreWebAPI.ExternalAccess/api/hms/Billing/FinancialDocuments/Patient`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Query Parameters:**
- `skip` (optional): Number of records to skip
- `take` (optional): Number of records to take

**Request Body:**
```json
{
  "BeginDate": "2025-10-29T00:00:00",  // Required - Start date (ISO 8601)
  "EndDate": "2025-10-29T23:59:59"  // Required - End date (ISO 8601)
}
```

**Required Fields:**
- `BeginDate` - Start date in ISO 8601 format
- `EndDate` - End date in ISO 8601 format

**Response:** Array of financial documents within the specified date range

---

### 2. Get Financial Document Detail

**Endpoint:** `GET /Hms.Billing.FinancialDocuments.Api/hms/financialdocumentdetail`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Query Parameters:**
- `documentNumber` (required): Document number (integer)
- `documentSeries` (required): Document series (string)
- `documentType` (required): Document type (string)

**Example:**
```
GET /Hms.Billing.FinancialDocuments.Api/hms/financialdocumentdetail?documentNumber=22858&documentSeries=MCFR25&documentType=FACTR
```

**Required Fields:**
- `documentNumber` - Document number
- `documentSeries` - Document series
- `documentType` - Document type

**Response:** Detailed information about the specified financial document

---

## Common Patterns

### Base URL
Most endpoints use one of these base URLs:
- Test Environment: `http://194.65.85.129:14000`
- Production Environment: `http://194.65.85.129:14100`

### Authentication
All authenticated requests require:
```
Authorization: Bearer {access_token}
```

### Request/Response Format
- Most endpoints use `application/json` for Content-Type
- Request bodies are typically JSON objects or arrays
- Responses are typically JSON arrays or objects

### Date Format
- Dates should be in ISO 8601 format: `YYYY-MM-DDTHH:MM:SS`
- Date-only fields use: `YYYY-MM-DD`
- Duration fields use: `HH:MM:SS`

---

## Notes

1. The Glintt HMS API has strict validation for required fields. Missing required fields will result in error responses.

2. When rescheduling appointments, you must first search for available slots using `ExternalSearchSlots`, then use the `BookingID` and `Duration` from the search results.

3. Patient creation requires at minimum: Name, Gender, Birthdate, and FinancialEntityID.

4. The `Episode` object is required when rescheduling appointments to reference the existing appointment.

5. All financial entity objects use different field names depending on the endpoint (e.g., `code` vs `EntityCode`).

---

## Error Responses

Most endpoints return errors in the following format:
```json
{
  "Errors": [
    {
      "Code": 20999,
      "Source": [
        {
          "Pointer": "Patient/CreateUpdatePatient"
        }
      ],
      "Title": "Error",
      "Detail": "Error description here"
    }
  ]
}
```

Common error codes:
- 20999: General validation error
- 400: Bad request
- 401: Unauthorized
- 404: Not found
- 500: Internal server error
