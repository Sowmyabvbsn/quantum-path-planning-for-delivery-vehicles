import React, { useState } from 'react';
import routeService from '../services/routeService';
import { geocodeAddress, reverseGeocode, getDirections, searchNearbyPlaces } from '../services/api';

/**
 * Test component to verify road-following routes are working
 */
function RouteTestComponent() {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiTests, setApiTests] = useState(null);
  const [testingApis, setTestingApis] = useState(false);

  const testGoogleAPIs = async () => {
    setTestingApis(true);
    setApiTests(null);

    const tests = [
      {
        name: 'Geocoding API',
        test: () => geocodeAddress('Mumbai, India'),
        check: (result) => result.success && result.results && result.results.length > 0
      },
      {
        name: 'Reverse Geocoding API',
        test: () => reverseGeocode(19.0760, 72.8777),
        check: (result) => result.success && result.results && result.results.length > 0
      },
      {
        name: 'Directions API',
        test: () => getDirections('Mumbai, India', 'Delhi, India'),
        check: (result) => result.success && result.routes && result.routes.length > 0
      },
      {
        name: 'Places API',
        test: () => searchNearbyPlaces('19.0760,72.8777', 1000, 'restaurant'),
        check: (result) => result.success && result.results
      }
    ];

    const results = [];

    for (const test of tests) {
      try {
        console.log(`Testing ${test.name}...`);
        const result = await test.test();
        const passed = test.check(result);

        results.push({
          name: test.name,
          passed,
          result: passed ? 'SUCCESS' : 'FAILED',
          details: result,
          error: null
        });
      } catch (error) {
        console.error(`${test.name} failed:`, error);
        results.push({
          name: test.name,
          passed: false,
          result: 'ERROR',
          details: null,
          error: error.message
        });
      }
    }

    setApiTests(results);
    setTestingApis(false);
  };

  const testRoadFollowingRoute = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      // Test with sample stops (Mumbai to Delhi via Pune)
      const testStops = [
        {
          latitude: 19.0760,
          longitude: 72.8777,
          name: 'Mumbai, Maharashtra'
        },
        {
          latitude: 18.5204,
          longitude: 73.8567,
          name: 'Pune, Maharashtra'
        },
        {
          latitude: 28.6139,
          longitude: 77.2090,
          name: 'Delhi, India'
        }
      ];

      console.log('Testing road-following route with stops:', testStops);

      const result = await routeService.getRoadFollowingRoute(testStops, {
        optimize: false,
        avoid: ['tolls']
      });

      console.log('Route result:', result);

      if (result.success) {
        const routeInfo = routeService.formatRouteInfo(result);
        setTestResult({
          success: true,
          message: 'Road-following route successfully generated!',
          details: {
            coordinatesCount: result.coordinates.length,
            ...routeInfo
          },
          coordinates: result.coordinates.slice(0, 10) // Show first 10 coordinates
        });
      } else {
        setTestResult({
          success: false,
          message: 'Route generation failed',
          error: result.error,
          fallback: result.fallbackCoordinates ? 'Fallback coordinates available' : 'No fallback'
        });
      }

    } catch (error) {
      console.error('Route test error:', error);
      setTestResult({
        success: false,
        message: 'Test failed with error',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      backgroundColor: '#f8fafc'
    }}>
      <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
        🛣️ Road-Following Route Test
      </h3>
      
      <p style={{ color: '#64748b', marginBottom: '16px' }}>
        This test verifies that routes follow actual roads using Google Directions API
        instead of drawing straight lines between points.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={testGoogleAPIs}
          disabled={testingApis}
          style={{
            padding: '10px 20px',
            backgroundColor: testingApis ? '#94a3b8' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: testingApis ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {testingApis ? 'Testing APIs...' : 'Test Google Cloud APIs'}
        </button>

        <button
          onClick={testRoadFollowingRoute}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#94a3b8' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {loading ? 'Testing Route...' : 'Test Road-Following Route'}
        </button>
      </div>

      {apiTests && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          borderRadius: '6px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ color: '#1e293b', marginBottom: '12px' }}>
            🔌 Google Cloud APIs Connection Test
          </h4>

          {apiTests.map((test, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: index < apiTests.length - 1 ? '1px solid #e2e8f0' : 'none'
            }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>
                {test.passed ? '✅' : '❌'}
              </span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: test.passed ? '#059669' : '#dc2626' }}>
                  {test.name}
                </strong>
                <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '14px' }}>
                  {test.result}
                </span>
                {test.error && (
                  <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                    Error: {test.error}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: apiTests.every(t => t.passed) ? '#f0f9ff' : '#fef2f2',
            borderRadius: '4px',
            fontSize: '14px',
            color: apiTests.every(t => t.passed) ? '#0c4a6e' : '#991b1b'
          }}>
            {apiTests.every(t => t.passed) ? (
              '🎉 All APIs are working! Your Google Cloud setup is correct.'
            ) : (
              '⚠️ Some APIs failed. Check your Google Cloud Console setup.'
            )}
          </div>
        </div>
      )}

      {testResult && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          borderRadius: '6px',
          backgroundColor: testResult.success ? '#f0f9ff' : '#fef2f2',
          border: `1px solid ${testResult.success ? '#bae6fd' : '#fecaca'}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '20px', marginRight: '8px' }}>
              {testResult.success ? '✅' : '❌'}
            </span>
            <strong style={{
              color: testResult.success ? '#0c4a6e' : '#991b1b'
            }}>
              {testResult.message}
            </strong>
          </div>

          {testResult.success && testResult.details && (
            <div style={{ color: '#374151', fontSize: '14px' }}>
              <p><strong>Route Details:</strong></p>
              <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                <li>Coordinates: {testResult.details.coordinatesCount} points</li>
                <li>Distance: {testResult.details.distance}</li>
                <li>Duration: {testResult.details.duration}</li>
                <li>With Traffic: {testResult.details.durationInTraffic}</li>
                <li>Traffic Impact: {testResult.details.trafficDelay}</li>
              </ul>
              
              <details style={{ marginTop: '12px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
                  Sample Coordinates (first 10 points)
                </summary>
                <pre style={{
                  backgroundColor: '#f1f5f9',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  marginTop: '8px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(testResult.coordinates, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {!testResult.success && (
            <div style={{ color: '#991b1b', fontSize: '14px' }}>
              <p><strong>Error:</strong> {testResult.error}</p>
              {testResult.fallback && (
                <p><strong>Fallback:</strong> {testResult.fallback}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#fffbeb',
        border: '1px solid #fed7aa',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#92400e'
      }}>
        <strong>💡 What this test does:</strong>
        <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
          <li>Creates a route from Mumbai → Pune → Delhi</li>
          <li>Uses Google Directions API to get road-following coordinates</li>
          <li>Returns hundreds of coordinate points that follow actual roads</li>
          <li>Includes real-time traffic data and duration estimates</li>
        </ul>
      </div>
    </div>
  );
}

export default RouteTestComponent;
