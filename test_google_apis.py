#!/usr/bin/env python3
"""
Google Cloud APIs Connection Test
Run this script to verify all APIs are properly connected
"""

import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

API_KEY = os.getenv('GOOGLE_CLOUD_API_KEY')

def test_api_connection():
    """Test connection to Google Cloud APIs"""
    
    if not API_KEY:
        print("❌ ERROR: GOOGLE_CLOUD_API_KEY not found in environment variables")
        print("Please add your API key to .env file")
        return False
    
    print(f"🔑 Testing with API Key: {API_KEY[:20]}...")
    print("=" * 60)
    
    # Test APIs
    tests = [
        {
            'name': 'Geocoding API',
            'url': 'https://maps.googleapis.com/maps/api/geocode/json',
            'params': {'address': 'Mumbai, India', 'key': API_KEY}
        },
        {
            'name': 'Directions API', 
            'url': 'https://maps.googleapis.com/maps/api/directions/json',
            'params': {
                'origin': 'Mumbai, India',
                'destination': 'Delhi, India', 
                'key': API_KEY
            }
        },
        {
            'name': 'Places API',
            'url': 'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            'params': {
                'location': '19.0760,72.8777',
                'radius': 1000,
                'type': 'restaurant',
                'key': API_KEY
            }
        },
        {
            'name': 'Distance Matrix API',
            'url': 'https://maps.googleapis.com/maps/api/distancematrix/json',
            'params': {
                'origins': 'Mumbai, India',
                'destinations': 'Delhi, India',
                'key': API_KEY
            }
        }
    ]
    
    all_passed = True
    
    for test in tests:
        print(f"🧪 Testing {test['name']}...")
        
        try:
            response = requests.get(test['url'], params=test['params'], timeout=10)
            data = response.json()
            
            if response.status_code == 200 and data.get('status') == 'OK':
                print(f"   ✅ {test['name']} - SUCCESS")
                
                # Show sample data
                if test['name'] == 'Geocoding API':
                    if data.get('results'):
                        location = data['results'][0]['geometry']['location']
                        print(f"      📍 Mumbai coordinates: {location['lat']}, {location['lng']}")
                
                elif test['name'] == 'Directions API':
                    if data.get('routes'):
                        route = data['routes'][0]
                        distance = route['legs'][0]['distance']['text']
                        duration = route['legs'][0]['duration']['text']
                        print(f"      🛣️  Mumbai to Delhi: {distance}, {duration}")
                
                elif test['name'] == 'Places API':
                    if data.get('results'):
                        count = len(data['results'])
                        print(f"      🏪 Found {count} places near Mumbai")
                
                elif test['name'] == 'Distance Matrix API':
                    if data.get('rows'):
                        element = data['rows'][0]['elements'][0]
                        if element.get('status') == 'OK':
                            distance = element['distance']['text']
                            duration = element['duration']['text']
                            print(f"      📏 Distance: {distance}, Duration: {duration}")
            
            else:
                print(f"   ❌ {test['name']} - FAILED")
                print(f"      Status: {data.get('status', 'Unknown')}")
                print(f"      Error: {data.get('error_message', 'No error message')}")
                all_passed = False
                
        except Exception as e:
            print(f"   ❌ {test['name']} - ERROR: {str(e)}")
            all_passed = False
    
    print("=" * 60)
    
    if all_passed:
        print("🎉 ALL TESTS PASSED! Your Google Cloud APIs are properly connected.")
        print("✅ You can now use the quantum path planning application.")
    else:
        print("❌ SOME TESTS FAILED. Please check:")
        print("   1. API key is correct")
        print("   2. All APIs are enabled in Google Cloud Console")
        print("   3. Billing is enabled on your Google Cloud account")
        print("   4. API key has proper restrictions set")
    
    return all_passed

def show_setup_instructions():
    """Show setup instructions"""
    print("\n📋 SETUP INSTRUCTIONS:")
    print("1. Go to: https://console.cloud.google.com/")
    print("2. Create/select a project")
    print("3. Enable billing (required even for free tier)")
    print("4. Go to 'APIs & Services' > 'Library'")
    print("5. Enable these APIs:")
    print("   - Maps JavaScript API")
    print("   - Geocoding API")
    print("   - Directions API") 
    print("   - Places API")
    print("   - Roads API")
    print("   - Distance Matrix API")
    print("6. Go to 'APIs & Services' > 'Credentials'")
    print("7. Create API Key")
    print("8. Restrict the key to the APIs above")
    print("9. Add the key to your .env file")

if __name__ == "__main__":
    print("🚀 Google Cloud APIs Connection Test")
    print("=" * 60)
    
    success = test_api_connection()
    
    if not success:
        show_setup_instructions()
    
    print("\n🔗 Useful Links:")
    print("- Google Cloud Console: https://console.cloud.google.com/")
    print("- API Library: https://console.cloud.google.com/apis/library")
    print("- Credentials: https://console.cloud.google.com/apis/credentials")
    print("- Billing: https://console.cloud.google.com/billing")
