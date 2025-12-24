// pages/monitoring.js
import React, { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Head from "next/head";

const StatusBadge = ({ status }) => {
  const colors = {
    healthy: "bg-green-100 text-green-800 border-green-300",
    degraded: "bg-yellow-100 text-yellow-800 border-yellow-300",
    error: "bg-red-100 text-red-800 border-red-300"
  };

  const icons = {
    healthy: "✓",
    degraded: "⚠",
    error: "✕"
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${colors[status] || colors.error}`}>
      {icons[status]} {status.toUpperCase()}
    </span>
  );
};

const StatCard = ({ label, value, sublabel = null, color = "blue", icon = null }) => {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50 border-blue-200",
    green: "text-green-600 bg-green-50 border-green-200",
    orange: "text-orange-600 bg-orange-50 border-orange-200",
    red: "text-red-600 bg-red-50 border-red-200",
    purple: "text-purple-600 bg-purple-50 border-purple-200"
  };

  return (
    <div className={`rounded-xl shadow-md p-6 border-2 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-600">{label}</div>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
      <div className={`text-3xl font-extrabold ${colorClasses[color].split(' ')[0]}`}>
        {value}
      </div>
      {sublabel && <div className="text-xs text-gray-500 mt-1">{sublabel}</div>}
    </div>
  );
};

const HealthCheckCard = ({ health }) => {
  if (!health) return null;

  const getStatusColor = (healthy) => healthy ? "green" : "red";
  const getStatusIcon = (healthy) => healthy ? "✓" : "✕";

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">System Health</h3>
        <StatusBadge status={health.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supabase Health */}
        <div className={`p-4 rounded-lg border-2 ${health.checks?.supabase?.healthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-700">Supabase</span>
            <span className="text-xl">{getStatusIcon(health.checks?.supabase?.healthy)}</span>
          </div>
          <div className="text-sm text-gray-600">{health.checks?.supabase?.message}</div>
          <div className="text-xs text-gray-500 mt-1">
            {health.checks?.supabase?.duration_ms}ms ({health.checks?.supabase?.performance})
          </div>
        </div>

        {/* Google Sheets Health */}
        <div className={`p-4 rounded-lg border-2 ${health.checks?.sheets?.healthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-700">Google Sheets</span>
            <span className="text-xl">{getStatusIcon(health.checks?.sheets?.healthy)}</span>
          </div>
          <div className="text-sm text-gray-600">{health.checks?.sheets?.message}</div>
          <div className="text-xs text-gray-500 mt-1">
            {health.checks?.sheets?.duration_ms}ms ({health.checks?.sheets?.performance})
          </div>
        </div>

        {/* Metrics Health */}
        <div className={`p-4 rounded-lg border-2 ${health.checks?.metrics?.healthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-700">Metrics</span>
            <span className="text-xl">{getStatusIcon(health.checks?.metrics?.healthy)}</span>
          </div>
          <div className="text-sm text-gray-600">{health.checks?.metrics?.message}</div>
          {health.checks?.metrics?.totalOperations !== undefined && (
            <div className="text-xs text-gray-500 mt-1">
              {health.checks?.metrics?.totalOperations} operations today
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const OperationsTable = ({ operations, loading }) => {
  const [expandedRow, setExpandedRow] = React.useState(null);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-gray-500">Loading operations...</div>
      </div>
    );
  }

  if (!operations || operations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-gray-500">No operations found</div>
      </div>
    );
  }

  const getStatusIcon = (sheetsSuccess, supabaseSuccess) => {
    if (sheetsSuccess && supabaseSuccess) return <span className="text-green-600">✓✓</span>;
    if (!sheetsSuccess && !supabaseSuccess) return <span className="text-red-600">✕✕</span>;
    return <span className="text-orange-600">⚠</span>;
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 overflow-x-auto">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Operations <span className="text-sm text-gray-500 font-normal">(Click to expand details)</span></h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="py-3 px-2">Status</th>
            <th className="py-3 px-2">Operation</th>
            <th className="py-3 px-2">Table</th>
            <th className="py-3 px-2">User</th>
            <th className="py-3 px-2">Batch</th>
            <th className="py-3 px-2">Sheets</th>
            <th className="py-3 px-2">Supabase</th>
            <th className="py-3 px-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op, idx) => (
            <React.Fragment key={op.id || idx}>
              <tr
                onClick={() => toggleRow(op.id)}
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="py-3 px-2">
                  {getStatusIcon(op.sheets_success, op.supabase_success)}
                </td>
                <td className="py-3 px-2 font-semibold">{op.operation_type}</td>
                <td className="py-3 px-2 text-gray-600">{op.table_name}</td>
                <td className="py-3 px-2 text-gray-600 text-xs">{op.user_email || '-'}</td>
                <td className="py-3 px-2 text-gray-600 text-xs">{op.batch_name || '-'}</td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-1 rounded text-xs ${op.sheets_success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {op.sheets_duration_ms}ms
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-1 rounded text-xs ${op.supabase_success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {op.supabase_duration_ms}ms
                  </span>
                </td>
                <td className="py-3 px-2 text-xs text-gray-500">
                  {new Date(op.timestamp).toLocaleString()}
                </td>
              </tr>
              {expandedRow === op.id && (
                <tr className="bg-blue-50 border-b border-gray-200">
                  <td colSpan="8" className="py-4 px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Record ID</div>
                          <div className="font-mono text-sm bg-white p-2 rounded border border-gray-200">
                            {op.record_id || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Program</div>
                          <div className="text-sm bg-white p-2 rounded border border-gray-200">
                            {op.program || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Google Sheets Error</div>
                          <div className={`text-sm p-2 rounded border ${op.sheets_error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200 text-gray-500'}`}>
                            {op.sheets_error || 'No error'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Supabase Error</div>
                          <div className={`text-sm p-2 rounded border ${op.supabase_error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200 text-gray-500'}`}>
                            {op.supabase_error || 'No error'}
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Operation ID</div>
                          <div className="font-mono text-xs bg-white p-2 rounded border border-gray-200 break-all">
                            {op.id}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Created At</div>
                          <div className="text-sm bg-white p-2 rounded border border-gray-200">
                            {new Date(op.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Metadata</div>
                          <div className="text-xs bg-white p-2 rounded border border-gray-200 font-mono max-h-32 overflow-auto">
                            <pre>{JSON.stringify(op.metadata, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DiscrepanciesPanel = ({ discrepancies, loading, onResolve }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-gray-500">Loading discrepancies...</div>
      </div>
    );
  }

  if (!discrepancies || discrepancies.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center text-green-600">
          <span className="text-2xl mr-2">✓</span>
          <span className="font-semibold">No unresolved discrepancies</span>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    const colors = {
      low: "bg-blue-100 text-blue-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800"
    };
    return colors[severity] || colors.medium;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Data Discrepancies</h3>
      <div className="space-y-3">
        {discrepancies.map((disc) => (
          <div key={disc.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(disc.severity)}`}>
                  {disc.severity?.toUpperCase()}
                </span>
                <span className="ml-2 text-sm font-semibold text-gray-700">
                  {disc.table_name}.{disc.field_name}
                </span>
              </div>
              <button
                onClick={() => onResolve(disc.id)}
                className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Resolve
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
              <div>
                <div className="text-xs text-gray-500">Google Sheets:</div>
                <div className="font-mono text-xs bg-gray-50 p-2 rounded mt-1">{disc.sheets_value || 'null'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Supabase:</div>
                <div className="font-mono text-xs bg-gray-50 p-2 rounded mt-1">{disc.supabase_value || 'null'}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Record: {disc.record_id} • Detected: {new Date(disc.detected_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function MonitoringDashboard() {
  const { data: session, status } = useSession();
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [operations, setOperations] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch health
      const healthRes = await fetch('/api/monitoring/health');
      const healthData = await healthRes.json();
      setHealth(healthData);

      // Fetch stats
      const statsRes = await fetch('/api/monitoring/stats?period=today');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch recent operations
      const opsRes = await fetch('/api/monitoring/recent-operations?limit=20');
      const opsData = await opsRes.json();
      setOperations(opsData.operations || []);

      // Fetch discrepancies
      const discRes = await fetch('/api/monitoring/discrepancies?resolved=false');
      const discData = await discRes.json();
      setDiscrepancies(discData.discrepancies || []);

    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDiscrepancy = async (id) => {
    try {
      const res = await fetch('/api/monitoring/discrepancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          resolved: true,
          resolvedBy: session?.user?.email,
          notes: 'Resolved via monitoring dashboard'
        })
      });

      if (res.ok) {
        // Refresh discrepancies
        const discRes = await fetch('/api/monitoring/discrepancies?resolved=false');
        const discData = await discRes.json();
        setDiscrepancies(discData.discrepancies || []);
      }
    } catch (err) {
      console.error('Error resolving discrepancy:', err);
    }
  };

  const handleTriggerComparison = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/monitoring/compare-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();

      if (res.ok) {
        alert(`Comparison completed!\n\nDuration: ${data.result.duration_ms}ms\nDiscrepancies found: ${data.result.discrepancies_found}`);
        fetchData(); // Refresh all data
      } else {
        alert(`Comparison failed: ${data.message}`);
      }
    } catch (err) {
      console.error('Error triggering comparison:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  useEffect(() => {
    if (autoRefresh && status === "authenticated") {
      const interval = setInterval(() => {
        fetchData();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, status]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Monitoring Dashboard</h1>
          <p className="text-gray-600 mb-6">Please sign in to view the monitoring dashboard</p>
          <button
            onClick={() => signIn("google")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Head>
        <title>Monitoring Dashboard | iTEKAD Mentor Portal</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-800">Monitoring Dashboard</h1>
              <p className="text-gray-600 mt-2">Dual-Write System Health & Performance</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}
              >
                {autoRefresh ? '🔄 Auto-refresh ON' : '⏸ Auto-refresh OFF'}
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
              >
                🔄 Refresh Now
              </button>
              <button
                onClick={handleTriggerComparison}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold disabled:opacity-50"
              >
                🔍 Compare Now
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Health Check */}
        <HealthCheckCard health={health} />

        {/* Statistics Grid */}
        {stats?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
              label="Total Operations"
              value={stats.summary.total_operations || 0}
              sublabel="Today"
              color="blue"
              icon="📊"
            />
            <StatCard
              label="Sheets Success Rate"
              value={`${stats.summary.sheets_success_rate || 0}%`}
              sublabel={`${stats.summary.sheets_success_count || 0} / ${stats.summary.total_operations || 0}`}
              color={stats.summary.sheets_success_rate >= 99 ? "green" : stats.summary.sheets_success_rate >= 95 ? "orange" : "red"}
              icon="📄"
            />
            <StatCard
              label="Supabase Success Rate"
              value={`${stats.summary.supabase_success_rate || 0}%`}
              sublabel={`${stats.summary.supabase_success_count || 0} / ${stats.summary.total_operations || 0}`}
              color={stats.summary.supabase_success_rate >= 99 ? "green" : stats.summary.supabase_success_rate >= 95 ? "orange" : "red"}
              icon="🗄️"
            />
            <StatCard
              label="Both Systems Success"
              value={`${stats.summary.both_success_rate || 0}%`}
              sublabel={`${stats.summary.both_success_count || 0} operations`}
              color={stats.summary.both_success_rate >= 99 ? "green" : stats.summary.both_success_rate >= 95 ? "orange" : "red"}
              icon="✓✓"
            />
          </div>
        )}

        {/* Performance Metrics */}
        {stats?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Average Response Times</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Google Sheets</span>
                    <span className="font-semibold">{stats.summary.avg_sheets_duration_ms || 0}ms</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min((stats.summary.avg_sheets_duration_ms || 0) / 30, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Supabase</span>
                    <span className="font-semibold">{stats.summary.avg_supabase_duration_ms || 0}ms</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min((stats.summary.avg_supabase_duration_ms || 0) / 30, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Failure Breakdown</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sheets Only Failed</span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                    {stats.summary.sheets_only_success_count || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Supabase Only Failed</span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                    {stats.summary.supabase_only_success_count || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Both Failed</span>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                    {stats.summary.both_failed_count || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Discrepancies */}
        <div className="mb-6">
          <DiscrepanciesPanel
            discrepancies={discrepancies}
            loading={loading}
            onResolve={handleResolveDiscrepancy}
          />
        </div>

        {/* Recent Operations Table */}
        <OperationsTable operations={operations} loading={loading} />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()} •
          {autoRefresh && ' Auto-refreshing every 30 seconds'}
        </div>
      </div>
    </div>
  );
}
