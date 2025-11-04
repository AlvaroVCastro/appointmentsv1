import requests
import json
from datetime import datetime

# Configuration - modify these values as needed
HUMAN_RESOURCE_IDS = ["1917"]  # List of human resource IDs to search for
BASE_URL = "https://your-glintt-api.example.com"  # Replace with your actual Glintt API URL
SKIP = 0
TAKE = 100

class GlinttHumanResourcesDetailsTester:
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
    
    def get_human_resources_details(self):
        """Get human resources details based on the Zoho example"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        try:
            # Build the endpoint URL with query parameters
            endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/humanresources/search-detail"
            
            # Query parameters
            params = {
                "skip": SKIP,
                "take": TAKE
            }
            
            # Request body (POST parameters)
            request_body = {
                "HumanResourceIDs": HUMAN_RESOURCE_IDS
            }
            
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            }
            
            print(f"\n🔍 Searching for human resources details...")
            print(f"📋 Human Resource IDs: {HUMAN_RESOURCE_IDS}")
            print(f"📊 Skip: {SKIP}, Take: {TAKE}")
            print(f"🌐 Endpoint: {endpoint}")
            print(f"📦 Request Body: {json.dumps(request_body, indent=2)}")
            
            response = self.session.post(endpoint, headers=headers, params=params, json=request_body)
            
            print(f"\n📊 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Human resources details retrieved successfully")
                print(f"📈 Response data type: {type(data)}")
                
                if isinstance(data, list):
                    print(f"📋 Number of items: {len(data)}")
                    if len(data) > 0:
                        print(f"🔍 First item structure:")
                        print(json.dumps(data[0], indent=2, ensure_ascii=False, default=str))
                else:
                    print(f"📋 Response structure:")
                    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
                
                return data
            else:
                print(f"❌ Request failed with status: {response.status_code}")
                print(f"📄 Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error retrieving human resources details: {str(e)}")
            return None

def main():
    print("🚀 Glintt Human Resources Details Tester")
    print("=" * 50)
    
    tester = GlinttHumanResourcesDetailsTester()
    
    # Get authentication token
    if not tester.get_auth_token():
        print("❌ Failed to get authentication token")
        return
    
    # Get human resources details
    result = tester.get_human_resources_details()
    
    if result:
        print(f"\n✅ Human resources details retrieved successfully")
        
        # Save results to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"human_resources_details_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"💾 Results saved to: {filename}")
    else:
        print(f"\n❌ Failed to retrieve human resources details")

if __name__ == "__main__":
    main()
