import requests
import json
from datetime import datetime, timedelta
import sys
import os

# Add the parent directory to the path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
PATIENT_ID = "43148" #ana fernandes

class GlinttPatientSearchTester:
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
    
    def search_patient_by_id(self, patient_id):
        """Search for a patient by ID"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        print(f"🔍 Searching for patient with ID: {patient_id}")
        
        # Add authorization header
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        # Build the URL
        url = f"{self.base_url}/Hms.PatientAdministration.Api/hms/patientadministration/Patient/search"
        
        # Query parameters
        params = {
            'patientId': patient_id,
            'skip': 0,
            'take': 10
        }
        
        try:
            response = self.session.get(url, headers=headers, params=params)
            
            print(f"📡 Request URL: {response.url}")
            print(f"📊 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Patient search completed successfully!")
                patient_count = len(data) if isinstance(data, list) else 'N/A'
                print(f"📈 Number of patients found: {patient_count}")
                
                # Print patient details if found
                if isinstance(data, list) and len(data) > 0:
                    print("\n📋 Patient Details:")
                    for i, patient in enumerate(data, 1):
                        print(f"\n--- Patient {i} ---")
                        print(f"ID: {patient.get('id', 'N/A')}")
                        print(f"Name: {patient.get('name', 'N/A')}")
                        print(f"Type: {patient.get('type', 'N/A')}")
                        print(f"Gender: {patient.get('administrativeGender', 'N/A')}")
                        print(f"Birth Date: {patient.get('birthDate', 'N/A')}")
                        print(f"Fiscal Number: {patient.get('fiscalNumber', 'N/A')}")
                        print(f"Citizen Card: {patient.get('citizenCard', 'N/A')}")
                        print(f"National Health Card: {patient.get('nationalHealthCard', 'N/A')}")
                        print(f"Deceased: {patient.get('deceased', 'N/A')}")
                        
                        # Address information
                        if 'address' in patient:
                            addr = patient['address']
                            print(f"Address: {addr.get('streetName', 'N/A')}")
                            print(f"City: {addr.get('city', 'N/A')}")
                            print(f"Zip Code: {addr.get('zipCode', 'N/A')}")
                            print(f"Country: {addr.get('country', 'N/A')}")
                        
                        # Contact information
                        if 'contacts' in patient:
                            contact = patient['contacts']
                            print(f"Phone 1: {contact.get('phoneNumber1', 'N/A')}")
                            print(f"Phone 2: {contact.get('phoneNumber2', 'N/A')}")
                            print(f"Email: {contact.get('email', 'N/A')}")
                
                return data
            else:
                print(f"❌ Failed to search for patient. Status: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error searching for patient: {str(e)}")
            return None
    


def main():
    """Main function to run the tests"""
    print("🏥 Glintt Patient Search API Tester")
    print("=" * 60)
    
    tester = GlinttPatientSearchTester()
    
    # Step 1: Get authentication token
    if not tester.get_auth_token():
        print("❌ Authentication failed. Exiting...")
        return
    
    print("\n" + "=" * 60)
    
    # Step 2: Test patient search by ID
    print("\n🔍 Testing patient search by ID...")
    result = tester.search_patient_by_id(PATIENT_ID)
    if result:
        print(f"✅ Patient search by ID completed")
        
        # Print the patient object as JSON
        if result and len(result) > 0:
            print("\n🔍 Patient object:")
            print(json.dumps(result[0], indent=2, ensure_ascii=False))
    else:
        print("❌ Patient search by ID failed")
    
    print("\n" + "=" * 60)
    print("🎉 Test completed!")

if __name__ == "__main__":
    main() 