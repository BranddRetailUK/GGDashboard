import React, { useEffect, useState } from 'react';
import { useTag } from '../context/TagContext'; // ✅ NEW

export default function Account() {
  const [sales, setSales] = useState([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [allTimeTotal, setAllTimeTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { tag: contextTag, loading: tagLoading } = useTag(); // ✅ NEW
  const customerTag = (contextTag || localStorage.getItem('userTag') || 'Thy Executioner').trim().toLowerCase(); // ✅ Preserve fallback

  useEffect(() => {
    if (!customerTag || tagLoading) return;

fetch(`/api/sales?tag=${encodeURIComponent(customerTag)}`)
          .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch sales');
        return res.json();
      })
      .then((data) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlySales = data.sales.flatMap(order =>
          order.items.filter(() => {
            const created = new Date(order.createdAt);
            return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
          })
        );

        const monthlyRevenue = monthlySales.reduce((sum, item) => sum + parseFloat(item.revenue), 0);
        const totalRevenue = data.sales.flatMap(order => order.items).reduce((sum, item) => sum + parseFloat(item.revenue), 0);

        setMonthlyTotal(monthlyRevenue.toFixed(2));
        setAllTimeTotal(totalRevenue.toFixed(2));
        setSales(data.sales || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Could not load your sales. Please try again later.');
        setLoading(false);
      });
  }, [customerTag, tagLoading]);

  return (
    <div style={{ padding: '2rem', background: '#111', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>My Sales</h1>

      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#bda527' }}>
        🪙 Earnings This Month: £{monthlyTotal}
      </div>
      <p style={{ fontSize: '1rem', color: '#ccc', marginBottom: '1.5rem' }}>
        📊 Total Revenue (All Time): £{allTimeTotal}
      </p>

      {loading && <p>Loading sales...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && sales.length === 0 && <p>No sales found for your products.</p>}

      {!loading && sales.map((order, index) => (
        <div key={index} style={{
          border: '1px solid #333',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.5rem',
          background: '#1c1c1c'
        }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Order: {order.orderNumber}</h2>
          {order.items.map((item, idx) => (
            <div key={idx} style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <img
                src={item.image || 'https://dummyimage.com/100x100/cccccc/000000&text=No+Image'}
                alt={item.title}
                width="100"
                height="100"
                style={{ borderRadius: '8px', objectFit: 'cover' }}
              />
              <div>
                <h3 style={{ margin: 0 }}>{item.title}</h3>
                {item.variantTitle && <p style={{ margin: '0.25rem 0' }}>Options: {item.variantTitle}</p>}
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Sold for: £{parseFloat(item.price).toFixed(2)}</strong>
                </p>
                <p style={{ margin: '0.25rem 0' }}>
                  Print Cost:{' '}
                  <span style={{ color: '#ccc' }}>
                    £{parseFloat(item.cost).toFixed(2)}
                  </span>
                </p>
                <p style={{ margin: '0.25rem 0' }}>
                  Revenue:{' '}
                  <strong style={{ color: '#4CAF50' }}>
                    £{parseFloat(item.revenue).toFixed(2)}
                  </strong>
                </p>
                <p style={{ margin: '0.25rem 0' }}>
                  Discounts Applied:{' '}
                  <span style={{ color: '#ccc' }}>
                    £{parseFloat(item.discount || 0).toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          ))}
          <p style={{ margin: '0.25rem 0' }}>
            Order Status:{' '}
            <span style={{
              color: order.status.toLowerCase() === 'fulfilled' ? '#4CAF50' : '#FFD700',
              fontWeight: 'bold'
            }}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}
