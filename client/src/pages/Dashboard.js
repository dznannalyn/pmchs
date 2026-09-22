import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Results from './Results';
import './Dashboard.css';

const BASE_URL = window.location.origin;

function Dashboard({ user, hideHeader = false, hideQuizzes = false }) {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsResults, setAnalyticsResults] = useState([]);
  const [fileHistory, setFileHistory] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Manage Links Modal
  const [linksModal, setLinksModal] = useState(null);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [linkCreating, setLinkCreating] = useState(false);
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (user) {
      fetchQuizzes();
      if (hideQuizzes) fetchAnalytics();
    }
  }, [user, hideQuizzes]);

  if (!user) {
    return (
      <div className="empty-state dashboard-login-state">
        <div className="empty-icon">🧑‍🏫</div>
        <h2>Teacher dashboard</h2>
        <p>Sign in to import Word exams, manage quizzes, and publish student links.</p>
        <Link to="/login" className="btn btn-primary">Teacher sign in</Link>
      </div>
    );
  }

  const fetchQuizzes = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'anonymous';
      const response = await axios.get('/api/quizzes', {
        headers: { 'user-id': userId }
      });
      setQuizzes(response.data.quizzes || []);
    } catch (err) {
      setError('Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const userId = localStorage.getItem('userId') || 'anonymous';
      const headers = { headers: { 'user-id': userId } };
      const [resultsResponse, historyResponse] = await Promise.all([
        axios.get('/api/quizzes/results/all', headers),
        axios.get('/api/import/history', headers)
      ]);
      setAnalyticsResults(resultsResponse.data.results || []);
      setFileHistory(historyResponse.data.history || []);
    } catch (err) {
      setError('Failed to fetch dashboard analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const getQuizAnalytics = quiz => {
    const attempts = analyticsResults.filter(result => String(result.quizId) === String(quiz.id));
    const passed = attempts.filter(result => result.totalQuestions > 0 && (result.score / result.totalQuestions) >= 0.5).length;
    return { passed, notPassed: attempts.length - passed, total: attempts.length };
  };

  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await axios.delete(`/api/quizzes/${quizId}`);
      setQuizzes(quizzes.filter(q => q.id !== quizId));
    } catch (err) {
      alert('Failed to delete quiz');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openLinksModal = (quiz) => {
    setLinksModal(quiz);
    setNewLinkLabel('');
    setLinkError('');
  };

  const handleCreateLink = async () => {
    if (!newLinkLabel.trim()) { setLinkError('Please enter a label.'); return; }
    setLinkCreating(true);
    setLinkError('');
    try {
      const res = await axios.post(`/api/quizzes/${linksModal.id}/cloned-links`, { label: newLinkLabel.trim() });
      const updatedQuizzes = quizzes.map(q =>
        q.id === linksModal.id
          ? { ...q, clonedLinks: [...(q.clonedLinks || []), { ...res.data.link, url: res.data.url }] }
          : q
      );
      setQuizzes(updatedQuizzes);
      setLinksModal(updatedQuizzes.find(q => q.id === linksModal.id));
      setNewLinkLabel('');
    } catch (err) {
      setLinkError('Failed to create link.');
    } finally {
      setLinkCreating(false);
    }
  };

  const handleDeleteLink = async (linkId) => {
    if (!window.confirm('Delete this cloned link?')) return;
    try {
      await axios.delete(`/api/quizzes/${linksModal.id}/cloned-links/${linkId}`);
      const updatedQuizzes = quizzes.map(q =>
        q.id === linksModal.id
          ? { ...q, clonedLinks: (q.clonedLinks || []).filter(l => l.linkId !== linkId) }
          : q
      );
      setQuizzes(updatedQuizzes);
      setLinksModal(updatedQuizzes.find(q => q.id === linksModal.id));
    } catch (err) {
      alert('Failed to delete link.');
    }
  };

  if (selectedQuiz) {
    return <Results quizTitle={selectedQuiz.title} quizId={selectedQuiz.id} onBack={() => setSelectedQuiz(null)} />;
  }

  return (
    <div className="dashboard-container">
      {!hideHeader && (
        <div className="dashboard-header">
          <div className="header-content">
            <h1 className="dashboard-main-title">TEACHER DASHBOARD</h1>
            <p className="header-subtitle">Create, edit, and manage your online quizzes</p>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {hideQuizzes && (
        <div className="dashboard-analytics">
          <section className="analytics-section">
            <div className="analytics-section-heading">
              <div>
                <h2>QUIZZES</h2>
              </div>
              <span className="analytics-caption">50% passing mark</span>
            </div>
            {analyticsLoading ? (
              <div className="analytics-loading">Loading analytics...</div>
            ) : quizzes.length === 0 ? (
              <div className="analytics-empty">No quizzes available yet.</div>
            ) : (
              <div className="analytics-quiz-grid">
                {quizzes.map(quiz => {
                  const analytics = getQuizAnalytics(quiz);
                  return (
                    <article className="analytics-quiz-card" key={quiz.id}>
                      <div className="analytics-quiz-summary">
                        <h3>{quiz.title}</h3>
                        <span>{analytics.total} student{analytics.total === 1 ? '' : 's'}</span>
                      </div>
                      <div className="analytics-result-list" aria-label={`Results for ${quiz.title}`}>
                        <span className="analytics-result passed">
                          <i aria-hidden="true"></i>
                          <strong>{analytics.passed}</strong>50% and above
                        </span>
                        <span className="analytics-result not-passed">
                          <i aria-hidden="true"></i>
                          <strong>{analytics.notPassed}</strong>Below 50%
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="analytics-section history-section">
            <div className="analytics-section-heading">
              <div>
                <p className="dashboard-kicker">ACTIVITY</p>
                <h2>CONVERTED FILE HISTORY</h2>
              </div>
            </div>
            {fileHistory.length === 0 ? (
              <div className="analytics-empty">No converted files yet.</div>
            ) : (
              <div className="file-history-list">
                {fileHistory.map(file => (
                  <div className="file-history-row" key={file.id}>
                    <span className="file-history-icon">DOC</span>
                    <div>
                      <strong>{file.filename}</strong>
                      <span>{file.detectedQuestions} questions detected</span>
                    </div>
                    <time dateTime={file.createdAt}>{new Date(file.createdAt).toLocaleDateString()}</time>
                    <span className="file-history-status">{file.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {hideQuizzes ? null : loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h2>No quizzes yet</h2>
          <p>Get started by importing a quiz from a Word document</p>
          <Link to="/import" className="btn btn-primary">Import Your First Quiz</Link>
        </div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="quiz-card">
              <div className="quiz-card-header">
                <h3 className="quiz-title">{quiz.title}</h3>
                {quiz.isPublished && <span className="published-badge">Published</span>}
              </div>

              <div className="quiz-meta">
                <span className="meta-item">📊 {quiz.questionsCount} questions</span>
                <span className="meta-item">📅 {new Date(quiz.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="quiz-actions">
                {quiz.isPublished && (
                  <button className="btn btn-sm btn-secondary" onClick={() => openLinksModal(quiz)}>
                    🔗 Links
                  </button>
                )}
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedQuiz({ id: quiz.id, title: quiz.title })}>
                  📊 Results
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(quiz.id)}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manage Links Modal */}
      {linksModal && (
        <div className="links-modal-overlay" onClick={() => setLinksModal(null)}>
          <div className="links-modal" onClick={e => e.stopPropagation()}>
            <div className="links-modal-header">
              <h2>🔗 Manage Quiz Links</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>{linksModal.title}</p>
              <button className="links-modal-close" onClick={() => setLinksModal(null)}>✕</button>
            </div>

            {/* Main link */}
            <div className="link-item link-item-main">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="link-title-main">{linksModal.title}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => navigate(`/quiz/${linksModal.id}/edit`)}
                  title="Edit Main Quiz"
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => copyToClipboard(`${BASE_URL}/quiz/${linksModal.id}`, 'main-' + linksModal.id)}
                >
                  {copiedId === 'main-' + linksModal.id ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    setLinksModal(null);
                    handleDelete(linksModal.id);
                  }}
                  title="Delete Main Quiz"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Cloned links list */}
            {(linksModal.clonedLinks || []).length > 0 && (
              <div className="cloned-links-list">
                {(linksModal.clonedLinks || []).map(link => (
                  <div key={link.linkId} className="link-item">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="link-title-clone">{link.label}</div>
                      {link.settings && <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold', marginLeft: '4px' }}>Custom Settings</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => navigate(`/quiz/${linksModal.id}/edit?linkId=${link.linkId}`)}
                        title="Edit Quiz & Settings for this Link"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => copyToClipboard(`${BASE_URL}/quiz/${linksModal.id}?linkId=${link.linkId}`, link.linkId)}
                      >
                        {copiedId === link.linkId ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteLink(link.linkId)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create new link */}
            <div className="new-link-form">
              <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#334155' }}>+ Create New Link</p>
              {linkError && <div className="alert alert-error" style={{ marginBottom: '8px', padding: '8px 12px', fontSize: '0.85rem' }}>{linkError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={newLinkLabel}
                  onChange={e => setNewLinkLabel(e.target.value)}
                  placeholder="e.g. BSIT 4C, Section A, Period 3"
                  onKeyDown={e => e.key === 'Enter' && handleCreateLink()}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleCreateLink}
                  disabled={linkCreating}
                >
                  {linkCreating ? '...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
