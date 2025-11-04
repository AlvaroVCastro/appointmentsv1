import requests
import json
from datetime import datetime, timedelta
import sys
import os

# Add the parent directory to the path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration - Edit these values as needed
PATIENT_NAME = "João Silva Teste"  # Patient name
PATIENT_GENDER = "M"  # M for Male, F for Female (required field)
PATIENT_BIRTHDATE = "1990-05-15"  # YYYY-MM-DD format (required field)
FINANCIAL_ENTITY_ID = "998"  # Financial entity ID (required field)
PHONE_NUMBER_1 = "+351900000000"  # Primary phone number
EMAIL = "teste@example.com"  # Email address
CALLING_APP = "AUGUSTALABS"  # Calling application identifier

class GlinttPatientCreator:
    def __init__(self, base_url="http://193.126.118.174:14000"):  # Using test environment
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
        
        # Headers for requests
        self.session.headers.update({
            'Accept': 'text/plain',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'cache-control': 'no-cache,no-cache'
        })
    
    def get_auth_token(self):
        """Get authentication token from Glintt API"""
        print("[AUTH] Getting authentication token...")
        
        auth_url = f"{self.base_url}/Glintt.GPlatform.APIGateway.CoreWebAPI/token"
        
        auth_data = {
            'client_id': 'MALO_AUGUSTALABS',
            'client_secret': '06B1AB3A-AA9A-EF4E-E063-0901820A785F',
            'grant_type': 'password',
            'TenantID': 'DEFAULT',
            'FacilityID': 'DEFAULT',
            'USERNAME': 'ADMIN'
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
                print(f"[SUCCESS] Token obtained successfully: {self.token[:20]}...")
                return True
            else:
                print(f"[ERROR] Failed to get token. Status: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"[ERROR] Error getting token: {str(e)}")
            return False
    
    def create_patient(self):
        """Create a patient using the CreateUpdatePatient endpoint"""
        if not self.token:
            print("[ERROR] No authentication token available")
            return None
        
        print(f"[PATIENT] Creating patient: {PATIENT_NAME}")
        print(f"[BIRTHDATE] Birthdate: {PATIENT_BIRTHDATE}")
        print(f"[PHONE] Phone: {PHONE_NUMBER_1}")
        print(f"[EMAIL] Email: {EMAIL}")
        
        # Add authorization header
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json',
            'Accept': 'text/plain',
            'Accept-Encoding': 'gzip, deflate, br'
        }
        
        # Build the request body based on Zoho code structure - minimal required fields
        patient_data = {
            "Gender": PATIENT_GENDER,
            "Birthdate": PATIENT_BIRTHDATE,
            "FinancialEntityID": FINANCIAL_ENTITY_ID,
            "PhoneNumber1": PHONE_NUMBER_1,
            "Email": EMAIL
        }
        
        # Create the main request structure
        request_body = {
            "Patient": {
                "PatientType": "MC"
            },
            "Name": PATIENT_NAME,
            "PatientData": patient_data
        }
        
        # Use the patient creation endpoint
        endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI.ExternalAccess/api/hms/Patient/CreateUpdatePatient?callingApp={CALLING_APP}"
        
        print(f"[ENDPOINT] Using endpoint: {endpoint}")
        print(f"[REQUEST] Request Body: {json.dumps(request_body, indent=2, default=str)}")
        
        try:
            response = self.session.post(endpoint, headers=headers, json=request_body)
            
            print(f"[STATUS] Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("[SUCCESS] Patient creation completed successfully!")
                print(f"[RESPONSE] Response data type: {type(data)}")
                
                if isinstance(data, dict):
                    print(f"[KEYS] Response keys: {list(data.keys())}")
                    
                    # Check for patient ID
                    if 'PatientID' in data:
                        print(f"[PATIENT_ID] Patient ID: {data['PatientID']}")
                    
                    # Check for any errors
                    if 'errorDetails' in data and data['errorDetails']:
                        print(f"[WARNING] Error details: {data['errorDetails']}")
                
                return data
            elif response.status_code == 400:
                print(f"[ERROR] Bad request - check request body")
                print(f"Response: {response.text[:300]}...")
            elif response.status_code == 404:
                print(f"[ERROR] Endpoint not found: {endpoint}")
            else:
                print(f"[ERROR] Failed with status: {response.status_code}")
                print(f"Response: {response.text[:300]}...")
                
        except Exception as e:
            print(f"[ERROR] Error with endpoint {endpoint}: {str(e)}")
        
        print("\n[ERROR] Patient creation failed.")
        return None


def main():
    """Main function to run the test"""
    print("[TEST] Glintt Patient Creation API Tester")
    print("=" * 60)
    print(f"[PATIENT] Patient Name: {PATIENT_NAME}")
    print(f"[BIRTHDATE] Birthdate: {PATIENT_BIRTHDATE}")
    print(f"[PHONE] Phone: {PHONE_NUMBER_1}")
    print(f"[EMAIL] Email: {EMAIL}")
    print("=" * 60)
    
    creator = GlinttPatientCreator()
    
    # Get authentication token
    if not creator.get_auth_token():
        print("[ERROR] Authentication failed. Exiting...")
        return
    
    print("\n" + "=" * 60)
    
    # Test patient creation
    print("\n[TEST] Testing patient creation...")
    result = creator.create_patient()
    
    if result:
        print(f"[SUCCESS] Patient creation completed successfully")
        
        # Print the result as JSON
        print("\n[RESULT] Creation result:")
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        
        # Save results to JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"patient_created_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False, default=str)
            print(f"\n[SAVED] Results saved to: {filename}")
        except Exception as e:
            print(f"\n[ERROR] Error saving to file: {str(e)}")
    else:
        print("[ERROR] Patient creation failed")
    
    print("\n" + "=" * 60)
    print("[DONE] Test completed!")


if __name__ == "__main__":
    main()
