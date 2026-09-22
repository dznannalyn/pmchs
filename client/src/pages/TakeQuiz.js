import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './TakeQuiz.css';

const getDeviceId = () => {
  const key = 'quiz_app_device_id';
  let deviceId = localStorage.getItem(key);

  if (!deviceId) {
    deviceId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, deviceId);
  }

  return deviceId;
};

const getDeviceFingerprint = () => {
  const nav = navigator;
  const display = window.screen;
  const fingerprint = [
    nav.userAgent,
    nav.language,
    display.width,
    display.height,
    display.colorDepth,
  ].join('|');

  return btoa(unescape(encodeURIComponent(fingerprint))).slice(0, 128);
};

function TakeQuiz() {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get('linkId');
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  
  // Student identification & access control
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [passcode, setPasscode] = useState('');
  const [accessError, setAccessError] = useState('');
  
  const [hasStarted, setHasStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Pagination & Timer
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [forfeited, setForfeited] = useState(false);

  // ── Anti-cheat: disable right-click, copy, paste & DevTools shortcuts ──
  useEffect(() => {
    const disableRightClick = (e) => e.preventDefault();

    const disableClipboard = (e) => {
      e.preventDefault();
      return false;
    };

    const disableKeys = (e) => {
      const key = e.key.toUpperCase();
      // Block F12, Alt, Ctrl+Shift+I/J/C, Ctrl+U/S/P/C/V/X/A/Tab
      if (
        e.key === 'F12' ||
        e.key === 'Alt' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(key)) ||
        ((e.ctrlKey || e.metaKey) && ['U', 'S', 'P', 'C', 'V', 'X', 'A', 'TAB'].includes(key))
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', disableRightClick);
    document.addEventListener('copy', disableClipboard);
    document.addEventListener('paste', disableClipboard);
    document.addEventListener('cut', disableClipboard);
    document.addEventListener('keydown', disableKeys);

    return () => {
      document.removeEventListener('contextmenu', disableRightClick);
      document.removeEventListener('copy', disableClipboard);
      document.removeEventListener('paste', disableClipboard);
      document.removeEventListener('cut', disableClipboard);
      document.removeEventListener('keydown', disableKeys);
    };
  }, []);

  const triggerFullscreen = () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      }
    } catch (e) {}
  };

  // Track Alt+Tab, Window Blur (Mobile Focus Loss), & Fullscreen Exit during active test (3 strikes = disqualify)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasStarted || result || forfeited) return;

    let lastStrikeTime = 0;
    const registerStrike = () => {
      // Debounce strikes by 1.5 seconds so 1 focus loss fires exactly 1 strike
      const now = Date.now();
      if (now - lastStrikeTime < 1500) return;
      lastStrikeTime = now;

      setTabSwitchCount(prev => {
        const nextCount = prev + 1;
        if (nextCount >= 3) {
          handleForfeit();
        }
        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        registerStrike();
      }
    };

    const handleWindowBlur = () => {
      registerStrike();
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        registerStrike();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [hasStarted, result, forfeited]);

  const handleForfeit = async () => {
    setForfeited(true);
    sessionStorage.removeItem(`quiz_session_${quizId}`);
    try {
      const response = await axios.post(`/api/quizzes/${quizId}/submit`, {
        studentName: (studentIdentifier || 'Student') + ' (DISQUALIFIED - 3 Tab Switches)',
        answers: []
      });
      setResult({ ...response.data, isForfeited: true });
    } catch (e) {
      setResult({ isForfeited: true, score: 0 });
    }
  };

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const url = linkId
          ? `/api/quizzes/${quizId}/public?linkId=${linkId}`
          : `/api/quizzes/${quizId}/public`;
        const response = await axios.get(url);
        setQuiz(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not load quiz.');
      }
    };
    fetchQuiz();
  }, [quizId, linkId]);

  // Restore Active Session on page reload/refresh
  useEffect(() => {
    if (!quiz) return;

    const sessionKey = `quiz_session_${quizId}`;
    const savedSession = sessionStorage.getItem(sessionKey);

    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.hasStarted && parsed.studentIdentifier) {
          setStudentIdentifier(parsed.studentIdentifier);
          if (parsed.passcode) setPasscode(parsed.passcode);
          setAnswers(parsed.answers || {});
          if (parsed.questions && parsed.questions.length > 0) {
            setQuestions(parsed.questions);
          } else {
            setQuestions(quiz.questions);
          }
          if (typeof parsed.currentIndex === 'number') {
            setCurrentIndex(parsed.currentIndex);
          }

          // Compute remaining timer from original startTime
          const accessControl = quiz.settings?.accessControl || {};
          const isTimed = accessControl.timeLimitType === 'timed' || (accessControl.timeLimitMinutes && Number(accessControl.timeLimitMinutes) > 0 && accessControl.timeLimitType !== 'unlimited');
          if (isTimed && parsed.startTime) {
            const durationSec = (Number(accessControl.timeLimitMinutes) || 30) * 60;
            const elapsedSec = Math.floor((Date.now() - parsed.startTime) / 1000);
            const remaining = durationSec - elapsedSec;
            setTimeLeft(remaining > 0 ? remaining : 0);
          }
          setHasStarted(true);
        }
      } catch (e) {
        console.error('Session restore error:', e);
      }
    }
  }, [quiz, quizId]);

  // Sync state changes to sessionStorage while taking test
  useEffect(() => {
    if (hasStarted && studentIdentifier) {
      const sessionKey = `quiz_session_${quizId}`;
      const savedSession = sessionStorage.getItem(sessionKey);
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          parsed.answers = answers;
          parsed.currentIndex = currentIndex;
          sessionStorage.setItem(sessionKey, JSON.stringify(parsed));
        } catch (e) {}
      }
    }
  }, [answers, currentIndex, hasStarted, studentIdentifier, quizId]);

  // Handle Timer Countdown
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasStarted || timeLeft === null || result) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, timeLeft, result]);

  if (error) return <div className="take-quiz-container"><div className="alert alert-error">{error}</div></div>;
  if (!quiz) return <div className="take-quiz-container"><div className="loading">Loading quiz...</div></div>;

  const settings = quiz.settings || {};
  const accessControl = settings.accessControl || {};
  const resultsDisplay = settings.resultsDisplay || { score: true, correctIncorrect: true, correctAnswer: true };

  // Access Control Validation
  const handleStartQuiz = () => {
    setAccessError('');

    // Passcode check
    if (accessControl.accessType === 'passcode') {
      if (!passcode.trim()) {
        setAccessError('Please enter the passcode provided by your teacher.');
        return;
      }
      if (passcode.trim() !== accessControl.passcode?.trim()) {
        setAccessError('Incorrect passcode. Please try again.');
        return;
      }
    }

    // Identifier List check
    if (accessControl.accessType === 'identifier_list') {
      const allowed = (accessControl.identifierList || '')
        .split('\n')
        .map(id => id.trim().toLowerCase())
        .filter(Boolean);

      if (!studentIdentifier.trim()) {
        setAccessError('Please enter your ID.');
        return;
      }
      if (allowed.length > 0 && !allowed.includes(studentIdentifier.trim().toLowerCase())) {
        setAccessError('Your ID was not found in the allowed list for this test.');
        return;
      }
    }

    // Email List check
    if (accessControl.accessType === 'email_list') {
      const allowed = (accessControl.emailList || '')
        .split('\n')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean);

      if (!studentIdentifier.trim()) {
        setAccessError('Please enter your email address.');
        return;
      }
      if (allowed.length > 0 && !allowed.includes(studentIdentifier.trim().toLowerCase())) {
        setAccessError('Your email address was not found in the allowed list for this test.');
        return;
      }
    }

    if (!studentIdentifier.trim()) {
      setAccessError('Please enter your identifier to proceed.');
      return;
    }

    // Prepare Questions (Randomize if configured)
    let initialQuestions = [...quiz.questions];
    if (settings.randomizeQuestions) {
      initialQuestions = initialQuestions.sort(() => Math.random() - 0.5);
    }

    // Initialize Timer if configured
    if (accessControl.timeLimitType === 'timed' || (accessControl.timeLimitMinutes && Number(accessControl.timeLimitMinutes) > 0 && accessControl.timeLimitType !== 'unlimited')) {
      const minutes = Number(accessControl.timeLimitMinutes) || 30;
      setTimeLeft(minutes * 60);
    }

    const now = Date.now();
    const sessionData = {
      studentIdentifier,
      passcode,
      hasStarted: true,
      answers: {},
      questions: initialQuestions,
      currentIndex: 0,
      startTime: now
    };
    sessionStorage.setItem(`quiz_session_${quizId}`, JSON.stringify(sessionData));

    // Request Fullscreen Mode
    triggerFullscreen();

    setQuestions(initialQuestions);
    setHasStarted(true);
  };

  const handleOptionChange = (questionId, optionLetter) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionLetter
    }));
  };

  const submitQuiz = async () => {
    if (!window.confirm('Are you ready to submit your test?')) return;
    performSubmission();
  };

  const handleAutoSubmit = async () => {
    alert('Time has expired! Your test will now be submitted automatically.');
    performSubmission();
  };

  const performSubmission = async () => {
    setSubmitting(true);

    const formattedAnswers = Object.keys(answers).map(qId => ({
      questionId: qId,
      selectedAnswers: [answers[qId]]
    }));

    try {
      const response = await axios.post(`/api/quizzes/${quizId}/submit`, {
        studentName: studentIdentifier,
        answers: formattedAnswers,
        linkId: linkId || null,
        linkLabel: quiz?.linkLabel || null,
        deviceId: getDeviceId(),
        deviceFingerprint: getDeviceFingerprint(),
        userAgent: navigator.userAgent || null,
        ipAddress: null
      });
      setResult(response.data);
      sessionStorage.removeItem(`quiz_session_${quizId}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit quiz.');
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ──── RESULTS & DISQUALIFICATION SCREEN ────
  if (result?.isForfeited || forfeited) {
    return (
      <div className="take-quiz-container">
        <div className="card result-card" style={{ borderTop: '6px solid #ef4444', textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>⛔</div>
          <h1 style={{ color: '#dc2626', margin: '0 0 10px 0' }}>Test Disqualified & Forfeited</h1>
          <p style={{ color: '#475569', fontSize: '1.05rem', margin: '15px 0' }}>
            You switched tabs / applications <strong>3 times</strong> during the test.
          </p>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '8px', color: '#991b1b', fontWeight: 'bold', fontSize: '1.2rem', margin: '20px 0' }}>
            Official Score: 0 / {quiz?.questions?.length || 0}
          </div>
          <button 
            className="btn btn-danger" 
            style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 'bold' }}
            onClick={() => {
              sessionStorage.clear();
              window.location.href = '/';
            }}
          >
            Exit & Log Out
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const resDisplay = result.settings?.resultsDisplay || resultsDisplay;

    return (
      <div className="take-quiz-container">
        <div className="card result-card">
          <h1>Test Completed!</h1>
          <p style={{ color: '#64748b' }}>Thank you, <strong>{studentIdentifier}</strong>.</p>

          {/* Show Score if enabled in settings */}
          {resDisplay.score !== false && (
            <div className="score-display">
              <h2>Your Score</h2>
              <div className="score-fraction">{result.score} / {result.totalQuestions}</div>
            </div>
          )}

          {/* Detailed Question Review if enabled */}
          {(resDisplay.correctIncorrect !== false || resDisplay.correctAnswer !== false) && result.questionResults && (
            <div style={{ marginTop: '30px', textAlign: 'left' }}>
              <h3 style={{ marginBottom: '15px', color: '#1e293b' }}>Test Review</h3>
              {questions.map((q, idx) => {
                const qId = q.id || (q._id && q._id.toString());
                const res = result.questionResults.find(r => r.questionId === qId);
                const selected = res?.selectedAnswers?.[0] || 'No Answer';
                const isCorrect = res?.isCorrect;
                const correctList = res?.correctAnswers?.join(', ');

                return (
                  <div 
                    key={qId || idx} 
                    style={{ 
                      padding: '15px', 
                      marginBottom: '12px', 
                      borderRadius: '8px', 
                      background: isCorrect ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}`
                    }}
                  >
                    <p style={{ fontWeight: 'bold', margin: '0 0 6px 0', color: '#334155' }}>
                      Q{idx + 1}: {q.question?.html || q.question?.plainText || q.question}
                    </p>
                    <div style={{ fontSize: '14px' }}>
                      {resDisplay.correctIncorrect !== false && (
                        <p style={{ margin: '4px 0', color: isCorrect ? '#166534' : '#991b1b', fontWeight: '600' }}>
                          {isCorrect ? '✓ Correct' : '✗ Incorrect'} (Your answer: {selected})
                        </p>
                      )}
                      {!isCorrect && resDisplay.correctAnswer !== false && correctList && (
                        <p style={{ margin: '4px 0', color: '#15803d', fontWeight: '600' }}>
                          Correct Answer: {correctList}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──── START SCREEN ────
  if (!hasStarted) {
    const promptText = accessControl.identifierPrompt || 'Enter your name';

    return (
      <div className="take-quiz-container">
        <div className="card start-card">
          <h1>{quiz.linkLabel || quiz.title}</h1>
          {quiz.description && <p style={{ color: '#64748b', marginBottom: '15px' }}>{quiz.description}</p>}
          <p style={{ fontWeight: 'bold', color: '#3b82f6', margin: '5px 0' }}>{quiz.questions.length} Questions</p>

          {(accessControl.timeLimitType === 'timed' || (accessControl.timeLimitMinutes && Number(accessControl.timeLimitMinutes) > 0 && accessControl.timeLimitType !== 'unlimited')) && (
            <div style={{ margin: '12px auto', padding: '8px 16px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.95rem', display: 'inline-block', border: '1px solid #fde68a' }}>
              ⏱ Time Limit: {accessControl.timeLimitMinutes || 30} minutes
            </div>
          )}

          {accessError && (
            <div className="alert alert-error" style={{ marginTop: '15px' }}>{accessError}</div>
          )}

          <div className="form-group" style={{ marginTop: '20px', textAlign: 'left' }}>
            <label htmlFor="studentIdentifier">{promptText}:</label>
            <input 
              id="studentIdentifier" 
              value={studentIdentifier} 
              onChange={(e) => setStudentIdentifier(e.target.value)} 
              placeholder={promptText} 
              autoFocus
            />
          </div>

          {/* Passcode input if required */}
          {accessControl.accessType === 'passcode' && (
            <div className="form-group" style={{ marginTop: '15px', textAlign: 'left' }}>
              <label htmlFor="quizPasscode">Passcode required:</label>
              <input 
                id="quizPasscode" 
                type="password"
                value={passcode} 
                onChange={(e) => setPasscode(e.target.value)} 
                placeholder="Enter passcode" 
              />
            </div>
          )}

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '20px', padding: '14px', fontSize: '1.1rem' }}
            onClick={handleStartQuiz}
          >
            Start Test
          </button>
        </div>
      </div>
    );
  }

  // ──── TAKING QUIZ SCREEN ────
  const isOnePerPage = settings.pagination === 'one';
  const currentQ = isOnePerPage ? questions[currentIndex] : null;
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = settings.allowBlankAnswers !== false || answeredCount === questions.length;

  return (
    <div className="take-quiz-container">
      {/* Header bar */}
      <div className="quiz-header card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{quiz.linkLabel || quiz.title}</h1>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Student: <strong>{studentIdentifier}</strong></span>
        </div>
        <button
          type="button"
          onClick={triggerFullscreen}
          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', color: '#334155' }}
        >
          ⛶ Fullscreen
        </button>
      </div>

      {/* Tab Switch Warning Banner (Strikes 1 & 2) */}
      {tabSwitchCount > 0 && !result && !forfeited && (
        <div style={{ 
          background: tabSwitchCount >= 2 ? '#fef2f2' : '#fffbe6', 
          color: tabSwitchCount >= 2 ? '#991b1b' : '#b45309', 
          border: tabSwitchCount >= 2 ? '2px solid #f87171' : '1px solid #fde047', 
          padding: '12px 18px', 
          borderRadius: '8px', 
          marginBottom: '15px', 
          fontWeight: 'bold', 
          fontSize: '0.95rem' 
        }}>
          {tabSwitchCount === 1 && (
            <span>⚠️ <strong>WARNING (Strike 1/3):</strong> Tab switching or Alt+Tab detected! Switching tabs 3 times will disqualify your test with a score of 0.</span>
          )}
          {tabSwitchCount === 2 && (
            <span>⚠️ <strong>FINAL WARNING (Strike 2/3):</strong> Tab switching detected! Switching tabs ONE MORE TIME will immediately disqualify you with a score of 0.</span>
          )}
        </div>
      )}

      {/* ONE QUESTION PER PAGE VIEW */}
      {isOnePerPage ? (
        <div className="card question-card" key={currentQ?._id || currentQ?.id || currentIndex}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Question {currentIndex + 1} of {questions.length}</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {answeredCount} of {questions.length} answered
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginBottom: '20px', overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                background: '#2563eb', 
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
                transition: 'width 0.3s ease'
              }} 
            />
          </div>

          <div 
            className="question-text" 
            style={{ whiteSpace: 'pre-wrap' }} 
            dangerouslySetInnerHTML={{ __html: currentQ?.question?.html || currentQ?.question?.plainText || currentQ?.question }} 
          />

          <div className="options-list">
            {currentQ?.options && currentQ.options.length > 0 ? (
              currentQ.options.map((opt, optIndex) => {
                const letter = String.fromCharCode(65 + optIndex);
                const qId = currentQ._id || currentQ.id || String(currentIndex);
                return (
                  <label key={optIndex} className="option-label">
                    <input 
                      type="radio" 
                      name={`q-${qId}`} 
                      value={letter}
                      checked={answers[qId] === letter}
                      onChange={() => handleOptionChange(qId, letter)}
                    />
                    <span className="option-letter">{letter}.</span>
                    <span dangerouslySetInnerHTML={{ __html: opt.html || opt.plainText || opt.text }} />
                  </label>
                );
              })
            ) : null}
          </div>

          {/* Navigation Controls for One Per Page */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              ← Previous
            </button>

            {!isLastQuestion ? (
              <button
                className="btn btn-primary"
                onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
              >
                Next →
              </button>
            ) : (
              <button 
                className="btn btn-success submit-btn" 
                onClick={submitQuiz}
                disabled={submitting || !canSubmit}
              >
                {submitting ? 'Submitting...' : 'Submit Test'}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ALL QUESTIONS ON ONE PAGE VIEW */
        <div className="questions-container">
          {questions.map((question, index) => {
            const qId = question._id || question.id || String(index);

            return (
              <div className="card question-card" key={qId}>
                <h3>Question {index + 1}</h3>
                <div 
                  className="question-text" 
                  style={{ whiteSpace: 'pre-wrap' }} 
                  dangerouslySetInnerHTML={{ __html: question.question?.html || question.question?.plainText || question.question }} 
                />
                
                <div className="options-list">
                  {question.options && question.options.length > 0 ? (
                    question.options.map((opt, optIndex) => {
                      const letter = String.fromCharCode(65 + optIndex);
                      return (
                        <label key={optIndex} className="option-label">
                          <input 
                            type="radio" 
                            name={`q-${qId}`} 
                            value={letter}
                            checked={answers[qId] === letter}
                            onChange={() => handleOptionChange(qId, letter)}
                          />
                          <span className="option-letter">{letter}.</span>
                          <span dangerouslySetInnerHTML={{ __html: opt.html || opt.plainText || opt.text }} />
                        </label>
                      );
                    })
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer for All Questions View */}
      {!isOnePerPage && (
        <div className="quiz-footer">
          <button 
            className="btn btn-success submit-btn" 
            onClick={submitQuiz}
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
          {!canSubmit && (
            <p className="warning-text">Please answer all questions before submitting.</p>
          )}
        </div>
      )}
      {/* Sticky Bottom-Middle Timer Pill */}
      {timeLeft !== null && (
        <div className="sticky-timer-pill">
          <span>⏱</span> Time Left: {formatTime(timeLeft)}
        </div>
      )}
    </div>
  );
}

export default TakeQuiz;
