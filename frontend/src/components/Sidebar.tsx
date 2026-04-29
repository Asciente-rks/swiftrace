import React from "react";

type SidebarProps = {
  role: string | null;
  currentView: string;
  setCurrentView: (view: string) => void;
};

const Sidebar = ({ role, currentView, setCurrentView }: SidebarProps) => {
  const menuItems = [
    { key: 'track', label: 'Track Item', roles: ['customer', 'shipper', 'admin'] },
  ];

  if (role === 'customer') {
    menuItems.push({ key: 'order', label: 'Place Order', roles: ['customer'] });
  } else if (role === 'shipper') {
    menuItems.push(
      { key: 'update', label: 'Update Shipment', roles: ['shipper'] },
      { key: 'shipments', label: 'View Shipments', roles: ['shipper'] }
    );
  } else if (role === 'admin') {
    menuItems.push(
      { key: 'createUser', label: 'Create User', roles: ['admin'] },
      { key: 'users', label: 'Manage Users', roles: ['admin'] },
      { key: 'shipments', label: 'Manage Shipments', roles: ['admin'] }
    );
  }

  return (
    <aside className="sidebar">
      <nav>
        <ul>
          {menuItems.map(item => (
            <li key={item.key}>
              <button
                className={currentView === item.key ? 'active' : ''}
                onClick={() => setCurrentView(item.key)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;