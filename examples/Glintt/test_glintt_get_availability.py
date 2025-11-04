import requests
import json
from datetime import datetime, timedelta
import sys
import os

# Add the parent directory to the path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration - Edit these values as needed
PATIENT_ID = "191945"  # Set your specific patient ID here
DOCTOR_ID = "1242"       # Set your specific doctor ID here
SERVICE_CODE = "835"     
MEDICAL_ACT_CODE = "1"

# Date configuration - Set your target dates here
START_DATE = "2025-09-03"  # Set your start date (YYYY-MM-DD format)
END_DATE = "2025-09-03"    # Set your end date (YYYY-MM-DD format)

class GlinttSlotSearchTester:
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
    
    def search_available_slots(self):
        """Search for available slots for specified dates"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        # Parse the configured start and end dates
        start_date = datetime.strptime(START_DATE, "%Y-%m-%d")
        end_date = datetime.strptime(END_DATE, "%Y-%m-%d")
        
        print(f"🔍 Searching for available slots from {START_DATE} to {END_DATE}")
        print(f"👤 Patient ID: {PATIENT_ID}")
        print(f"👨‍⚕️ Doctor ID: {DOCTOR_ID}")
        
        # Add authorization header
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        # Build the request body based on the documentation
        request_body = {
            "LoadAppointments": False,  # Only show available slots
            "FullSearch": True,
            "NumberOfRegisters": 10,    # Get more slots for tomorrow
            "Patient": {
                "PatientType": "MC",
                "PatientID": PATIENT_ID
            },
            "Period": [],  # Empty list as per example
            "DaysOfWeek": [],  # Empty list as per example
            "ExternalMedicalActSlotsList": [
                {
                    "StartDate": start_date.date().isoformat(),
                    "EndDate": end_date.date().isoformat(),
                    "MedicalActCode": MEDICAL_ACT_CODE,  # This should be the medical act code, not doctor ID
                    "ServiceCode": SERVICE_CODE,
                    "RescheduleFlag": False,  # Boolean false, not string
                    "Rubric": "",  # Empty string as per example
                    "FirstTime": "",  # Empty string as per example
                    "HumanResourceCode": "",  # Empty string as per example
                    "FinancialEntityCode": 998,
                    "Origin": "MALO_ADMIN"
                }
            ]
        }
        
        # Use the correct endpoint for slot search
        endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots"
        
        print(f"🔍 Using endpoint: {endpoint}")
        
        try:
            response = self.session.post(endpoint, headers=headers, json=request_body)
            
            print(f"📡 Request URL: {response.url}")
            print(f"📊 Status Code: {response.status_code}")
            print(f"📤 Request Body: {json.dumps(request_body, indent=2, default=str)}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Slot search completed successfully!")
                print(f"📈 Response data type: {type(data)}")
                
                if isinstance(data, list):
                    print(f"📋 Number of slots found: {len(data)}")
                elif isinstance(data, dict):
                    print(f"📋 Response keys: {list(data.keys())}")
                
                return data
            elif response.status_code == 404:
                print(f"❌ Endpoint not found: {endpoint}")
            elif response.status_code == 400:
                print(f"❌ Bad request - check request body")
                print(f"Response: {response.text[:300]}...")
            else:
                print(f"❌ Failed with status: {response.status_code}")
                print(f"Response: {response.text[:300]}...")
                
        except Exception as e:
            print(f"❌ Error with endpoint {endpoint}: {str(e)}")
        
        print("\n❌ Slot search failed.")
        return None
    
    def try_simplified_slot_search(self):
        """Try a simplified request body structure"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        print("\n🔍 Trying simplified request body...")
        
        # Parse the configured start and end dates
        start_date = datetime.strptime(START_DATE, "%Y-%m-%d")
        end_date = datetime.strptime(END_DATE, "%Y-%m-%d")
        
        # Add authorization header
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        # Try different simplified request body structures
        simplified_bodies = [
            # Structure 1: Minimal required fields (matching working example)
            {
                "LoadAppointments": False,
                "FullSearch": True,
                "NumberOfRegisters": 10,
                "Patient": {
                    "PatientType": "MC",
                    "PatientID": PATIENT_ID
                },
                "Period": [],
                "DaysOfWeek": [],
                "ExternalMedicalActSlotsList": [
                    {
                        "StartDate": start_date.date().isoformat(),
                        "EndDate": end_date.date().isoformat(),
                        "MedicalActCode": MEDICAL_ACT_CODE,
                        "ServiceCode": SERVICE_CODE,
                        "RescheduleFlag": False,
                        "Rubric": "",
                        "FirstTime": "",
                        "HumanResourceCode": "",
                        "FinancialEntityCode": 998,
                        "Origin": "MALO_ADMIN"
                    }
                ]
            },
            # Structure 2: Without patient info (to test if patient is required)
            {
                "LoadAppointments": False,
                "FullSearch": True,
                "NumberOfRegisters": 10,
                "Period": [],
                "DaysOfWeek": [],
                "ExternalMedicalActSlotsList": [
                    {
                        "StartDate": start_date.date().isoformat(),
                        "EndDate": end_date.date().isoformat(),
                        "MedicalActCode": MEDICAL_ACT_CODE,
                        "ServiceCode": SERVICE_CODE,
                        "RescheduleFlag": False,
                        "Rubric": "",
                        "FirstTime": "",
                        "HumanResourceCode": "",
                        "FinancialEntityCode": 998,
                        "Origin": "MALO_ADMIN"
                    }
                ]
            }
        ]
        
        endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots"
        
        for i, request_body in enumerate(simplified_bodies, 1):
            print(f"\n🔍 Trying simplified structure {i}:")
            print(f"📤 Request Body: {json.dumps(request_body, indent=2, default=str)}")
            
            try:
                response = self.session.post(endpoint, headers=headers, json=request_body)
                
                print(f"📊 Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print("✅ Simplified structure worked!")
                    print(f"📈 Response data type: {type(data)}")
                    
                    if isinstance(data, list):
                        print(f"📋 Number of slots found: {len(data)}")
                    elif isinstance(data, dict):
                        print(f"📋 Response keys: {list(data.keys())}")
                    
                    return data
                else:
                    print(f"❌ Failed with status: {response.status_code}")
                    print(f"Response: {response.text[:300]}...")
                    
            except Exception as e:
                print(f"❌ Error with structure {i}: {str(e)}")
        
        print("❌ No simplified structure worked.")
        return None


def main():
    """Main function to run the test"""
    print("🏥 Glintt Slot Search API Tester")
    print("=" * 60)
    print(f"👤 Patient ID: {PATIENT_ID}")
    print(f"👨‍⚕️ Doctor ID: {DOCTOR_ID}")
    print(f"🏥 Service: {SERVICE_CODE}")
    print(f"🦷 Medical Act: {MEDICAL_ACT_CODE}")
    print("=" * 60)
    
    tester = GlinttSlotSearchTester()
    
    # Get authentication token
    if not tester.get_auth_token():
        print("❌ Authentication failed. Exiting...")
        return
    
    print("\n" + "=" * 60)
    
    # Test slot search
    print("\n🔍 Testing slot search...")
    result = tester.search_available_slots()
    
    if result:
        print(f"✅ Slot search completed successfully")
        
        # Print the result as JSON
        print("\n🔍 Slot search result:")
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        
        # Save results to JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"slots_2days_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False, default=str)
            print(f"\n💾 Results saved to: {filename}")
        except Exception as e:
            print(f"\n❌ Error saving to file: {str(e)}")
    else:
        print("❌ Slot search failed")
        
        # Try simplified approach if the main one failed
        print("\n" + "=" * 60)
        print("🔄 Trying simplified request structure...")
        simplified_result = tester.try_simplified_slot_search()
        
        if simplified_result:
            print(f"✅ Simplified slot search worked!")
            
            # Print the result as JSON
            print("\n🔍 Simplified slot search result:")
            print(json.dumps(simplified_result, indent=2, ensure_ascii=False, default=str))
            
            # Save results to JSON file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"slots_simplified_{timestamp}.json"
            
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(simplified_result, f, indent=2, ensure_ascii=False, default=str)
                print(f"\n💾 Simplified results saved to: {filename}")
            except Exception as e:
                print(f"\n❌ Error saving simplified results to file: {str(e)}")
        else:
            print("❌ Simplified slot search also failed")
    
    print("\n" + "=" * 60)
    print("🎉 Test completed!")

if __name__ == "__main__":
    main()
