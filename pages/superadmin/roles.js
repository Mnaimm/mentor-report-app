// pages/superadmin/roles.js
import { useState, useEffect } from 'react';
import { getSession } from 'next-auth/react';
import { isSystemAdmin } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';

// Role display names
const ROLE_NAMES = {
  system_admin: 'System Admin',
  program_coordinator: 'Program Coordinator',
  report_admin: 'Report Admin',
  payment_admin: 'Payment Admin',
  payment_approver: 'Payment Approver',
  stakeholder: 'Stakeholder',
  mentor: 'Mentor',
  premier_mentor: 'Premier Mentor'
};

// Role colors for badges
const ROLE_COLORS = {
  system_admin: 'bg-red-100 text-red-800 border-red-300',
  program_coordinator: 'bg-blue-100 text-blue-800 border-blue-300',
  report_admin: 'bg-green-100 text-green-800 border-green-300',
  payment_admin: 'bg-purple-100 text-purple-800 border-purple-300',
  payment_approver: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  stakeholder: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  mentor: 'bg-gray-100 text-gray-800 border-gray-300',
  premier_mentor: 'bg-pink-100 text-pink-800 border-pink-300'
};

export default function RoleManagementPage({ userEmail, accessDenied }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [addingRole, setAddingRole] = useState(false);

  // If access is denied, show AccessDenied component
  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/superadmin/list-users');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!newUserEmail || !newUserRole) {
      alert('Please provide both email and role');
      return;
    }

    setAddingRole(true);
    try {
      const res = await fetch('/api/superadmin/add-user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          role: newUserRole
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add role');
      }

      alert(`✅ ${data.message}`);
      setShowAddModal(false);
      setNewUserEmail('');
      setNewUserRole('');
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error adding role:', err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setAddingRole(false);
    }
  };

  const handleRemoveRole = async (email, role) => {
    // Confirmation dialog
    const confirmed = confirm(
      `Are you sure you want to remove the "${ROLE_NAMES[role]}" role from ${email}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const res = await fetch('/api/superadmin/remove-user-role', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove role');
      }

      alert(`✅ ${data.message}`);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error removing role:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Filter users based on search query and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  // Get unique roles for filter dropdown
  const allRoles = [...new Set(users.flatMap(u => u.roles))].sort();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
          <p className="text-gray-600 mt-1">
            Manage user roles and permissions • System Administrator Only
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {/* Action Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="🔍 Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                {allRoles.map(role => (
                  <option key={role} value={role}>
                    {ROLE_NAMES[role]}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                ➕ Add Role
              </button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-2xl font-bold text-gray-900">{users.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Filtered Results</div>
            <div className="text-2xl font-bold text-blue-600">{filteredUsers.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Unique Roles</div>
            <div className="text-2xl font-bold text-green-600">{allRoles.length}</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                        Loading users...
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.email} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <div
                              key={role}
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[role]}`}
                            >
                              <span>{ROLE_NAMES[role]}</span>
                              <button
                                onClick={() => handleRemoveRole(user.email, role)}
                                className="hover:opacity-70 focus:outline-none"
                                title="Remove role"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.assigned_by || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.assigned_at ? new Date(user.assigned_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setNewUserEmail(user.email);
                            setShowAddModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          + Add Role
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warning Box */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 text-xl">⚠️</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                Important Safety Notes
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• You cannot remove the last role from any user</li>
                <li>• You cannot remove the last system_admin role from the system</li>
                <li>• All role changes are logged in the audit trail</li>
                <li>• Changes take effect immediately</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Add Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Add Role to User</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Email
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter an existing or new user email
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Role --</option>
                {Object.entries(ROLE_NAMES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewUserEmail('');
                  setNewUserRole('');
                }}
                disabled={addingRole}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRole}
                disabled={!newUserEmail || !newUserRole || addingRole}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50"
              >
                {addingRole ? 'Adding...' : 'Add Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Server-side authentication and authorization check
export async function getServerSideProps(context) {
  const session = await getSession(context);

  // Check if user is authenticated
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  const userEmail = session.user.email;

  // Check if user is system admin
  const isSuperAdmin = await isSystemAdmin(userEmail);

  if (!isSuperAdmin) {
    // Return props that will render AccessDenied component
    return {
      props: {
        accessDenied: true,
        userEmail,
      },
    };
  }

  return {
    props: {
      userEmail,
    },
  };
}
