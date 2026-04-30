import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import "./UsersView.css";

type User = {
  user_id: string;
  name: string;
  email: string;
  role: "customer" | "shipper" | "admin";
  verification_status: "pending" | "verified" | "rejected";
  createdAt: string;
};

type UsersViewProps = {
  runRequest: (
    path: string,
    options: RequestInit,
    label: string,
  ) => Promise<unknown>;
};

const UsersView = ({ runRequest }: UsersViewProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "customer",
    verification_status: "pending",
  });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      verification_status: user.verification_status,
    });
    setShowEditForm(true);
  };

  const handleUpdateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) return;
    const data = await runRequest(
      `/users/${selectedUser.user_id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      },
      "Update user",
    );
    if (data) {
      setShowEditForm(false);
      setSelectedUser(null);
      // Refresh user list
      const path = `/users?role=${roleFilter}`;
      const userList = await runRequest(path, { method: "GET" }, "Get users");
      const list = Array.isArray(userList)
        ? userList
        : Array.isArray((userList as { data?: unknown })?.data)
          ? (userList as { data: User[] }).data
          : [];
      setUsers(list);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user ${user.email}? This action cannot be undone.`))
      return;

    await runRequest(
      `/users/${user.user_id}`,
      { method: "DELETE" },
      "Delete user",
    );
    // Refresh user list
    const path = `/users?role=${roleFilter}`;
    const userList = await runRequest(path, { method: "GET" }, "Get users");
    const list = Array.isArray(userList)
      ? userList
      : Array.isArray((userList as { data?: unknown })?.data)
        ? (userList as { data: User[] }).data
        : [];
    setUsers(list);
  };

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      const path = `/users?role=${roleFilter}`;
      const data: unknown = await runRequest(
        path,
        { method: "GET" },
        "Get users",
      );
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { data?: unknown })?.data)
          ? (data as { data: User[] }).data
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
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="customer">Customers</option>
            <option value="shipper">Shippers</option>
            <option value="admin">Admins</option>
          </select>
        </label>
      </div>
      {isLoading ? (
        <p className="empty-state">Loading users...</p>
      ) : users.length > 0 ? (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: User) => (
                <tr key={user.user_id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.verification_status}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(user)}
                      title="Edit user"
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(user)}
                      title="Delete user"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {showEditForm && selectedUser && (
            <div className="edit-form">
              <h3>Edit User</h3>
              <form onSubmit={handleUpdateSubmit}>
                <label>
                  Name
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Role
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value })
                    }
                  >
                    <option value="customer">Customer</option>
                    <option value="shipper">Shipper</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={editForm.verification_status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        verification_status: e.target.value,
                      })
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn-save">
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowEditForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <p className="empty-state">No users found.</p>
      )}
    </section>
  );
};

export default UsersView;
