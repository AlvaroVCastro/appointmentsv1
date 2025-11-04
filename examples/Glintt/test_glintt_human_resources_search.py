import requests
import json
from datetime import datetime

# Configuration - modify these values as needed
SEARCH_STRING = "Antonio Bastos"  # Search for specific name
HUMAN_RESOURCE_TYPES = ["MED","ENF","TEC"]  # Types: MED (Doctor), ENF (Nurse), TEC (Technician)
BASE_URL = "https://your-glintt-api.example.com"  # Replace with your actual Glintt API URL
SKIP = 0
TAKE = 9999  # Large number to get all results

class GlinttHumanResourcesSearchTester:
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
    
    def search_human_resources(self, search_string=None):
        """Search human resources based on the Zoho example"""
        if not self.token:
            print("❌ No authentication token available")
            return None
        
        # Use provided search string or default
        search_term = search_string if search_string is not None else SEARCH_STRING
        
        try:
            # Build the endpoint URL with query parameters
            endpoint = f"{self.base_url}/Glintt.HMS.CoreWebAPI/api/hms/humanresources/search"
            
            # Query parameters
            params = {
                "skip": SKIP,
                "take": TAKE
            }
            
            # Request body (POST parameters) - matching the Zoho code structure
            request_body = {
                "SearchString": search_term,
                "HumanResourceIDs": [],  # Empty array to search all
                "Types": HUMAN_RESOURCE_TYPES
            }
            
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            }
            
            print(f"\n🔍 Searching for human resources...")
            print(f"📋 Search String: '{search_term}'")
            print(f"📋 Human Resource Types: {HUMAN_RESOURCE_TYPES}")
            print(f"📊 Skip: {SKIP}, Take: {TAKE}")
            print(f"🌐 Endpoint: {endpoint}")
            print(f"📦 Request Body: {json.dumps(request_body, indent=2)}")
            
            response = self.session.post(endpoint, headers=headers, params=params, json=request_body)
            
            print(f"\n📊 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Human resources search completed successfully")
                print(f"📈 Response data type: {type(data)}")
                
                if isinstance(data, list):
                    print(f"📋 Number of items found: {len(data)}")
                    if len(data) > 0:
                        print(f"🔍 First item structure:")
                        print(json.dumps(data[0], indent=2, ensure_ascii=False, default=str))
                        
                        # Show summary of types found
                        types_found = {}
                        for item in data:
                            item_type = item.get('Type', 'Unknown')
                            types_found[item_type] = types_found.get(item_type, 0) + 1
                        
                        print(f"\n📊 Summary by type:")
                        for type_name, count in types_found.items():
                            print(f"   {type_name}: {count} items")
                else:
                    print(f"📋 Response structure:")
                    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
                
                return data
            else:
                print(f"❌ Request failed with status: {response.status_code}")
                print(f"📄 Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error searching human resources: {str(e)}")
            return None
    
    def search_with_variations(self, base_name):
        """Try multiple search variations to find a person"""
        print(f"\n🔍 Trying multiple search variations for: {base_name}")
        
        # Different search variations to try
        search_variations = [
            base_name,  # Original
            base_name.lower(),  # Lowercase
            base_name.upper(),  # Uppercase
            base_name.replace("ó", "o"),  # Remove accent
            base_name.replace("ó", "o").lower(),  # Remove accent + lowercase
            base_name.split()[0],  # First name only
            base_name.split()[-1],  # Last name only
            "Antonio",  # Just first name without accent
            "Bastos",  # Just last name
        ]
        
        all_results = []
        
        for i, variation in enumerate(search_variations, 1):
            print(f"\n--- Variation {i}: '{variation}' ---")
            result = self.search_human_resources(variation)
            
            if result and isinstance(result, list) and len(result) > 0:
                print(f"✅ Found {len(result)} result(s) with variation '{variation}'")
                all_results.extend(result)
                
                # Show the results
                for item in result:
                    print(f"   📋 {item.get('Name', 'N/A')} (ID: {item.get('ID', 'N/A')}, Type: {item.get('Type', 'N/A')})")
            else:
                print(f"❌ No results found with variation '{variation}'")
        
        # Remove duplicates based on ID
        unique_results = []
        seen_ids = set()
        for item in all_results:
            item_id = item.get('ID')
            if item_id and item_id not in seen_ids:
                unique_results.append(item)
                seen_ids.add(item_id)
        
        print(f"\n📊 Summary: Found {len(unique_results)} unique result(s) across all variations")
        return unique_results

def main():
    print("🚀 Glintt Human Resources Search Tester")
    print("=" * 50)
    print("📝 This test searches for human resources by type without specifying IDs")
    print(f"🔍 Searching for types: {HUMAN_RESOURCE_TYPES}")
    print(f"🌐 Using base URL: {BASE_URL}")
    print("=" * 50)
    
    tester = GlinttHumanResourcesSearchTester()
    
    # Get authentication token
    if not tester.get_auth_token():
        print("❌ Failed to get authentication token")
        return
    
    # Search human resources with variations
    result = tester.search_with_variations(SEARCH_STRING)
    
    if result:
        print(f"\n✅ Human resources search completed successfully")
        
        # Save results to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"human_resources_search_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"💾 Results saved to: {filename}")
        
        # Show some statistics
        if isinstance(result, list) and len(result) > 0:
            print(f"\n📊 Final Search Statistics:")
            print(f"   Total unique items found: {len(result)}")
            
            # Count by type
            types_found = {}
            for item in result:
                item_type = item.get('Type', 'Unknown')
                types_found[item_type] = types_found.get(item_type, 0) + 1
            
            for type_name, count in types_found.items():
                print(f"   {type_name}: {count} items")
            
            # Show all found names
            print(f"\n📋 All found names:")
            for item in result:
                name = item.get('Name', 'N/A')
                item_id = item.get('ID', 'N/A')
                item_type = item.get('Type', 'N/A')
                print(f"   • {name} (ID: {item_id}, Type: {item_type})")
    else:
        print(f"\n❌ Failed to find any human resources matching the search criteria")

if __name__ == "__main__":
    main()
