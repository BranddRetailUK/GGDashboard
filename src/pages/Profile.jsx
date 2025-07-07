import React from 'react';
import { useTag } from '../context/TagContext'; // ✅ NEW: use tag context

export default function Profile() {
  const { customer, loading, tag } = useTag(); // ✅ get from context

  if (loading) return <div style={{ padding: '2rem', color: '#fff' }}>Loading profile...</div>;

  if (!customer) return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h2>⚠️ No customer data found.</h2>
    </div>
  );

  const addr = customer.address || {};
  const fullAddress = [
    addr.address1,
    addr.city,
    addr.province,
    addr.zip,
    addr.country
  ].filter(Boolean).join(', ');

  const createdDate = new Date(customer.createdAt).toLocaleDateString();

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h1 className="text-2xl font-bold mb-4">👤 Customer Profile</h1>
      <div style={{ lineHeight: '1.8' }}>
        <p><strong>Name:</strong> {customer.name}</p>
        <p><strong>Company:</strong> {customer.company || 'N/A'}</p>
        <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
        <p><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
        <p><strong>Address:</strong> {fullAddress || 'N/A'}</p>
        <p><strong>Total Orders:</strong> {customer.ordersCount}</p>
        <p><strong>Total Spent:</strong> £{parseFloat(customer.totalSpent).toFixed(2)}</p>
        <p><strong>Member Since:</strong> {createdDate}</p>
        <p><strong>Marketing:</strong> 
          <span> Email: {customer.marketing?.email ? '✅ Subscribed' : '❌ Not Subscribed'}</span>, 
          <span> SMS: {customer.marketing?.sms ? '✅ Subscribed' : '❌ Not Subscribed'}</span>
        </p>
        <p><strong>Tag:</strong> {tag}</p>
      </div>
    </div>
  );
}
