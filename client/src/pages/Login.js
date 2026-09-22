import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

function Login({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from || '/';

  const fillDemoCredentials = () => {
    setMode('login');
    setForm({ name: '', email: 'demo.teacher@example.com', password: 'DemoQuiz123!' });
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/api/users/login' : '/api/users/register';
      const response = await axios.post(endpoint, form);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('userId', user.id);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to access your teacher account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-brand">QUIZ IMPORTER</div>
        <h1>{mode === 'login' ? 'Teacher sign in' : 'Create teacher account'}</h1>
        <p className="login-subtitle">Manage your quizzes and import Word exams from one dashboard.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="teacher-name">Name</label>
              <input id="teacher-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="teacher-email">Email</label>
            <input id="teacher-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </div>
          <div className="form-group">
            <label htmlFor="teacher-password">Password</label>
            <input id="teacher-password" type="password" minLength="6" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </div>
          <button className="btn btn-primary login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button className="login-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New teacher? Create an account' : 'Already have an account? Sign in'}
        </button>
        {mode === 'login' && (
          <button className="demo-button" type="button" onClick={fillDemoCredentials}>
            Use demo teacher credentials
          </button>
        )}
      </section>
    </div>
  );
}

export default Login;
