import requests
import json
from datetime import datetime, timedelta
import sys
import os

# Add the parent directory to the path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class GlinttAppointmentTester:
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
    
    def get_todays_appointments(self):
        """Get appointments for today"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        print("📋 Getting today's appointments...")
        
        # Add authorization header
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        # Build the URL with query parameters
        url = f"{self.base_url}/Hms.OutPatient.Api/hms/outpatient/Appointment"
        
        # Get today's date range
        today = datetime.now()
        
        all_appointments = []
        skip = 0
        take = 100
        
        while True:
            params = {
                'beginDate': today.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
                'endDate': today.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat(),
                'skip': skip,
                'take': take
            }
            
            try:
                response = self.session.get(url, headers=headers, params=params)
                
                print(f"📡 Request URL: {response.url}")
                print(f"📊 Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        all_appointments.extend(data)
                        print(f"📈 Retrieved {len(data)} appointments (skip={skip}, take={take})")
                        
                        # If we got fewer results than requested, we've reached the end
                        if len(data) < take:
                            break
                        
                        skip += take
                    else:
                        print("❌ Unexpected response format")
                        return None
                else:
                    print(f"❌ Failed to get appointment history. Status: {response.status_code}")
                    print(f"Response: {response.text}")
                    return None
                    
            except Exception as e:
                print(f"❌ Error getting appointment history: {str(e)}")
                return None
        
        print("✅ All appointments retrieved successfully!")
        print(f"📈 Total number of appointments: {len(all_appointments)}")
        return all_appointments



def main():
    """Main function to run the tests"""
    print("🏥 Glintt Appointment API Tester")
    print("=" * 60)
    
    tester = GlinttAppointmentTester()
    
    # Step 1: Get authentication token
    if not tester.get_auth_token():
        print("❌ Authentication failed. Exiting...")
        return
    
    print("\n" + "=" * 60)
    
    # Step 2: Test appointment with GET (query parameters)
    result = tester.get_todays_appointments()
    if result:
        appointment_count = len(result) if isinstance(result, list) else 'N/A'
        print(f"\n📋 Today's appointments: {appointment_count} found")
        
        # Print the first appointment object as JSON
        if result and len(result) > 0:
            print("\n🔍 First appointment object:")
            print(json.dumps(result[0], indent=2, ensure_ascii=False))
        
        # Save results to JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"appointments_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False, default=str)
            print(f"\n💾 Results saved to: {filename}")
        except Exception as e:
            print(f"\n❌ Error saving to file: {str(e)}")
    else:
        print("❌ GET request failed")
    
    print("\n" + "=" * 60)
    print("🎉 Test completed!")

if __name__ == "__main__":
    main()
