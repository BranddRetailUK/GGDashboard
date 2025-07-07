import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', creatorName: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('accessToken');

    if (email && token) {
      console.log('🔐 Valid session found, redirecting to /dashboard');
      navigate('/dashboard');
    } else {
      console.log('🛑 No valid session found');
    }
  }, [navigate]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const endpoint = `/api/${mode === 'login' ? 'login' : 'signup'}`;
      console.log('🔗 Auth endpoint:', endpoint);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      console.log('🧾 Backend response:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      if (data.accessToken) {
        // Login flow
        console.log('✅ LOGIN: Saving userEmail', data.email);
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('userTag', data.tag);
        console.log('🧪 Saved to localStorage:', localStorage.getItem('userEmail'));
        setMessage('✅ Login successful! Redirecting...');
        navigate('/dashboard');
        return;
      }

      if (data.customer) {
        // Signup flow: store email + tag, then auto-login to get token
        console.log('✅ SIGNUP: Saving userEmail', data.customer.email);
        localStorage.setItem('userEmail', data.customer.email);
        localStorage.setItem('userTag', data.customer.tag);
        console.log('🧪 Saved to localStorage:', localStorage.getItem('userEmail'));

        // Attempt auto-login to obtain accessToken
        try {
          const loginRes = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: form.email, password: form.password })
          });
          const loginData = await loginRes.json();
          if (loginRes.ok && loginData.accessToken) {
            console.log('🔑 Auto-login successful, saving accessToken');
            localStorage.setItem('accessToken', loginData.accessToken);
          } else {
            console.warn('⚠️ Auto-login failed:', loginData.error);
          }
        } catch (err) {
          console.error('❌ Auto-login error:', err);
        }

        setMessage('✅ Account created! Redirecting...');
        navigate('/dashboard');
        return;
      }

      console.warn('❌ Unexpected response from backend:', data);
      setMessage('⚠️ Unexpected response. Please try again.');
    } catch (err) {
      console.error('⚠️ Auth Error:', err.message);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: '1.5rem' }}>{mode === 'login' ? 'Log In' : 'Sign Up'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'signup' && (
            <>
              <input
                name="firstName"
                type="text"
                placeholder="First name"
                value={form.firstName}
                onChange={handleChange}
                required
                style={inputStyle}
              />
              <input
                name="creatorName"
                type="text"
                placeholder="Creator name (e.g. your brand or collection)"
                value={form.creatorName}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </>
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={submitButtonStyle}>
            {loading ? 'Processing...' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>
        {mode === 'login' ? (
          <p style={linkStyle}>
            Don’t have an account?{' '}
            <span onClick={() => setMode('signup')} style={underlinedLink}>Sign up</span>
          </p>
        ) : (
          <p style={linkStyle}>
            Already have an account?{' '}
            <span onClick={() => setMode('login')} style={underlinedLink}>Log in</span>
          </p>
        )}
        {message && <p style={{ color: message.startsWith('✅') ? 'green' : 'red', marginTop: '1rem' }}>{message}</p>}
      </div>
    </div>
  );
}

const pageStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  backgroundColor: '#111',
  color: '#fff'
};

const cardStyle = {
  backgroundColor: '#1c1c1c',
  padding: '2rem',
  borderRadius: '12px',
  boxShadow: '0 0 10px rgba(0,0,0,0.3)',
  width: '100%',
  maxWidth: '400px'
};

const inputStyle = {
  padding: '0.6rem',
  borderRadius: '6px',
  border: '1px solid #555',
  backgroundColor: '#222',
  color: '#fff'
};

const submitButtonStyle = {
  padding: '0.6rem',
  borderRadius: '6px',
  backgroundColor: '#bda527',
  color: '#000',
  border: 'none',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const linkStyle = {
  marginTop: '1.2rem',
  fontSize: '1rem',
  textAlign: 'center'
};

const underlinedLink = {
  textDecoration: 'underline',
  color: '#bda527',
  cursor: 'pointer',
  fontSize: '1.05rem',
  fontWeight: '500'
};
