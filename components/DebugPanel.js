// components/DebugPanel.js
import { useState } from 'react';

const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async (endpoint, label) => {
    setLoading(true);
    try {
      const startTime = Date.now();
      const response = await fetch(endpoint);
      const endTime = Date.now();
      const data = await response.json();

      return {
        endpoint,
        label,
        status: response.status,
        responseTime: endTime - startTime,
        success: response.ok,
        data: response.ok ? data : null,
        error: !response.ok ? data : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        endpoint,
        label,
        status: 'ERROR',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      setLoading(false);
    }
  };

  const runFullDiagnostic = async () => {
    setLoading(true);
    const results = [];

    // Test mentor-stats API
    const statsResult = await testAPI('/api/mentor-stats', 'Mentor Stats');
    results.push(statsResult);

    // Test recent submissions
    const submissionsResult = await testAPI('/api/debug/recent-submissions', 'Recent Submissions');
    results.push(submissionsResult);

    // Test cache status
    const cacheResult = await testAPI('/api/cache/refresh?action=status', 'Cache Status');
    results.push(cacheResult);

    // Test again after a small delay to check consistency
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statsResult2 = await testAPI('/api/mentor-stats', 'Mentor Stats (2nd call)');
    results.push(statsResult2);

    setDebugData({
      timestamp: new Date().toISOString(),
      results,
      comparison: {
        statsMatch: JSON.stringify(statsResult.data) === JSON.stringify(statsResult2.data),
        timeDifference: statsResult2.timestamp !== statsResult.timestamp
      }
    });
    setLoading(false);
  };

  const manualRefresh = () => {
    window.location.reload();
  };

  const clearCache = async () => {
    try {
      // Try to clear any browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        alert('Browser cache cleared');
      }
      // Force refresh
      window.location.reload();
    } catch (error) {
      console.error('Cache clear failed:', error);
      alert('Cache clear failed, doing hard refresh');
      window.location.reload();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-yellow-500 text-white px-3 py-2 rounded text-xs shadow-lg z-50"
      >
        🔧 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-96 max-h-96 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-sm">🔧 Debug Panel</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={runFullDiagnostic}
          disabled={loading}
          className="w-full bg-blue-500 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? '🔄 Testing...' : '🧪 Run Full Diagnostic'}
        </button>

        <button
          onClick={manualRefresh}
          className="w-full bg-green-500 text-white px-3 py-2 rounded text-sm"
        >
          🔄 Manual Refresh
        </button>

        <button
          onClick={clearCache}
          className="w-full bg-orange-500 text-white px-3 py-2 rounded text-sm"
        >
          🗑️ Clear Cache & Refresh
        </button>

        <button
          onClick={() => testAPI('/api/cache/refresh', 'Clear Mentor Cache').then(result => {
            setDebugData({ timestamp: new Date().toISOString(), results: [result], comparison: {} });
          })}
          className="w-full bg-purple-500 text-white px-3 py-2 rounded text-sm"
        >
          💾 Clear My Cache
        </button>
      </div>

      {debugData && (
        <div className="mt-4 text-xs">
          <h4 className="font-bold mb-2">Diagnostic Results:</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {debugData.results.map((result, index) => (
              <div
                key={index}
                className={`p-2 rounded ${result.success ? 'bg-green-50' : 'bg-red-50'}`}
              >
                <div className="font-semibold">
                  {result.success ? '✅' : '❌'} {result.label}
                </div>
                <div>Status: {result.status}</div>
                <div>Time: {result.responseTime}ms</div>
                {result.success && result.data && (
                  <div>
                    {result.data.allTime ? (
                      <>
                        Reports: {result.data.allTime.totalReports || 'N/A'} |
                        Current: {result.data.currentRoundStats?.reportedThisRound || 'N/A'}
                        {result.data.debug?.fromCache && <span className="text-blue-600"> (cached)</span>}
                        {result.data.debug?.impersonation?.isImpersonating && (
                          <div className="text-purple-600 text-xs mt-1">
                            🎭 Impersonating: {result.data.debug.impersonation.effectiveUser}
                          </div>
                        )}
                      </>
                    ) : result.data.size !== undefined ? (
                      <>
                        Cache Items: {result.data.size} |
                        Active: {result.data.items?.filter(i => !i.expired).length || 0}
                      </>
                    ) : (
                      JSON.stringify(result.data).substring(0, 100)
                    )}
                  </div>
                )}
                {result.error && (
                  <div className="text-red-600">Error: {JSON.stringify(result.error)}</div>
                )}
              </div>
            ))}
          </div>

          {debugData.comparison && (
            <div className="mt-2 p-2 bg-blue-50 rounded">
              <div className="font-semibold">Consistency Check:</div>
              <div>
                Data Match: {debugData.comparison.statsMatch ? '✅ Yes' : '❌ No'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugPanel;