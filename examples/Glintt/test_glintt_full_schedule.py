import requests
import json
from datetime import datetime, timedelta
import sys
import os

# Add the parent directory to the path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# =============================================================================
# CONFIGURATION - Edit these values as needed
# =============================================================================
PATIENT_ID = "150847"                    # Patient ID to schedule appointment for
SERVICE_CODE = "36"                      # Service code (Lisboa - Dep. Higiene Oral 2021)
MEDICAL_ACT_CODE = "1"                   # Medical act code (HIGIENE ORAL - MARCAÇÃO)
DOCTOR_ID = "22"                         # Doctor ID (optional - can be selected from available slots)
START_DATE = "2025-10-15"                # Start date for slot search (YYYY-MM-DD)
END_DATE = "2025-10-18"                  # End date for slot search (YYYY-MM-DD)

# Financial entity configuration
FINANCIAL_ENTITY = {
    "EntityCode": "998",
    "EntityCard": "",
    "Exemption": "S"
}

# =============================================================================
# GLINTT FULL SCHEDULE WORKFLOW
# =============================================================================

class GlinttFullScheduler:
    def __init__(self, base_url="https://your-glintt-api.example.com"):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
        
        # Headers for requests
        self.session.headers.update({
            'Accept': '/',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'cache-control': 'no-cache,no-cache'
        })
    
    def get_auth_token(self):
        """Get authentication token from Glintt API"""
        print("🔐 Getting authentication token...")
        
        auth_url = f"{self.base_url}/Glintt.GPlatform.APIGateway.CoreWebAPI/token"
        
        auth_data = {
            'client_id': 'your-glintt-client-id',
            'client_secret': 'your-glintt-client-secret',
            'grant_type': 'password',
            'TenantID': 'your-tenant-id',
            'FacilityID': 'your-facility-id',
            'USERNAME': 'your-username'
        }
        
        try:
            response = self.session.post(
                auth_url,
                data=auth_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.token = token_data.get('access_token')
                print(f"✅ Token obtained successfully: {self.token[:20]}...")
                return True
            else:
                print(f"❌ Failed to get token. Status: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error getting token: {str(e)}")
            return False
    
    def search_available_slots(self, doctor_id=None):
        """Search for available slots using ExternalSearchSlots endpoint"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        print(f"🔍 Searching for available slots from {START_DATE} to {END_DATE}")
        print(f"👤 Patient ID: {PATIENT_ID}")
        print(f"🏥 Service: {SERVICE_CODE}")
        print(f"🦷 Medical Act: {MEDICAL_ACT_CODE}")
        if doctor_id:
            print(f"👨‍⚕️ Doctor ID: {doctor_id}")
        
        # Parse dates
        start_date = datetime.strptime(START_DATE, "%Y-%m-%d")
        end_date = datetime.strptime(END_DATE, "%Y-%m-%d")
        
        # Headers
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        # Build the slot search request
        slot_request = {
            "StartDate": start_date.date().isoformat(),
            "EndDate": end_date.date().isoformat(),
            "MedicalActCode": MEDICAL_ACT_CODE,
            "ServiceCode": SERVICE_CODE,
            "RescheduleFlag": False,  # This is a new appointment, not reschedule
            "origin": "MALO_ADMIN"
        }
        
        # Only add HumanResourceCode if doctor_id is specified
        if doctor_id:
            slot_request["HumanResourceCode"] = doctor_id
        
        # Request body for slot search - for new appointments (not reschedule)
        request_body = {
            "LoadAppointments": False,  # Only show available slots
            "FullSearch": True,
            "NumberOfRegisters": 20,    # Get more slots
            "Patient": {
                "PatientType": "MC",
                "PatientID": PATIENT_ID
            },
            "Period": [],  # Empty list as per example
            "DaysOfWeek": [],  # Empty list as per example
            "ExternalMedicalActSlotsList": [slot_request]
        }
        
        # Endpoint
        endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots"
        
        print(f"🔍 Using endpoint: {endpoint}")
        print(f"📤 Request Body: {json.dumps(request_body, indent=2, default=str)}")
        if doctor_id:
            print(f"🔍 Searching for doctor: {doctor_id}")
        else:
            print(f"🔍 Searching for any doctor (no filter)")
        
        try:
            response = self.session.post(endpoint, headers=headers, json=request_body)
            
            print(f"📊 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Slot search completed successfully!")
                
                # Check for errors in response
                if 'ErrorDetails' in data and data['ErrorDetails']:
                    error_details = data['ErrorDetails']
                    if error_details.get('Error'):
                        print(f"❌ Error in response: {error_details}")
                        return None
                    else:
                        print(f"ℹ️ ErrorDetails present but no actual error: {error_details}")
                
                # Also check if ExternalSearchSlot is empty and show more details
                if 'ExternalSearchSlot' in data and not data['ExternalSearchSlot']:
                    print(f"⚠️ ExternalSearchSlot is empty. Full response: {json.dumps(data, indent=2)}")
                    return None
                
                # Extract slots
                slots = data.get('ExternalSearchSlot', [])
                print(f"📋 Number of available slots found: {len(slots)}")
                
                if not slots:
                    if doctor_id:
                        print(f"❌ No available slots found for doctor {doctor_id} in the specified date range")
                    else:
                        print("❌ No available slots found in the specified date range")
                    return None
                
                return slots
            else:
                print(f"❌ Failed with status: {response.status_code}")
                print(f"Response: {response.text[:300]}...")
                return None
                
        except Exception as e:
            print(f"❌ Error with endpoint {endpoint}: {str(e)}")
            return None
    
    def display_available_slots(self, slots):
        """Display available slots in a user-friendly format"""
        print("\n" + "="*80)
        print("📅 AVAILABLE SLOTS")
        print("="*80)
        
        # Group slots by doctor for better display
        doctor_slots = {}
        for slot in slots:
            doctor_id = slot.get('HumanResourceCode', 'N/A')
            if doctor_id not in doctor_slots:
                doctor_slots[doctor_id] = []
            doctor_slots[doctor_id].append(slot)
        
        slot_index = 1
        for doctor_id, doctor_slot_list in doctor_slots.items():
            print(f"\n👨‍⚕️ Doctor {doctor_id}:")
            for slot in doctor_slot_list:
                slot_time = datetime.fromisoformat(slot['SlotDateTime'].replace('Z', '+00:00'))
                booking_id = slot.get('BookingID', 'N/A')
                duration = slot.get('Duration', 'N/A')
                occupation = slot.get('Occupation', False)
                occupation_reason = slot.get('OccupationReason', {}).get('Description', 'N/A')
                
                status_icon = "✅" if not occupation else "❌"
                status_text = "Available" if not occupation else f"Occupied ({occupation_reason})"
                
                print(f"  {slot_index:2d}. {status_icon} {slot_time.strftime('%Y-%m-%d %H:%M')} | "
                      f"Booking: {booking_id} | {status_text}")
                slot_index += 1
        
        print("="*80)
        return len(slots)
    
    def select_slot(self, slots):
        """Allow user to select a slot"""
        if not slots:
            print("❌ No slots available for selection")
            return None
        
        self.display_available_slots(slots)
        
        while True:
            try:
                choice = input(f"\n🎯 Select a slot (1-{len(slots)}) or 'q' to quit: ").strip()
                
                if choice.lower() == 'q':
                    print("👋 Cancelled by user")
                    return None
                
                slot_index = int(choice) - 1
                
                if 0 <= slot_index < len(slots):
                    selected_slot = slots[slot_index]
                    
                    # Check if slot is available
                    if selected_slot.get('Occupation', False):
                        print(f"❌ Selected slot is occupied: {selected_slot.get('OccupationReason', {}).get('Description', 'Unknown reason')}")
                        continue
                    
                    print(f"✅ Selected slot: {selected_slot['SlotDateTime']}")
                    return selected_slot
                else:
                    print(f"❌ Invalid choice. Please enter a number between 1 and {len(slots)}")
                    
            except ValueError:
                print("❌ Invalid input. Please enter a number or 'q' to quit")
            except KeyboardInterrupt:
                print("\n👋 Cancelled by user")
                return None
    
    def schedule_appointment(self, selected_slot):
        """Schedule appointment using ExternalScheduleAppointment endpoint"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        if not selected_slot:
            print("❌ No slot selected for scheduling")
            return None
        
        print(f"\n📅 Scheduling appointment for: {selected_slot['SlotDateTime']}")
        
        # Extract data from selected slot
        slot_datetime = selected_slot['SlotDateTime']
        doctor_id = selected_slot['HumanResourceCode']
        booking_id = selected_slot['BookingID']
        duration = selected_slot['Duration']
        
        # Headers
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        # Build appointment data using selected slot information
        appointment_data = {
            "ServiceCode": SERVICE_CODE,
            "MedicalActCode": MEDICAL_ACT_CODE,
            "HumanResourceCode": doctor_id,  # From selected slot
            "FinancialEntity": FINANCIAL_ENTITY,
            "ScheduleDate": slot_datetime,    # From selected slot
            "Duration": duration,             # From selected slot
            "FirstTime": False,                # This is a new appointment
            "Origin": "MALO_ADMIN",
            "BookingID": booking_id,          # From selected slot
            "Patient": {
                "PatientType": "MC",
                "PatientID": PATIENT_ID
            },
            "episode": {
                "EpisodeType": "Ficha-ID",
                "EpisodeID": PATIENT_ID
            },
            "Module": "ATDWEB_VALIDATEAPPOINTMENT"
        }
        
        # Wrap in array as per API specification
        request_body = [appointment_data]
        
        # Endpoint
        endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalScheduleAppointment"
        
        print(f"🔍 Using endpoint: {endpoint}")
        print(f"📤 Request Body: {json.dumps(request_body, indent=2, default=str)}")
        
        try:
            response = self.session.post(endpoint, headers=headers, json=request_body)
            
            print(f"📊 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Appointment scheduling completed successfully!")
                print(f"📈 Response data type: {type(data)}")
                
                if isinstance(data, dict):
                    print(f"📋 Response keys: {list(data.keys())}")
                    
                    # Check for appointment ID
                    if 'appointmentID' in data:
                        print(f"🎯 New Appointment ID: {data['appointmentID']}")
                    
                    # Check for any errors
                    if 'errorDetails' in data and data['errorDetails']:
                        print(f"⚠️ Error details: {data['errorDetails']}")
                
                return data
            elif response.status_code == 400:
                print(f"❌ Bad request - check request body")
                print(f"Response: {response.text[:300]}...")
            elif response.status_code == 404:
                print(f"❌ Endpoint not found: {endpoint}")
            else:
                print(f"❌ Failed with status: {response.status_code}")
                print(f"Response: {response.text[:300]}...")
                
        except Exception as e:
            print(f"❌ Error with endpoint {endpoint}: {str(e)}")
        
        print("\n❌ Appointment scheduling failed.")
        return None

def main():
    """Main function to run the full schedule workflow"""
    print("🏥 Glintt Full Schedule Workflow")
    print("="*60)
    print(f"👤 Patient ID: {PATIENT_ID}")
    print(f"🏥 Service: {SERVICE_CODE}")
    print(f"🦷 Medical Act: {MEDICAL_ACT_CODE}")
    print(f"📅 Search Date Range: {START_DATE} to {END_DATE}")
    print("="*60)
    
    scheduler = GlinttFullScheduler()
    
    # Step 1: Get authentication token
    print("\n🔐 Step 1: Authentication")
    if not scheduler.get_auth_token():
        print("❌ Authentication failed. Exiting...")
        return
    
    # Step 2: Search for available slots
    print("\n🔍 Step 2: Searching for available slots...")
    doctor_id = globals().get('DOCTOR_ID', None)  # Get DOCTOR_ID if defined, otherwise None
    slots = scheduler.search_available_slots(doctor_id=doctor_id)
    
    if not slots:
        print("❌ No available slots found. Exiting...")
        return
    
    # Step 3: Let user select a slot
    print("\n🎯 Step 3: Slot selection")
    selected_slot = scheduler.select_slot(slots)
    
    if not selected_slot:
        print("❌ No slot selected. Exiting...")
        return
    
    # Step 4: Schedule the appointment
    print("\n📅 Step 4: Scheduling appointment")
    result = scheduler.schedule_appointment(selected_slot)
    
    if result:
        print(f"✅ Schedule completed successfully!")
        
        # Print the result as JSON
        print("\n🔍 Schedule result:")
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        
        # Save results to JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"schedule_completed_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False, default=str)
            print(f"\n💾 Results saved to: {filename}")
        except Exception as e:
            print(f"\n❌ Error saving to file: {str(e)}")
    else:
        print("❌ Schedule failed")
    
    print("\n" + "="*60)
    print("🎉 Full schedule workflow completed!")

if __name__ == "__main__":
    main()
