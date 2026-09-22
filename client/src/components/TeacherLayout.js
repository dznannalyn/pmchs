import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './TeacherLayout.css';

function TeacherLayout() {
  return (
    <div className="teacher-layout">
      <aside className="teacher-sidebar">
        <div className="sidebar-logo-wrap">
          <img src="/images/school-logo.png" alt="School Logo" className="sidebar-logo" />
          <span className="sidebar-school-name">Porac Model Community High School</span>
        </div>
        <div className="sidebar-label">TEACHER MENU</div>
        <nav className="sidebar-nav" aria-label="Teacher navigation">
          <NavLink to="/" end className="sidebar-link"><span>⌂</span>Dashboard</NavLink>
          <NavLink to="/import" className="sidebar-link"><span>＋</span>Make quiz</NavLink>
          <NavLink to="/converter" end className="sidebar-link"><span>⇄</span>File converter</NavLink>
        </nav>
      </aside>
      <section className="teacher-content">
        <Outlet />
      </section>
    </div>
  );
}

export default TeacherLayout;
