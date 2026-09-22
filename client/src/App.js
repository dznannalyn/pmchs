import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Components
import Dashboard from './pages/Dashboard';
import DocxUpload from './pages/DocxUpload';
import ImportPreview from './pages/ImportPreview';
import QuizEditor from './pages/QuizEditor';
import QuizPreview from './pages/QuizPreview';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import Results from './pages/Results';
import TakeQuiz from './pages/TakeQuiz';
import FileConverter from './pages/FileConverter';
import TeacherLayout from './components/TeacherLayout';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  return (
    <Router>
      <div className="App">
        <Navigation user={user} setUser={setUser} />
        <main className="main-content">
          <Routes>
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/quiz/:quizId/take" element={<TakeQuiz />} />
            <Route path="/quiz/:quizId" element={<TakeQuiz />} />
            <Route element={user ? <TeacherLayout /> : <Navigate to="/login" replace />}>
              <Route path="/" element={<Dashboard user={user} hideQuizzes />} />
              <Route path="/import" element={<DocxUpload user={user} />} />
              <Route path="/results" element={<Results user={user} />} />
              <Route path="/converter" element={<FileConverter user={user} />} />
              <Route path="/converter/:conversion" element={<FileConverter user={user} />} />
              <Route path="/import-preview" element={<ImportPreview user={user} />} />
              <Route path="/quiz/:quizId/edit" element={<QuizEditor user={user} />} />
              <Route path="/quiz/:quizId/preview" element={<QuizPreview user={user} />} />
            </Route>
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
