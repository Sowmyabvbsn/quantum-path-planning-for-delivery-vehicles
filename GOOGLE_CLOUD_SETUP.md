# 🚀 Google Cloud APIs Setup Guide

## 📋 Quick Setup Checklist

### ✅ **Step 1: Google Cloud Console Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Create a new project or select existing one
4. **Enable billing** (required even for free tier - you get $300 free credits)

### ✅ **Step 2: Enable Required APIs**
Go to **"APIs & Services" > "Library"** and enable these APIs:

```
□ Maps JavaScript API
□ Geocoding API
□ Directions API
□ Places API (New)
□ Roads API
□ Distance Matrix API
```

**For each API:**
1. Search for the API name
2. Click on it
3. Click "Enable"
4. Wait for activation (1-2 minutes)

### ✅ **Step 3: Create API Key**
1. Go to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials" > "API Key"**
3. **Copy the generated key**
4. Click **"Restrict Key"** (recommended for security)
5. Under **"API restrictions"**, select **"Restrict key"**
6. **Check all the APIs** you enabled above
7. Click **"Save"**

### ✅ **Step 4: Update Your Application**

**Backend (.env file):**
```bash
GOOGLE_CLOUD_API_KEY=your_new_api_key_here
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=quantum_routing
```

**Frontend (.env.local file):**
```bash
VITE_GOOGLE_MAPS_API_KEY=your_new_api_key_here
VITE_API_URL=http://localhost:8000
```

## 🧪 **Test Your Setup**

### **Method 1: Python Test Script**
```bash
# In your project root directory
python test_google_apis.py
```

### **Method 2: Frontend Test**
1. Start your application
2. Go to the **"Route Test"** tab
3. Click **"Test Google Cloud APIs"**
4. All tests should show ✅ SUCCESS

## 🔧 **Troubleshooting**

### **Common Issues:**

#### ❌ **"API key not found"**
- Check your `.env` and `.env.local` files
- Make sure the API key is correctly copied
- Restart your backend server after updating `.env`

#### ❌ **"API not enabled"**
- Go to Google Cloud Console > APIs & Services > Library
- Search for the specific API and enable it
- Wait 1-2 minutes for activation

#### ❌ **"Billing not enabled"**
- Go to Google Cloud Console > Billing
- Link a billing account (required even for free tier)
- You won't be charged until you exceed free limits

#### ❌ **"Permission denied"**
- Go to Google Cloud Console > APIs & Services > Credentials
- Edit your API key
- Make sure all required APIs are checked under restrictions

## 💰 **Pricing Information**

### **Free Tier (Monthly)**
- **$200 credit** for new Google Cloud accounts
- **Maps JavaScript API**: ~28,000 map loads
- **Geocoding API**: ~40,000 requests
- **Directions API**: ~40,000 requests
- **Places API**: ~100,000 requests
- **Roads API**: ~100,000 requests
- **Distance Matrix API**: ~40,000 elements

### **Your App Usage**
- **Development/Testing**: Well within free limits
- **Small Production**: Should stay within free tier
- **Large Scale**: Monitor usage in Google Cloud Console

## 🔗 **Useful Links**

- **Google Cloud Console**: https://console.cloud.google.com/
- **API Library**: https://console.cloud.google.com/apis/library
- **Credentials**: https://console.cloud.google.com/apis/credentials
- **Billing**: https://console.cloud.google.com/billing
- **Usage Monitoring**: https://console.cloud.google.com/apis/dashboard

## 🎯 **What Each API Does**

| API | Purpose | Used For |
|-----|---------|----------|
| **Maps JavaScript** | Interactive maps | Map tiles, markers, controls |
| **Geocoding** | Address ↔ Coordinates | Address search, location lookup |
| **Directions** | Route calculation | Road-following routes with traffic |
| **Places** | Location search | Find nearby places, obstacles |
| **Roads** | Road data | Speed limits, road snapping |
| **Distance Matrix** | Multi-point distances | Quantum optimization calculations |

## ✅ **Success Indicators**

When everything is working correctly, you should see:

1. **✅ All API tests pass** in the Route Test tab
2. **✅ Routes follow actual roads** instead of straight lines
3. **✅ Real-time traffic data** in route calculations
4. **✅ Accurate distance and duration** estimates
5. **✅ Hundreds of coordinate points** for smooth route visualization

## 🚨 **Security Notes**

- **Never commit API keys** to version control
- **Use environment variables** for API keys
- **Set up API restrictions** in Google Cloud Console
- **Monitor API usage** to prevent unexpected charges
- **Consider domain restrictions** for production

---

**Need Help?** 
- Check the Google Cloud Console for detailed error messages
- Use the test scripts provided to diagnose issues
- Monitor API usage in the Google Cloud dashboard
