# Glintt Test Harness

Developer test tool to validate Glintt scheduling and rescheduling payloads in the **TEST environment**.

> **WARNING**: This is NOT product code. It's a developer tool for validating API contracts and environment readiness.

---

## Prerequisites

### Python Version

- Python 3.9+

### Dependencies

```bash
pip install requests python-dotenv
```

Or use the requirements file:

```bash
pip install -r requirements.txt
```

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cd backend/glintt-tests
cp env.example.txt .env
# Edit .env with your actual values
```

Or create a `.env` file manually in this directory:

```env
# Glintt API Base URL (TEST environment)
GLINTT_BASE_URL=https://your-glintt-test-api.example.com

# Authentication credentials
GLINTT_CLIENT_ID=your-client-id
GLINTT_CLIENT_SECRET=your-client-secret
GLINTT_TENANT_ID=your-tenant-id
GLINTT_FACILITY_ID=your-facility-id
GLINTT_USERNAME=your-username

# Test configuration
GLINTT_TEST_PATIENT_ID=150847
GLINTT_TEST_SERVICE_CODE=36
GLINTT_TEST_MEDICAL_ACT_CODE=1
GLINTT_TEST_DOCTOR_CODE=22
```

> **SECURITY**: Never commit `.env` files. The `.gitignore` should exclude them.

---

## Running the Tests

### Option 1: Automated Test Runner (Recommended)

The test runner executes schedule → reschedule → verification in sequence:

```bash
cd backend/glintt-tests
python run_tests.py
```

**What it does:**

1. Authenticates with Glintt
2. Searches for available slots
3. Schedules a new appointment (auto-selects first available slot)
4. Extracts the created appointment ID
5. Searches for reschedule slots
6. Reschedules the appointment (auto-selects a different slot)
7. Verifies via `GET /Appointment` that:
   - Appointment exists at the NEW time
   - Appointment status is correct

**Output:**

```
✅ PASS: Schedule created appointment ID 12345 at 2025-10-15T09:00:00
✅ PASS: Reschedule moved appointment to 2025-10-16T10:30:00
✅ PASS: Verification confirmed appointment at new time
```

Or on failure:

```
❌ FAIL: Reschedule failed - Glintt error: "Slot already occupied"
```

### Option 2: Interactive Scripts

For manual testing with slot selection:

**Schedule a new appointment:**

```bash
python glintt_schedule.py
```

**Reschedule an existing appointment:**

```bash
# First, set the appointment ID to reschedule
export GLINTT_TEST_EPISODE_ID=12345

python glintt_reschedule.py
```

---

## Script Details

### `glintt_schedule.py`

Creates a new appointment:

1. Authenticates
2. Searches slots via `ExternalSearchSlots` with `RescheduleFlag: false`
3. Lets user select a slot (or auto-selects in non-interactive mode)
4. Calls `ExternalScheduleAppointment`
5. Returns appointment ID and details

### `glintt_reschedule.py`

Reschedules an existing appointment:

1. Authenticates
2. Searches slots via `ExternalSearchSlots` with `RescheduleFlag: true` and `episode.EpisodeID`
3. Lets user select a new slot
4. Calls `ExternalScheduleAppointment` with `RescheduleFlag: true`
5. Returns rescheduled appointment details

### `run_tests.py`

Automated test runner that chains schedule → reschedule → verification.

---

## Known Limitations

### Duplicate Appointment Errors

Creating similar appointments (same patient, same time range, same service) may fail with a "duplicate" error from Glintt. This is expected behavior.

**Workaround:**

- Use different date ranges for each test
- Clean up test appointments in Glintt admin UI
- Use different test patients

### Slot Availability

If no slots are available in the date range, tests will fail. Ensure:

- The doctor has working hours in the date range
- The service is active
- Slots haven't been blocked

---

## Verification Endpoint

The test runner verifies results using:

```
GET /Hms.OutPatient.Api/hms/outpatient/Appointment
```

Query parameters:

- `beginDate`: Start of date range (ISO datetime)
- `endDate`: End of date range (ISO datetime)
- `doctorCode`: The doctor code
- `status`: `SCHEDULED`

---

## How This Maps to Production Implementation

Once this test harness validates the Glintt API contract, the same payload structure will be replicated in the production codebase:

| Test Harness | Production Implementation |
| --- | --- |
| `glintt_schedule.py` | (not needed - we don't create new appointments) |
| `glintt_reschedule.py` | `/api/glintt/reschedule` route |
| Payload structure | Identical - `ExternalScheduleAppointment` with `RescheduleFlag: true` |
| Authentication | Same OAuth flow via `getAuthToken()` in `glintt-api.ts` |
| Episode data | Sourced from `parentVisit.id` / `parentVisit.type` |
| BookingID | Sourced from slot search response |

**Production enablement checklist:**

1. ✅ Test harness validates payloads work in TEST env
2. ⬜ Confirm with Glintt leads when PROD reschedule is enabled
3. ⬜ Switch `GLINTT_BASE_URL` to production
4. ⬜ Enable feature flag `GLINTT_RESCHEDULE_ENABLED=true`
5. ⬜ Monitor first production reschedules

---

## Troubleshooting

### Authentication Fails

- Verify credentials in `.env`
- Check if TEST environment is accessible
- Ensure network/VPN connectivity

### No Slots Found

- Expand date range
- Check if doctor has availability
- Verify service code is active

### Reschedule Fails

- Ensure `GLINTT_TEST_EPISODE_ID` is set correctly
- Check if original appointment still exists
- Verify episode type matches (usually "Consultas")

### "Duplicate" Error

- The same appointment may already exist
- Use a different date range or patient

---

## File Structure

```
backend/glintt-tests/
├── README.md              # This file
├── requirements.txt       # Python dependencies
├── env.example.txt        # Example environment variables (copy to .env)
├── glintt_schedule.py     # Interactive schedule script
├── glintt_reschedule.py   # Interactive reschedule script
├── glintt_client.py       # Shared Glintt API client
└── run_tests.py           # Automated test runner
```

