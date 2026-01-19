#!/usr/bin/env python3
"""
Glintt Reschedule Test - Reschedules an existing appointment.

This script is for developer testing only. It reschedules a real appointment
in the Glintt TEST environment.

Usage:
    python glintt_reschedule.py --episode-id <ID> [--auto]
    python glintt_reschedule.py --from-file <schedule_result.json> [--auto]
    
Options:
    --episode-id <ID>   Episode ID (from parentVisit.id) to reschedule
    --from-file <file>  Read episode ID from schedule result JSON file
    --auto              Auto-select first available slot (non-interactive mode)

Environment variables required (see env.example.txt):
    GLINTT_BASE_URL, GLINTT_CLIENT_ID, GLINTT_CLIENT_SECRET, etc.
    
Alternative:
    GLINTT_TEST_EPISODE_ID can be set in environment
"""

import sys
import os
import json
import argparse
from datetime import datetime
from glintt_client import GlinttTestClient


def display_slots(slots, exclude_time=None):
    """Display available slots for user selection."""
    print("\n" + "=" * 70)
    print("AVAILABLE SLOTS FOR RESCHEDULE")
    print("=" * 70)
    
    for i, slot in enumerate(slots, 1):
        slot_time = slot['SlotDateTime']
        doctor = slot.get('HumanResourceCode', 'N/A')
        duration = slot.get('Duration', 'N/A')
        
        # Mark if this is the current slot
        marker = " (current)" if exclude_time and slot_time == exclude_time else ""
        
        print(f"  {i:2d}. {slot_time} | Doctor: {doctor} | Duration: {duration}{marker}")
    
    print("=" * 70)


def select_slot_interactive(slots, exclude_time=None):
    """Interactive slot selection."""
    display_slots(slots, exclude_time)
    
    while True:
        try:
            choice = input(f"\nSelect slot (1-{len(slots)}) or 'q' to quit: ").strip()
            
            if choice.lower() == 'q':
                return None
            
            index = int(choice) - 1
            if 0 <= index < len(slots):
                selected = slots[index]
                
                # Warn if selecting current slot
                if exclude_time and selected['SlotDateTime'] == exclude_time:
                    confirm = input("This is the current slot. Continue? (y/n): ").strip()
                    if confirm.lower() != 'y':
                        continue
                
                return selected
            else:
                print(f"Invalid choice. Enter 1-{len(slots)}")
                
        except ValueError:
            print("Invalid input. Enter a number or 'q'")
        except KeyboardInterrupt:
            print("\nCancelled")
            return None


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Glintt Reschedule Test')
    parser.add_argument('--episode-id', help='Episode ID to reschedule')
    parser.add_argument('--from-file', help='Read episode ID from JSON file')
    parser.add_argument('--auto', action='store_true', help='Auto-select slot')
    
    return parser.parse_args()


def main():
    """Main reschedule workflow."""
    args = parse_args()
    
    print("=" * 70)
    print("GLINTT RESCHEDULE TEST")
    print("=" * 70)
    
    # Determine episode ID
    episode_id = None
    original_time = None
    
    if args.from_file:
        try:
            with open(args.from_file) as f:
                data = json.load(f)
            episode_id = data.get('appointmentId')
            original_time = data.get('scheduledTime')
            print(f"Loaded from file: {args.from_file}")
        except Exception as e:
            print(f"FAIL: Could not read file - {e}")
            return None
    elif args.episode_id:
        episode_id = args.episode_id
    else:
        episode_id = os.getenv('GLINTT_TEST_EPISODE_ID')
    
    if not episode_id:
        print("FAIL: No episode ID provided")
        print("Use --episode-id <ID> or --from-file <file> or set GLINTT_TEST_EPISODE_ID")
        return None
    
    # Initialize client
    try:
        client = GlinttTestClient()
    except EnvironmentError as e:
        print(f"FAIL: {e}")
        return None
    
    print(f"Episode ID: {episode_id}")
    print(f"Patient ID: {client.patient_id}")
    print(f"Service: {client.service_code}")
    
    start_date, end_date = client.get_date_range()
    print(f"Date Range: {start_date} to {end_date}")
    print("=" * 70)
    
    # Step 1: Authenticate
    print("\n[Step 1] Authentication")
    if not client.authenticate():
        print("FAIL: Authentication failed")
        return None
    
    # Step 2: Search slots for reschedule
    print("\n[Step 2] Search available slots (reschedule)")
    slots = client.search_slots(
        start_date, 
        end_date, 
        is_reschedule=True,
        episode_id=episode_id,
        episode_type="Consultas"
    )
    
    if not slots:
        print("FAIL: No available slots found")
        return None
    
    # Step 3: Select slot
    print("\n[Step 3] Slot selection")
    if args.auto:
        # In auto mode, select first slot that's different from original
        selected_slot = None
        for slot in slots:
            if original_time and slot['SlotDateTime'] == original_time:
                continue
            selected_slot = slot
            break
        
        if not selected_slot:
            selected_slot = slots[0]
        
        print(f"  Auto-selected: {selected_slot['SlotDateTime']}")
    else:
        selected_slot = select_slot_interactive(slots, original_time)
        if not selected_slot:
            print("FAIL: No slot selected")
            return None
    
    # Step 4: Reschedule appointment
    print("\n[Step 4] Reschedule appointment")
    result = client.schedule_appointment(
        selected_slot,
        is_reschedule=True,
        episode_id=episode_id,
        episode_type="Consultas"
    )
    
    if not result:
        print("FAIL: Reschedule failed")
        return None
    
    # Extract appointment info
    new_appointment_id = result.get('appointmentID')
    
    print("\n" + "=" * 70)
    print("RESCHEDULE RESULT")
    print("=" * 70)
    print(f"Original Episode ID: {episode_id}")
    if original_time:
        print(f"Original Time: {original_time}")
    print(f"New Appointment ID: {new_appointment_id}")
    print(f"New Time: {selected_slot['SlotDateTime']}")
    print(f"Doctor: {selected_slot['HumanResourceCode']}")
    print("=" * 70)
    
    # Save result
    output = {
        'originalEpisodeId': episode_id,
        'originalTime': original_time,
        'newAppointmentId': new_appointment_id,
        'newTime': selected_slot['SlotDateTime'],
        'doctorCode': selected_slot['HumanResourceCode'],
        'bookingId': selected_slot['BookingID'],
        'patientId': client.patient_id,
        'result': result,
    }
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"reschedule_result_{timestamp}.json"
    
    with open(filename, 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\nResult saved to: {filename}")
    
    return output


if __name__ == "__main__":
    result = main()
    sys.exit(0 if result else 1)








