import { Routes, Route, Link, Navigate } from 'react-router-dom';
import AuthProvider, { AuthContext } from './context/AuthContext.jsx';
import CartProvider from './context/CartContext.jsx';
import Home from './pages/Home.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import ProductReviews from './pages/ProductReviews.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Admin2Dashboard from './pages/Admin2Dashboard.jsx';
import VendorDashboard from './pages/VendorDashboard.jsx';
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx';
import Layout from './components/Layout.jsx';
import { useContext } from 'react';

function normalizeRole(v) {
  const cur = String(v ?? '').trim().toLowerCase();
  if (cur === 'administrator' || cur === 'admin1' || cur === 'admin  ') return 'admin';
  return cur;
}

function AdminRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user.role);
  if (role !== 'admin' && role !== 'super_admin') return <Navigate to="/" replace />;
  return children;
}

function VendorRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user.role);
  if (role !== 'vendor' && role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user.role);
  if (role !== 'super_admin') return <Navigate to="/" replace />;
  return children;
}

function Admin2Route({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user.role);
  if (role !== 'admin2' && role !== 'super_admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/product/:id/reviews" element={<ProductReviews />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin2" element={<Admin2Route><Admin2Dashboard /></Admin2Route>} />
            <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
            <Route path="/vendor" element={<VendorRoute><VendorDashboard /></VendorRoute>} />
          </Routes>
        </Layout>
      </CartProvider>
    </AuthProvider>
  );
}
