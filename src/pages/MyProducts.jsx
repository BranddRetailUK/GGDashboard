import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTag } from '../context/TagContext';

export default function MyProducts() {
  console.log("🚀 MyProducts component mounted");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);

  const { tag: contextTag, loading: tagLoading } = useTag();

  // Set tag from context or fallback
  useEffect(() => {
    const normalizedContextTag = contextTag?.trim();
    if (normalizedContextTag && normalizedContextTag !== 'undefined') {
      console.log('📦 Setting tag from context:', normalizedContextTag);
      setTag(normalizedContextTag);
    } else {
      const stored = localStorage.getItem('tag')?.trim();
      if (stored && stored !== 'undefined') {
        console.log('📦 Setting tag from localStorage:', stored);
        setTag(stored);
      } else {
        console.log('📦 Using fallback tag: Thy Executioner');
        setTag('Thy Executioner');
      }
    }
  }, [contextTag]);

  // Fetch products when tag is available
  useEffect(() => {
    if (!tag || tag === 'undefined' || tagLoading) {
      console.warn('🚫 Skipping fetch: invalid or loading tag:', tag);
      return;
    }

    const fetchProducts = async () => {
      try {
        console.log('🌐 Fetching products for tag:', tag);
        const res = await axios.get(`/api/products?tag=${encodeURIComponent(tag)}`);

        console.log('✅ Raw response:', res);
        console.log('✅ res.data:', res.data);
        setRawResponse(res.data);

        const productsArray = Array.isArray(res.data.products) ? res.data.products : [];
        console.log('📦 Parsed products array:', productsArray);

        setProducts(productsArray);
      } catch (err) {
        console.error('❌ Failed to fetch products from backend:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [tag, tagLoading]);

  console.log('🔍 Current tag:', tag);
  console.log('🔍 Products in render:', products);

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h1>🛍️ My Products</h1>

      {loading ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p style={{ color: '#ccc' }}>No products found.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                background: '#1c1c1c',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #333',
              }}
            >
              {p.image && (
                <img
                  src={p.image}
                  alt={p.title}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    marginBottom: '0.5rem',
                  }}
                />
              )}
              <h3 style={{ margin: '0.5rem 0' }}>{p.title}</h3>
              <p style={{ color: '#ccc' }}>
                Price: £{parseFloat(p.price).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Debug JSON block */}
      <div style={{ marginTop: '2rem' }}>
        <h4>🛠️ Raw Backend Response (res.data)</h4>
        <pre style={{ color: '#ccc', background: '#111', padding: '1rem', borderRadius: '8px', overflowX: 'auto' }}>
          {JSON.stringify(rawResponse, null, 2)}
        </pre>
      </div>
    </div>
  );
}
