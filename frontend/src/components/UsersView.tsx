import { useState, useEffect } from "react";

type UsersViewProps = {
  runRequest: (path: string, options: RequestInit, label: string) => Promise<unknown>;
};

const UsersView = ({ runRequest }: UsersViewProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState('admin');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      const path = `/users?role=${roleFilter}`;
      const data = await runRequest(path, { method: 'GET' }, 'Get users');
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { data?: unknown } | null)?.data)
          ? ((data as { data: any[] }).data)
          : [];
      setUsers(list);
      setIsLoading(false);
    };
    loadUsers();
  }, [roleFilter, runRequest]);

  return (
    <section className="users-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin tools</p>
          <h2>Manage Users</h2>
        </div>
        <label className="field field-inline">
          Filter by role
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="customer">Customers</option>
          <option value="shipper">Shippers</option>
          <option value="admin">Admins</option>
        </select>
        </label>
      </div>
      {isLoading ? (
        <p className="empty-state">Loading users...</p>
      ) : users.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.user_id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.verification_status}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No users found.</p>
      )}
    </section>
  );
};

export default UsersView;