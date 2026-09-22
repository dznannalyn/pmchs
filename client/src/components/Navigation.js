import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

function Navigation({ user, setUser }) {
  const location = useLocation();
  const isStudentPage = location.pathname.startsWith('/quiz/');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {isStudentPage ? (
          <div className="navbar-logo" style={{ cursor: 'default', pointerEvents: 'none' }}>
            <img src="/images/school-logo.png" alt="School Logo" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }} />
            <span>PMCHS Toolkit</span>
          </div>
        ) : (
          <Link to="/" className="navbar-logo">
            <img src="/images/school-logo.png" alt="School Logo" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }} />
            <span>PMCHS Toolkit</span>
          </Link>
        )}
        <ul className="nav-menu">
          {user && (
            <li className="nav-item">
              <span className="user-email">{user.email}</span>
              <button className="nav-link logout-btn" onClick={handleLogout}>Logout</button>
            </li>
          )}
          {!user && !isStudentPage && (
            <li className="nav-item">
              <Link to="/login" className="nav-link btn-primary-nav">Teacher sign in</Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navigation;
