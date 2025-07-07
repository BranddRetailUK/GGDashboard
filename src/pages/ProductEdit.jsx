import React from 'react';
import { useParams } from 'react-router-dom';

export default function ProductEdit() {
  const { productId } = useParams();

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h1>Edit Product</h1>
      <p>Product ID: <strong>{productId}</strong></p>
      <p>This page is a placeholder for editing product details.</p>
      {/* TODO: Implement product edit form */}
    </div>
  );
}
