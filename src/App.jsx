import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ProductEdit from './pages/ProductEdit';
import AuthPage from './pages/Auth';

export default function App() {
  console.log("📦 App loaded");
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth" />} />
      <Route path="/dashboard/*" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/products/edit/:productId" element={<ProductEdit />} />
      <Route path="/auth" element={<AuthPage />} />
    </Routes>
  );
}