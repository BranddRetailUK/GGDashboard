import React from 'react';

export default function Header() {
  return (
    <header style={{
      backgroundColor: '#1c1c1c',
      color: '#fff',
      padding: '1rem 2rem',
      borderBottom: '1px solid #333',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img
          src="/gg-logo.png"
          alt="GG Apparel Logo"
          style={{ height: '40px', objectFit: 'contain' }}
        />
        <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
          Dashboard
        </span>
      </div>
      <nav style={{ display: 'flex', gap: '2rem' }}>
        <a href="/" style={linkStyle}>Dashboard</a>
        <a href="/account" style={linkStyle}>My Sales</a>
        <a href="/logout" style={linkStyle}>Logout</a>
      </nav>
    </header>
  );
}

const linkStyle = {
  color: '#fff',
  textDecoration: 'none',
  fontSize: '1rem',
  transition: 'opacity 0.2s',
  opacity: 0.9
};
