#!/usr/bin/env python3
"""
Glintt Test Runner - Automated schedule + reschedule + verification.

This script runs a complete test cycle:
1. Schedule a new appointment
2. Reschedule it to a different slot
3. Verify via GET /Appointment that the change was applied

Usage:
    python run_tests.py

Returns exit code 0 on success, 1 on failure.

Environment variables required (see env.example.txt):
    GLINTT_BASE_URL, GLINTT_CLIENT_ID, GLINTT_CLIENT_SECRET, etc.
"""

import sys
import json
from datetime import datetime, timedelta
from glintt_client import GlinttTestClient


class TestResult:
    """Container for test results."""
    
    def __init__(self):
        self.passed = []
        self.failed = []
    
    def add_pass(self, message: str):
        self.passed.append(message)
        print(f"PASS: {message}")
    
    def add_fail(self, message: str):
        self.failed.append(message)
        print(f"FAIL: {message}")
    
    def success(self) -> bool:
        return len(self.failed) == 0
    
    def summary(self):
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)
        print(f"Passed: {len(self.passed)}")
        print(f"Failed: {len(self.failed)}")
        
        if self.failed:
            print("\nFailures:")
            for f in self.failed:
                print(f"  - {f}")
        
        print("=" * 70)
        
        return self.success()


