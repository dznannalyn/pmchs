import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ImportPreview.css';

function ImportPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const importData = location.state;
  const [title, setTitle] = useState(importData?.filename?.replace(/\.docx$/i, '') || 'Imported Quiz');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [publishedQuizId, setPublishedQuizId] = useState('');
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [answers, setAnswers] = useState(() => (
    importData?.questions?.map(() => '') || []
  ));
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const [settings, setSettings] = useState({
    pagination: 'all', // 'all' | 'one'
    randomizeQuestions: false,
    allowBlankAnswers: true,
    negativeMarking: false,
    resultsDisplay: {
      score: true,
      testOutline: false,
      correctIncorrect: true,
      correctAnswer: true,
      explanation: false
    },
    accessControl: {
      accessType: 'anyone', // 'anyone' | 'passcode' | 'identifier_list' | 'email_list'
      passcode: '',
      identifierList: '',
      emailList: '',
      timeLimitType: 'unlimited', // 'unlimited' | 'timed'
      timeLimitMinutes: 30,
      attemptsType: 'unlimited', // 'unlimited' | 'limited'
      maxAttempts: 1,
      identifierPrompt: 'Enter your name'
    }
  });

  if (!importData) {
    return (
      <section className="card">
        <h1>Import preview unavailable</h1>
        <p>Upload a DOCX file to generate a preview.</p>
        <button className="btn btn-primary" onClick={() => navigate('/import')}>Start import</button>
      </section>
    );
  }

  const createQuiz = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await axios.post('/api/import/create-quiz', {
        importId: importData.importId,
        quizTitle: title.trim() || 'Imported Quiz',
        userId: localStorage.getItem('userId') || 'anonymous',
        isPublished: true,
        settings
      });
      setPublishedQuizId(response.data.quizId);
      setIsPublished(true);
      showToast('✓ Quiz saved & published!');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not create the quiz.');
    } finally {
      setSaving(false);
    }
  };

  const updateAnswer = async (index, value) => {
    const question = importData.questions[index];
    const numOptions = question.options?.length || 4;
    const maxLetter = String.fromCharCode(64 + numOptions);
    const regex = new RegExp(`[^A-${maxLetter}]`, 'g');
    const answer = value.toUpperCase().replace(regex, '').slice(0, 1);

    const nextAnswers = [...answers];
    nextAnswers[index] = answer;
    setAnswers(nextAnswers);

    if (!answer || !question) return;

    if (index < importData.questions.length - 1) {
      setTimeout(() => {
        document.getElementById(`answer-letter-${index + 1}`)?.focus();
      }, 0);
    }

    try {
      await axios.post('/api/import/update-question', {
        importId: importData.importId,
        questionNumber: question.sourceNumber,
        updates: {
          correctAnswer: answer,
          correctAnswers: [answer],
          metadata: { ...(question.metadata || {}), needsReview: false }
        }
      });
      question.correctAnswer = answer;
      question.correctAnswers = [answer];
      question.needsReview = false;
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not save this answer.');
    }
  };

  const resetAnswers = () => {
    if (window.confirm('Are you sure you want to reset all answers?')) {
      setAnswers(importData?.questions?.map(() => '') || []);
    }
  };

  const answeredCount = answers.filter(Boolean).length;

  if (isPublished) {
    return (
      <section className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h1 style={{ color: '#166534', marginBottom: '15px' }}>Quiz Published Successfully!</h1>
        <p>Your quiz has been published. Share the link below with your students so they can take it.</p>
        
        <div style={{ margin: '30px auto', padding: '15px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', maxWidth: '600px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#475569' }}>Student Shareable Link:</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
            <a 
              href={`http://localhost:3000/quiz/${publishedQuizId}/take`} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ wordBreak: 'break-all', color: '#2563eb', fontSize: '18px', textAlign: 'left' }}
            >
              http://localhost:3000/quiz/{publishedQuizId}/take
            </a>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                navigator.clipboard.writeText(`http://localhost:3000/quiz/${publishedQuizId}/take`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{ flexShrink: 0 }}
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate('/')}>
          Back to Home
        </button>
      </section>
    );
  }

  return (
    <div className="quiz-preview-container">
      <div className="preview-header">
        <button className="btn btn-secondary" onClick={() => navigate('/import')}>← Back</button>
        <h1>Review Import</h1>
        <span className="confidence-badge">{importData.totalDetected} questions detected</span>
      </div>

      {/* Split layout */}
      <div className="preview-split-layout">

        {/* LEFT: Settings panel */}
        <aside className="preview-settings-panel">
          
          {/* General & Title */}
          <div className="settings-section">
            <p className="settings-label">QUIZ SETTINGS</p>

            <div className="settings-field">
              <label htmlFor="quiz-title">Title</label>
              <input
                id="quiz-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter quiz title..."
              />
            </div>

            <div className="settings-field">
              <label>Answer Sheet</label>
              <div className="answer-progress-bar-wrap">
                <div className="answer-progress-bar">
                  <div
                    className="answer-progress-fill"
                    style={{ width: `${importData.questions.length ? (answeredCount / importData.questions.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="answer-progress-text">{answeredCount} / {importData.questions.length} answered</span>
              </div>
              <button
                className="btn btn-primary settings-btn"
                type="button"
                onClick={() => setAnswerModalOpen(true)}
              >
                ✏️ Add / Edit Answer Keys
              </button>
            </div>
          </div>

          {/* Pagination */}
          <div className="settings-section">
            <p className="settings-label">PAGINATION</p>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="pagination"
                  value="all"
                  checked={settings.pagination === 'all'}
                  onChange={() => setSettings(s => ({ ...s, pagination: 'all' }))}
                />
                <span>Show all the test questions on one page</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="pagination"
                  value="one"
                  checked={settings.pagination === 'one'}
                  onChange={() => setSettings(s => ({ ...s, pagination: 'one' }))}
                />
                <span>Show one item per page</span>
              </label>
            </div>
          </div>

          {/* Other Settings */}
          <div className="settings-section">
            <p className="settings-label">OTHER SETTINGS</p>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.randomizeQuestions}
                  onChange={(e) => setSettings(s => ({ ...s, randomizeQuestions: e.target.checked }))}
                />
                <span>Randomize the order of the questions during the test</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.allowBlankAnswers}
                  onChange={(e) => setSettings(s => ({ ...s, allowBlankAnswers: e.target.checked }))}
                />
                <span>Allow students to submit blank/empty answers</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.negativeMarking}
                  onChange={(e) => setSettings(s => ({ ...s, negativeMarking: e.target.checked }))}
                />
                <span>Penalize incorrect answers (negative marking)</span>
              </label>
            </div>
          </div>

          {/* End of Test Results Display */}
          <div className="settings-section">
            <p className="settings-label">AT THE END OF THE TEST, DISPLAY THE USER'S:</p>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resultsDisplay.score}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    resultsDisplay: { ...s.resultsDisplay, score: e.target.checked }
                  }))}
                />
                <span>Score</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resultsDisplay.testOutline}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    resultsDisplay: { ...s.resultsDisplay, testOutline: e.target.checked }
                  }))}
                />
                <span>Test outline</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resultsDisplay.correctIncorrect}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    resultsDisplay: { ...s.resultsDisplay, correctIncorrect: e.target.checked }
                  }))}
                />
                <span>Indicate if their response was correct or incorrect</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resultsDisplay.correctAnswer}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    resultsDisplay: { ...s.resultsDisplay, correctAnswer: e.target.checked }
                  }))}
                />
                <span>Display the correct answer</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.resultsDisplay.explanation}
                  onChange={(e) => setSettings(s => ({
                    ...s,
                    resultsDisplay: { ...s.resultsDisplay, explanation: e.target.checked }
                  }))}
                />
                <span>Display the explanation</span>
              </label>
            </div>
          </div>

          {/* Access Control */}
          <div className="settings-section">
            <p className="settings-label">ACCESS CONTROL</p>
            <div className="settings-field">
              <label>Who can take your test?</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="accessType"
                    value="anyone"
                    checked={settings.accessControl.accessType === 'anyone'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, accessType: 'anyone' }
                    }))}
                  />
                  <span>Anyone</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="accessType"
                    value="passcode"
                    checked={settings.accessControl.accessType === 'passcode'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, accessType: 'passcode' }
                    }))}
                  />
                  <span>Anyone who enters a passcode of my choosing</span>
                </label>
                {settings.accessControl.accessType === 'passcode' && (
                  <input
                    type="text"
                    placeholder="Enter passcode..."
                    value={settings.accessControl.passcode}
                    onChange={(e) => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, passcode: e.target.value }
                    }))}
                    style={{ marginTop: '5px' }}
                  />
                )}

                <label className="radio-label">
                  <input
                    type="radio"
                    name="accessType"
                    value="identifier_list"
                    checked={settings.accessControl.accessType === 'identifier_list'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, accessType: 'identifier_list' }
                    }))}
                  />
                  <span>Anyone who enters a unique identifier (student ID, employee ID, etc) from a list that I specify</span>
                </label>
                {settings.accessControl.accessType === 'identifier_list' && (
                  <textarea
                    placeholder="Enter allowed IDs (one per line)..."
                    value={settings.accessControl.identifierList}
                    onChange={(e) => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, identifierList: e.target.value }
                    }))}
                    rows="3"
                    style={{ marginTop: '5px', width: '100%', fontSize: '13px' }}
                  />
                )}

                <label className="radio-label">
                  <input
                    type="radio"
                    name="accessType"
                    value="email_list"
                    checked={settings.accessControl.accessType === 'email_list'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, accessType: 'email_list' }
                    }))}
                  />
                  <span>Anyone who enters an email address from a list that I specify</span>
                </label>
                {settings.accessControl.accessType === 'email_list' && (
                  <textarea
                    placeholder="Enter allowed emails (one per line)..."
                    value={settings.accessControl.emailList}
                    onChange={(e) => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, emailList: e.target.value }
                    }))}
                    rows="3"
                    style={{ marginTop: '5px', width: '100%', fontSize: '13px' }}
                  />
                )}
              </div>
            </div>

            {/* Time Limit */}
            <div className="settings-field" style={{ marginTop: '15px' }}>
              <label>How much time do test takers have to complete the test?</label>
              <p className="settings-hint">The timer starts the moment they enter the test and continues even if they close out of the test.</p>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="timeLimitType"
                    value="unlimited"
                    checked={settings.accessControl.timeLimitType === 'unlimited'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, timeLimitType: 'unlimited' }
                    }))}
                  />
                  <span>Unlimited</span>
                </label>
                <label className="radio-label inline-input-label">
                  <input
                    type="radio"
                    name="timeLimitType"
                    value="timed"
                    checked={settings.accessControl.timeLimitType === 'timed'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, timeLimitType: 'timed' }
                    }))}
                  />
                  <input
                    type="number"
                    min="1"
                    value={settings.accessControl.timeLimitMinutes}
                    onChange={(e) => setSettings(s => ({
                      ...s,
                      accessControl: { 
                        ...s.accessControl, 
                        timeLimitType: 'timed', 
                        timeLimitMinutes: parseInt(e.target.value) || 1 
                      }
                    }))}
                    disabled={settings.accessControl.timeLimitType !== 'timed'}
                    style={{ width: '70px', padding: '4px 8px', margin: '0 6px' }}
                  />
                  <span>minutes</span>
                </label>
              </div>
            </div>

            {/* Attempt Limit */}
            <div className="settings-field" style={{ marginTop: '15px' }}>
              <label>How many times can someone take your test?</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="attemptsType"
                    value="unlimited"
                    checked={settings.accessControl.attemptsType === 'unlimited'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, attemptsType: 'unlimited' }
                    }))}
                  />
                  <span>Unlimited</span>
                </label>
                <label className="radio-label inline-input-label">
                  <input
                    type="radio"
                    name="attemptsType"
                    value="limited"
                    checked={settings.accessControl.attemptsType === 'limited'}
                    onChange={() => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, attemptsType: 'limited' }
                    }))}
                  />
                  <input
                    type="number"
                    min="1"
                    value={settings.accessControl.maxAttempts}
                    onChange={(e) => setSettings(s => ({
                      ...s,
                      accessControl: { ...s.accessControl, maxAttempts: parseInt(e.target.value) || 1 }
                    }))}
                    disabled={settings.accessControl.attemptsType !== 'limited'}
                    style={{ width: '70px', padding: '4px 8px', margin: '0 6px' }}
                  />
                  <span>times</span>
                </label>
              </div>
            </div>

            {/* Identifier Prompt Text */}
            <div className="settings-field" style={{ marginTop: '15px' }}>
              <label>What should test takers enter to identify themselves?</label>
              <p className="settings-hint">
                This text appears above the field where the test taker enters their identifier.<br />
                <em>Examples: "Enter your name", "Enter your student ID", or "Please enter your company email address"</em>
              </p>
              <input
                type="text"
                value={settings.accessControl.identifierPrompt}
                onChange={(e) => setSettings(s => ({
                  ...s,
                  accessControl: { ...s.accessControl, identifierPrompt: e.target.value }
                }))}
                placeholder="Enter your name"
              />
            </div>
          </div>

          {importData.needsReview > 0 && (
            <div className="settings-section">
              <div className="alert alert-warning" style={{ margin: 0 }}>
                ⚠️ {importData.needsReview} question(s) need review
              </div>
            </div>
          )}

          {error && (
            <div className="settings-section">
              <div className="alert alert-error" style={{ margin: 0 }}>{error}</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="settings-section settings-footer">
            <button
              className="btn btn-secondary settings-btn"
              onClick={() => navigate('/import')}
            >
              Cancel
            </button>
            <button
              className="btn btn-success settings-btn"
              onClick={createQuiz}
              disabled={saving}
            >
              {saving ? (
                <><span className="btn-spinner" /> Saving & Publishing...</>
              ) : '💾 Save & Publish Quiz'}
            </button>
          </div>
        </aside>

        {/* RIGHT: Questions list */}
        <div className="preview-questions-panel">
          <div className="questions-preview">
            {importData.questions?.map((question, index) => (
              <article className="question-preview" key={question.id || index}>
                <div className="question-number">Question {index + 1}</div>
                <div className="question-text">{question.question}</div>
                <div className="options-preview">
                  {question.options?.map((option, optionIndex) => (
                    <div className="option-choice" key={`${question.id || index}-${option.id || 'option'}-${optionIndex}`}>
                      <span>{option.text}</span>
                    </div>
                  ))}
                </div>
                {question.correctAnswer ? (
                  <div className="answer-key"><strong>Correct answer:</strong> {question.correctAnswer}</div>
                ) : (
                  <div className="alert alert-warning">Correct answer could not be determined.</div>
                )}
              </article>
            ))}
          </div>
        </div>

      </div>

      {/* Answer sheet modal */}
      {answerModalOpen && (
        <div className="answer-modal-backdrop" role="presentation" onClick={() => setAnswerModalOpen(false)}>
          <section className="answer-modal" role="dialog" aria-modal="true" aria-labelledby="answer-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="answer-modal-header">
              <div>
                <p className="eyebrow">ANSWER SHEET</p>
                <h2 id="answer-modal-title">Add correct answers</h2>
                <p>{importData.questions.length} questions extracted</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button
                  type="button"
                  style={{ padding: '4px 10px', fontSize: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={resetAnswers}
                >
                  Reset
                </button>
                <button className="modal-close" type="button" onClick={() => setAnswerModalOpen(false)} aria-label="Close">×</button>
              </div>
            </div>
            <div className="answer-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '50vh', overflowY: 'auto', padding: '10px' }}>
              {importData.questions.map((question, index) => (
                <div key={question.id || index} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ minWidth: '80px', fontWeight: 'bold' }}>Question {index + 1}</span>
                  <input
                    id={`answer-letter-${index}`}
                    maxLength="1"
                    value={answers[index] || ''}
                    onChange={(e) => updateAnswer(index, e.target.value)}
                    placeholder="A"
                    aria-label={`Correct answer for question ${index + 1}`}
                    style={{ width: '40px', textAlign: 'center', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
              ))}
            </div>
            <div className="answer-modal-footer">
              <span>{answers.filter(Boolean).length} of {answers.length} answered</span>
              <button className="btn btn-success" type="button" onClick={() => setAnswerModalOpen(false)}>Done</button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportPreview;