import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Results.css';

function Results({ quizTitle, quizId, onBack }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [matchedResults, setMatchedResults] = useState([]);
  const [selectedResultIds, setSelectedResultIds] = useState([]);
  const [selectedLink, setSelectedLink] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchResults();
  }, []);

  useEffect(() => {
    if (results.length > 0 && !selectedLink) {
      const quizResults = results.filter(r => r.quizTitle === quizTitle);
      const firstLink = Array.from(new Map(
        quizResults.map((result) => {
const value = result.linkId || result.linkLabel || defaultLinkLabel;
      const label = result.linkLabel || defaultLinkLabel;
          return [value, label];
        })
      ).keys())[0];

      if (firstLink) {
        setSelectedLink(firstLink);
      }
    }
  }, [results, quizTitle, selectedLink]);

  const fetchResults = async () => {
    try {
      const userId = localStorage.getItem('userId') || 'anonymous';
      const response = await axios.get('/api/quizzes/results/all', {
        headers: { 'user-id': userId }
      });
      setResults(response.data.results || []);
    } catch (err) {
      setError('Failed to load results.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // All results for this quiz
  const defaultLinkLabel = quizTitle || 'Main';
  const quizResults = results.filter(r => r.quizTitle === quizTitle);
  const linkOptions = Array.from(new Map(
    quizResults.map((result) => {
      const value = result.linkId || result.linkLabel || defaultLinkLabel;
      const label = result.linkLabel || defaultLinkLabel;
      return [value, label];
    })
  )).map(([value, label]) => ({ value, label }));

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredResults = quizResults.filter((result) => {
    const matchLink = !selectedLink || selectedLink === 'all'
      ? true
      : (result.linkId || result.linkLabel || defaultLinkLabel) === selectedLink;

    if (!normalizedSearch) return matchLink;

    const searchableText = [
      result.studentName,
      result.linkLabel,
      result.linkId,
      result.quizTitle,
      result.score,
      result.totalQuestions,
      new Date(result.submittedAt).toLocaleDateString(),
      new Date(result.submittedAt).toLocaleTimeString()
    ].filter(Boolean).join(' ').toLowerCase();

    return matchLink && searchableText.includes(normalizedSearch);
  });

  const allLinkSearchResults = normalizedSearch
    ? quizResults.filter((result) => {
        const searchableText = [
          result.studentName,
          result.linkLabel,
          result.linkId,
          result.quizTitle,
          result.score,
          result.totalQuestions,
          new Date(result.submittedAt).toLocaleDateString(),
          new Date(result.submittedAt).toLocaleTimeString()
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
    : filteredResults;

  const visibleResults = normalizedSearch ? allLinkSearchResults : filteredResults;
  const selectedResults = visibleResults.filter(r => selectedResultIds.includes(r.id));

  // Get the selected link's label for the title
  const selectedLinkLabel = selectedLink
    ? linkOptions.find(link => link.value === selectedLink)?.label || defaultLinkLabel
    : linkOptions.length > 0
    ? linkOptions[0]?.label || defaultLinkLabel
    : defaultLinkLabel;

  // Calculate max question count for item analysis
  const maxQuestions = filteredResults.reduce((max, r) => Math.max(max, r.totalQuestions || 0), 0);

  const toggleResultSelection = (resultId) => {
    setSelectedResultIds((current) =>
      current.includes(resultId)
        ? current.filter((id) => id !== resultId)
        : [...current, resultId]
    );
  };

  const toggleSelectAll = () => {
    const allSelected = visibleResults.length > 0 && visibleResults.every((result) => selectedResultIds.includes(result.id));

    if (allSelected) {
      setSelectedResultIds((current) => current.filter((id) => !visibleResults.some((result) => result.id === id)));
      return;
    }

    setSelectedResultIds((current) => {
      const next = new Set(current);
      visibleResults.forEach((result) => next.add(result.id));
      return [...next];
    });
  };

  const exportToCSV = (rows = filteredResults, fileNamePrefix = 'Results') => {
    if (!rows || rows.length === 0) return;

    const qHeaders = Array.from({ length: Math.max(...rows.map(r => r.totalQuestions || 0), 0) }, (_, i) => `Q${i + 1}`);
    const headers = ['Student Name', 'Link', 'Score', 'Total Questions', 'Percentage (%)', ...qHeaders, 'Date Submitted'];
    const csvRows = [headers.join(',')];

    rows.forEach(r => {
      const percentage = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
      const date = new Date(r.submittedAt).toLocaleString().replace(/,/g, '');
      const linkName = r.linkLabel || defaultLinkLabel;

      const qStatuses = Array.from({ length: Math.max(r.totalQuestions || 0, 0) }, (_, i) => {
        const qRes = r.questionResults?.[i];
        if (!qRes) return 'N/A';
        return qRes.isCorrect ? 'RIGHT' : 'WRONG';
      });

      csvRows.push([
        `"${r.studentName}"`,
        `"${linkName}"`,
        r.score,
        r.totalQuestions,
        percentage,
        ...qStatuses,
        `"${date}"`
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quizTitle.replace(/\s+/g, '_')}_${fileNamePrefix}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkDelete = async () => {
    if (selectedResults.length === 0) return;
    const confirmed = window.confirm(`Delete ${selectedResults.length} selected result${selectedResults.length > 1 ? 's' : ''}?`);
    if (!confirmed) return;

    try {
      const userId = localStorage.getItem('userId') || 'anonymous';
      await axios.delete('/api/quizzes/results/bulk', {
        headers: { 'user-id': userId },
        data: { resultIds: selectedResults.map((result) => result.id) }
      });

      setResults((current) => current.filter((result) => !selectedResultIds.includes(result.id)));
      setSelectedResultIds([]);
    } catch (err) {
      console.error(err);
      setError('Failed to delete selected results.');
    }
  };

  const handleDetectSimilar = async (result) => {
    setDetecting(true);
    setModalOpen(false);

    try {
      const userId = localStorage.getItem('userId') || 'anonymous';
      const response = await axios.post('/api/quizzes/results/detect-similar', {
        resultId: result.id,
        quizId: result.quizId || quizId
      }, {
        headers: { 'user-id': userId }
      });

      setMatchedResults(response.data.matches || []);
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      setError('Failed to investigate matching attempts.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="results-page" style={{ padding: 0 }}>
      <div className="page-heading">
        <div style={{ flex: 1 }}>
          <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '15px' }}>← Back to Quizzes</button>
          <p className="eyebrow">TEACHER WORKSPACE</p>
          <h1>Results: {selectedLinkLabel}</h1>
          <p>Track student performance & horizontal question tally for this quiz.</p>
        </div>
        {visibleResults.length > 0 && (
          <button className="btn btn-success" onClick={() => exportToCSV(visibleResults, 'Results')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⬇️</span> Export CSV (With Item Tally)
          </button>
        )}
      </div>

      {detecting && (
        <div className="detecting-overlay">
          <div className="detecting-panel card">
            <div className="spinner"></div>
            <h3>Investigating possible related attempts…</h3>
            <p>Checking device, browser, and time-based matches for this result.</p>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">MATCHED RESULTS</p>
                <h2>Possible related submissions</h2>
              </div>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Close</button>
            </div>

            {matchedResults.length === 0 ? (
              <div className="modal-empty">
                <p>No closely matched attempts were found for this submission.</p>
              </div>
            ) : (
              <div className="matched-results-list">
                {matchedResults.map((match) => (
                  <div key={match.id} className="matched-result-item">
                    <div className="matched-result-top">
                      <strong>{match.studentName}</strong>
                      <span className="match-score">{match.similarityScore}%</span>
                    </div>
                    <div className="matched-result-meta">
                      <span>{match.score} / {match.totalQuestions}</span>
                      <span>{new Date(match.submittedAt).toLocaleString()}</span>
                    </div>
                    {match.matchedFields?.length > 0 && (
                      <div className="match-tags">
                        {match.matchedFields.map((field) => (
                          <span key={field} className="match-tag">{field}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading results...</p>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : quizResults.length === 0 ? (
        <section className="results-empty card">
          <div className="results-icon">📊</div>
          <h2>No results yet</h2>
          <p>Share the student link to start collecting results.</p>
        </section>
      ) : (
        <div className="results-table-shell">
          <div className="results-toolbar">
            <div className="results-search-wrap">
              <span className="results-search-label">Search</span>
              <input
                type="text"
                className="results-search-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search student name or link..."
                aria-label="Search results"
              />
            </div>

            <div className="link-filter-bar">
              <span className="link-filter-label">Filter by link</span>
              <div className="link-filter-tabs">
                {linkOptions.map((link) => (
                  <button
                    key={link.value}
                    type="button"
                    className={`link-filter-tab ${selectedLink === link.value ? 'active' : ''}`}
                    onClick={() => setSelectedLink(link.value)}
                  >
                    {link.label}
                    <span className="link-filter-count">
                      {quizResults.filter((result) => (result.linkId || result.linkLabel || defaultLinkLabel) === link.value).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="results-table-container card" style={{ marginTop: '20px' }}>
            <table className="results-table">
              <thead>
                <tr>
                  <th className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={visibleResults.length > 0 && visibleResults.every((result) => selectedResultIds.includes(result.id))}
                      onChange={toggleSelectAll}
                      aria-label="Select all results"
                    />
                  </th>
                  <th>Student Name</th>
                  <th>Score</th>
                  <th>Question Breakdown</th>
                  <th>Date Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>No results yet.</td>
                  </tr>
                ) : (
                  visibleResults.map((result) => {
                    const percentage = result.totalQuestions > 0
                      ? Math.round((result.score / result.totalQuestions) * 100)
                      : 0;

                    return (
                      <tr key={result.id}>
                        <td className="checkbox-column">
                          <input
                            type="checkbox"
                            checked={selectedResultIds.includes(result.id)}
                            onChange={() => toggleResultSelection(result.id)}
                            aria-label={`Select ${result.studentName}`}
                          />
                        </td>
                        <td className="fw-bold">
                          <div className="student-name-cell">
                            <span>{result.studentName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="score-badge">
                            {result.score} / {result.totalQuestions}
                          </span>
                        </td>
                        <td>
                          <div className="horizontal-student-tally-row">
                            {Array.from({ length: result.totalQuestions || 0 }, (_, i) => {
                              const qRes = result.questionResults?.[i];
                              const isCorrect = qRes ? qRes.isCorrect : null;
                              return (
                                <span
                                  key={i}
                                  className={`student-q-pill ${isCorrect === true ? 'pill-right' : isCorrect === false ? 'pill-wrong' : 'pill-unknown'}`}
                                  title={`Q${i + 1}: ${isCorrect === true ? 'Correct' : isCorrect === false ? 'Incorrect' : 'No answer key'}`}
                                >
                                  {isCorrect === true ? '✓' : isCorrect === false ? '✕' : '?'}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="text-muted">
                          {new Date(result.submittedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedResults.length > 0 && (
            <div className="bulk-actions-box card">
              <div className="bulk-actions-info">
                <strong>{selectedResults.length}</strong> result{selectedResults.length > 1 ? 's' : ''} selected
              </div>
              <div className="bulk-actions-controls">
                <button className="btn btn-danger" onClick={handleBulkDelete}>Delete Selected</button>
                <button className="btn btn-success" onClick={() => exportToCSV(selectedResults, 'Selected_Results')}>
                  Export Selected
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>

  );
}

export default Results;
