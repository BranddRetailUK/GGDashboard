import React, { useEffect } from 'react';
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Account from './Account';
import MyProducts from './MyProducts';
import Profile from './Profile';
import { useTag } from '../context/TagContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { loading, customer } = useTag();

  console.log("🚪 Entered Dashboard component");

  useEffect(() => {
    console.log("🧩 Dashboard useEffect fired", { loading, customer });

    if (loading) return;

    if (!customer) {
      console.warn("🚫 No customer — redirecting");
      navigate('/auth');
    } else {
      console.log("✅ Customer in context:", customer);
    }
  }, [loading, customer, navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/auth');
  };

  const userLabel =
    customer?.tag ||
    customer?.email ||
    localStorage.getItem('userTag') ||
    localStorage.getItem('userEmail') ||
    'User';

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff', background: '#000', minHeight: '100vh' }}>
        <h2>⏳ Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff' }}>
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        backgroundColor: '#1c1c1c',
        borderBottom: '1px solid #333',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[
            { path: 'home',     label: 'Home' },
            { path: 'products', label: 'Products' },
            { path: 'sales',    label: 'Sales' },
            { path: 'profile',  label: 'Profile' },
          ].map(({ path, label }) => (
            <NavLink
              key={path}
              to={path === 'home' ? '/dashboard' : `/dashboard/${path}`}
              style={({ isActive }) => ({
                background:    isActive ? '#bda527' : 'transparent',
                color:         isActive ? '#000'    : '#fff',
                padding:       '0.5rem 1rem',
                borderRadius:  '8px',
                fontWeight:    'bold',
                cursor:        'pointer',
                textDecoration:'none'
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 'bold', color: '#bda527' }}>
            {userLabel}
          </span>
          <button onClick={handleLogout} style={{
            background:    '#bda527',
            color:         '#000',
            padding:       '0.5rem 1rem',
            border:        'none',
            borderRadius:  '8px',
            fontWeight:    'bold',
            cursor:        'pointer'
          }}>
            Log Out
          </button>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={
          <div style={{ padding: '2rem', color: '#fff' }}>
            <h1>🏠 Welcome to your Dashboard</h1>
            <p>Select a tab to manage your sales, products, or profile.</p>
          </div>
        } />
        <Route path="products" element={<MyProducts />} />
        <Route path="sales"    element={<Account />} />
        <Route path="profile"  element={<Profile />} />
        <Route path="*"        element={<Navigate to="/dashboard" />} />
      </Routes>
    </div>
  );
}