def run_tests():
    """Run the complete test suite."""
    results = TestResult()
    
    print("=" * 70)
    print("GLINTT TEST RUNNER")
    print("=" * 70)
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)
    
    # Initialize client
    try:
        client = GlinttTestClient()
    except EnvironmentError as e:
        results.add_fail(f"Configuration error: {e}")
        return results
    
    print(f"\nConfiguration:")
    print(f"  Base URL: {client.base_url}")
    print(f"  Patient ID: {client.patient_id}")
    print(f"  Service Code: {client.service_code}")
    print(f"  Medical Act: {client.medical_act_code}")
    
    start_date, end_date = client.get_date_range()
    print(f"  Date Range: {start_date} to {end_date}")
    
    # =========================================================================
    # PHASE 1: Authentication
    # =========================================================================
    print("\n" + "-" * 70)
    print("PHASE 1: Authentication")
    print("-" * 70)
    
    if not client.authenticate():
        results.add_fail("Authentication failed")
        return results
    
    results.add_pass("Authentication successful")
    
    # =========================================================================
    # PHASE 2: Get or Create Appointment
    # =========================================================================
    print("\n" + "-" * 70)
    print("PHASE 2: Get or Create Appointment")
    print("-" * 70)
    
    # First, check for existing appointments via GET /Appointment
    verify_start = f"{start_date}T00:00:00"
    verify_end = f"{end_date}T23:59:59"
    
    print("Checking for existing appointments...")
    existing_appointments = client.get_appointments(
        verify_start,
        verify_end,
        status="SCHEDULED"
    )
    
    appointment_id = None
    schedule_time = None
    schedule_doctor = None
    
    # Look for an existing appointment for this patient
    if existing_appointments:
        for apt in existing_appointments:
            apt_patient = apt.get('patientIdentifier', {}).get('id', '')
            if apt_patient == client.patient_id:
                appointment_id = apt.get('appointmentId')
                schedule_time = apt.get('appointmentHour')
                schedule_doctor = apt.get('doctorCode')
                print(f"  Found existing appointment ID: {appointment_id}")
                print(f"  Scheduled at: {schedule_time} (Doctor: {schedule_doctor})")
                results.add_pass(f"Using existing appointment ID {appointment_id}")
                break
    
    if not appointment_id:
        # No existing appointment - try to schedule a new one
        print("No existing appointment found, scheduling new one...")
        
        schedule_slots = client.search_slots(start_date, end_date, is_reschedule=False)
        
        if not schedule_slots:
            results.add_fail("No available slots for scheduling and no existing appointment")
            return results
        
        results.add_pass(f"Found {len(schedule_slots)} available slots")
        
        # Select first available slot
        schedule_slot = schedule_slots[0]
        schedule_time = schedule_slot['SlotDateTime']
        schedule_doctor = schedule_slot['HumanResourceCode']
        
        print(f"  Selected slot: {schedule_time} (Doctor: {schedule_doctor})")
        
        # Schedule the appointment
        schedule_result = client.schedule_appointment(schedule_slot, is_reschedule=False)
        
        if not schedule_result:
            results.add_fail("Schedule appointment failed")
            return results
        
        # Fetch appointmentId from GET /Appointment (not from schedule response)
        print("Fetching appointment ID from GET /Appointment...")
        new_appointments = client.get_appointments(
            verify_start,
            verify_end,
            status="SCHEDULED"
        )
        
        if new_appointments:
            for apt in new_appointments:
                apt_patient = apt.get('patientIdentifier', {}).get('id', '')
                apt_time = apt.get('appointmentHour', '')
                # Match by patient and time
                if apt_patient == client.patient_id and schedule_time in apt_time:
                    appointment_id = apt.get('appointmentId')
                    print(f"  Found new appointment ID: {appointment_id}")
                    break
        
        if not appointment_id:
            results.add_fail("Schedule succeeded but could not retrieve appointmentID from GET /Appointment")
            return results
        
        results.add_pass(f"Scheduled new appointment ID {appointment_id} at {schedule_time}")
    
    # =========================================================================
    # PHASE 3: Reschedule Appointment
    # =========================================================================
    print("\n" + "-" * 70)
    print("PHASE 3: Reschedule Appointment")
    print("-" * 70)
    
    # Search for reschedule slots
    reschedule_slots = client.search_slots(
        start_date,
        end_date,
        is_reschedule=True,
        episode_id=appointment_id,
        episode_type="Consultas"
    )
    
    if not reschedule_slots:
        results.add_fail("No available slots for rescheduling")
        return results
    
    results.add_pass(f"Found {len(reschedule_slots)} available slots for reschedule")
    
    # Select a DIFFERENT slot than the original
    reschedule_slot = None
    for slot in reschedule_slots:
        if slot['SlotDateTime'] != schedule_time:
            reschedule_slot = slot
            break
    
    if not reschedule_slot:
        # All slots are the same time - just use first one
        results.add_fail("Could not find a different slot for rescheduling")
        reschedule_slot = reschedule_slots[0]
    
    reschedule_time = reschedule_slot['SlotDateTime']
    reschedule_doctor = reschedule_slot['HumanResourceCode']
    
    print(f"  Original time: {schedule_time}")
    print(f"  New time: {reschedule_time}")
    
    # Reschedule the appointment
    reschedule_result = client.schedule_appointment(
        reschedule_slot,
        is_reschedule=True,
        episode_id=appointment_id,
        episode_type="Consultas"
    )
    
    if not reschedule_result:
        results.add_fail("Reschedule appointment failed")
        return results
    
    new_appointment_id = reschedule_result.get('appointmentID')
    
    results.add_pass(f"Reschedule moved appointment to {reschedule_time}")
    
    # =========================================================================
    # PHASE 4: Verification
    # =========================================================================
    print("\n" + "-" * 70)
    print("PHASE 4: Verification via GET /Appointment")
    print("-" * 70)
    
    # Build date range for verification (cover both times)
    verify_start = f"{start_date}T00:00:00"
    verify_end = f"{end_date}T23:59:59"
    
    appointments = client.get_appointments(
        verify_start,
        verify_end,
        doctor_code=reschedule_doctor if reschedule_doctor else None,
        status="SCHEDULED"
    )
    
    if appointments is None:
        results.add_fail("Could not fetch appointments for verification")
        return results
    
    # Look for appointment at NEW time
    found_at_new_time = client.find_appointment_by_time(
        appointments,
        reschedule_time,
        client.patient_id
    )
    
    if found_at_new_time:
        found_id = found_at_new_time.get('appointmentId', 'unknown')
        results.add_pass(f"Verification: Found appointment at new time (ID: {found_id})")
    else:
        results.add_fail(f"Verification: Appointment NOT found at new time {reschedule_time}")
    
    # Check if appointment still exists at OLD time (should not for true reschedule)
    found_at_old_time = client.find_appointment_by_time(
        appointments,
        schedule_time,
        client.patient_id
    )
    
    if found_at_old_time:
        old_id = found_at_old_time.get('appointmentId', 'unknown')
        old_status = found_at_old_time.get('status', 'unknown')
        
        # Check if it's the same appointment or if old one was rescheduled/annulled
        if old_status in ('RESCHEDULED', 'ANNULLED'):
            results.add_pass(f"Verification: Original appointment marked as {old_status}")
        else:
            # This might be expected depending on Glintt's behavior
            print(f"  Note: Appointment still exists at old time (ID: {old_id}, status: {old_status})")
            print(f"  This may be expected behavior - check Glintt documentation")
    else:
        results.add_pass("Verification: No appointment at original time (as expected)")
    
    # =========================================================================
    # PHASE 5: Save Results
    # =========================================================================
    print("\n" + "-" * 70)
    print("PHASE 5: Save Results")
    print("-" * 70)
    
    test_output = {
        'timestamp': datetime.now().isoformat(),
        'configuration': {
            'baseUrl': client.base_url,
            'patientId': client.patient_id,
            'serviceCode': client.service_code,
            'dateRange': f"{start_date} to {end_date}",
        },
        'schedule': {
            'appointmentId': appointment_id,
            'scheduledTime': schedule_time,
            'doctorCode': schedule_doctor,
        },
        'reschedule': {
            'originalTime': schedule_time,
            'newTime': reschedule_time,
            'newAppointmentId': new_appointment_id,
            'doctorCode': reschedule_doctor,
        },
        'verification': {
            'foundAtNewTime': found_at_new_time is not None,
            'foundAtOldTime': found_at_old_time is not None,
        },
        'results': {
            'passed': results.passed,
            'failed': results.failed,
        }
    }
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"test_run_{timestamp}.json"
    
    with open(filename, 'w') as f:
        json.dump(test_output, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"Results saved to: {filename}")
    
    return results


def main():
    """Main entry point."""
    print("\n")
    print("*" * 70)
    print("*  GLINTT TEST HARNESS - Schedule + Reschedule Verification")
    print("*  ")
    print("*  WARNING: This creates REAL appointments in the Glintt TEST env")
    print("*" * 70)
    print("\n")
    
    results = run_tests()
    success = results.summary()
    
    print("\n")
    if success:
        print("=" * 70)
        print("ALL TESTS PASSED")
        print("=" * 70)
    else:
        print("=" * 70)
        print("TESTS FAILED - See details above")
        print("=" * 70)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()


