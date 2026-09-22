import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './QuizEditor.css';
import './ImportPreview.css';

function QuizEditor({ user }) {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get('linkId');

  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [clonedLink, setClonedLink] = useState(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const getQuestionAnswerKey = (q) => {
    if (!q) return '';
    if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0 && q.correctAnswers[0]) {
      return String(q.correctAnswers[0]).trim().toUpperCase();
    }
    if (q.correctAnswer) {
      return String(q.correctAnswer).trim().toUpperCase();
    }
    if (Array.isArray(q.options)) {
      const correctOpt = q.options.find(o => o.isCorrect || o.correct);
      if (correctOpt) return String(correctOpt.id || correctOpt.label || '').trim().toUpperCase();
    }
    return '';
  };

  const openAnswerSheet = () => {
    const currentAnswers = (quiz?.questions || []).map(getQuestionAnswerKey);
    setAnswers(currentAnswers);
    setAnswerModalOpen(true);
  };

  const handleAnswerInput = (index, value) => {
    const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
    
    setAnswers(prev => {
      const next = [...prev];
      next[index] = cleanValue;
      return next;
    });

    if (cleanValue && index < (quiz?.questions?.length || 0) - 1) {
      setTimeout(() => {
        document.getElementById(`editor-answer-letter-${index + 1}`)?.focus();
      }, 0);
    }
  };

  const saveAnswerSheet = async () => {
    try {
      const updatedQuestions = (quiz?.questions || []).map((q, idx) => {
        const key = answers[idx] ? [answers[idx]] : [];
        const opts = (q.options || []).map(opt => ({
          ...opt,
          isCorrect: answers[idx] ? (opt.id === answers[idx] || opt.label === answers[idx]) : false
        }));

        return {
          ...q,
          correctAnswers: key,
          correctAnswer: answers[idx] || null,
          options: opts,
          metadata: { ...(q.metadata || {}), needsReview: false }
        };
      });

      setQuiz(prev => ({ ...prev, questions: updatedQuestions }));

      await axios.put(`/api/quizzes/${quizId}`, {
        questions: updatedQuestions
      });

      showToast('✓ Answer keys saved successfully!');
    } catch (err) {
      console.error('Failed to save answer sheet batch', err);
      showToast('❌ Failed to save answer keys', 'error');
    } finally {
      setAnswerModalOpen(false);
    }
  };

  const resetAnswers = () => {
    if (!window.confirm('Are you sure you want to clear all answer keys?')) return;
    setAnswers(new Array(quiz?.questions?.length || 0).fill(''));
  };

  useEffect(() => {
    fetchQuiz();
  }, [quizId, linkId]);

  const fetchQuiz = async () => {
    try {
      const response = await axios.get(`/api/quizzes/${quizId}`);
      const data = response.data;
      if (!data.settings) {
        data.settings = {
          pagination: 'all',
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
            accessType: 'anyone',
            passcode: '',
            identifierList: '',
            emailList: '',
            timeLimitType: 'unlimited',
            timeLimitMinutes: 30,
            attemptsType: 'unlimited',
            maxAttempts: 1,
            identifierPrompt: 'Enter your name'
          }
        };
      }

      // Handle cloned link context
      if (linkId) {
        const foundLink = (data.clonedLinks || []).find(l => l.linkId === linkId);
        if (foundLink) {
          setClonedLink(foundLink);
          setLinkTitle(foundLink.label);
          if (foundLink.settings && Object.keys(foundLink.settings).length > 0) {
            data.settings = { ...data.settings, ...foundLink.settings };
          }
        }
      }

      setQuiz(data);
    } catch (err) {
      setError('Failed to load quiz');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuiz = async () => {
    try {
      // Always save updated questions to quiz document
      await axios.put(`/api/quizzes/${quizId}`, {
        title: clonedLink ? quiz.title : (quiz.title || ''),
        isPublished: quiz.isPublished,
        settings: quiz.settings,
        questions: quiz.questions
      });

      if (linkId && clonedLink) {
        await axios.put(`/api/quizzes/${quizId}/cloned-links/${linkId}`, {
          label: linkTitle || clonedLink.label,
          settings: quiz.settings
        });
        showToast(`✓ Cloned link & quiz saved successfully!`);
      } else {
        showToast('✓ Quiz saved successfully!');
      }
      navigate('/');
    } catch (err) {
      showToast('❌ Failed to save quiz', 'error');
    }
  };

  const handleUpdateQuestion = async (questionId, updates) => {
    try {
      await axios.put(`/api/quizzes/${quizId}/questions/${questionId}`, updates);
      
      // Update local state
      setQuiz({
        ...quiz,
        questions: quiz.questions.map(q =>
          q.id === questionId ? { ...q, ...updates } : q
        )
      });
      
      setEditingQuestion(null);
      showToast('✓ Question updated successfully!');
    } catch (err) {
      showToast('❌ Failed to update question', 'error');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;

    try {
      await axios.delete(`/api/quizzes/${quizId}/questions/${questionId}`);
      setQuiz({
        ...quiz,
        questions: quiz.questions.filter(q => q.id !== questionId)
      });
      showToast('✓ Question deleted');
    } catch (err) {
      showToast('❌ Failed to delete question', 'error');
    }
  };

  const handleAddQuestion = async (question) => {
    try {
      const response = await axios.post(`/api/quizzes/${quizId}/questions`, { question });
      setQuiz(prev => ({
        ...prev,
        questions: [...prev.questions, response.data.question]
      }));
      
      setShowQuestionForm(false);
      showToast('✓ Question added!');
    } catch (err) {
      showToast('❌ Failed to add question', 'error');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading quiz...</div>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!quiz) {
    return <div className="alert alert-error">Quiz not found</div>;
  }

  const answeredCount = quiz?.questions?.filter(q => q.correctAnswers && q.correctAnswers.length > 0 && q.correctAnswers[0] !== '').length || 0;

  return (
    <div className="quiz-editor-container">
      <div className="editor-header">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>{clonedLink ? `Edit Link: ${linkTitle || clonedLink.label}` : 'Edit Quiz'}</h1>
      </div>

      {clonedLink && (
        <div style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '12px 18px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', fontSize: '0.95rem' }}>
          🏷️ You are editing settings for Cloned Link: "{linkTitle || clonedLink.label}" (Original Quiz: {quiz.title})
        </div>
      )}

      <div className="editor-layout">
        <div className="quiz-meta-editor">
          <h2>{clonedLink ? 'Link Settings' : 'Quiz Settings'}</h2>
          
          <div className="form-group">
            <label htmlFor="quiz-title-input">{clonedLink ? 'Link Label / Title' : 'Title'}</label>
            <input
              id="quiz-title-input"
              value={clonedLink ? linkTitle : quiz.title}
              onChange={(e) => clonedLink ? setLinkTitle(e.target.value) : setQuiz({ ...quiz, title: e.target.value })}
              placeholder={clonedLink ? 'e.g. BSIT 4C' : 'Quiz title'}
            />
          </div>

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>Answer Sheet</label>
            <div className="answer-progress-bar-wrap">
              <div className="answer-progress-bar">
                <div
                  className="answer-progress-fill"
                  style={{ width: `${quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0}%` }}
                />
              </div>
              <span className="answer-progress-text">{answeredCount} / {quiz.questions.length} answered</span>
            </div>
            <button
              className="btn btn-primary settings-btn"
              type="button"
              onClick={openAnswerSheet}
            >
              ✏️ Add / Edit Answer Keys
            </button>
          </div>

          <div className="settings-section" style={{ marginTop: '15px' }}>
            <p className="settings-label">PAGINATION</p>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="editorPagination"
                  value="all"
                  checked={quiz.settings?.pagination === 'all'}
                  onChange={() => setQuiz(q => ({ ...q, settings: { ...q.settings, pagination: 'all' } }))}
                />
                <span>Show all the test questions on one page</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="editorPagination"
                  value="one"
                  checked={quiz.settings?.pagination === 'one'}
                  onChange={() => setQuiz(q => ({ ...q, settings: { ...q.settings, pagination: 'one' } }))}
                />
                <span>Show one item per page</span>
              </label>
            </div>
          </div>

          <div className="settings-section" style={{ marginTop: '15px' }}>
            <p className="settings-label">OTHER SETTINGS</p>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.randomizeQuestions || false}
                  onChange={(e) => setQuiz(q => ({ ...q, settings: { ...q.settings, randomizeQuestions: e.target.checked } }))}
                />
                <span>Randomize the order of the questions during the test</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.allowBlankAnswers ?? true}
                  onChange={(e) => setQuiz(q => ({ ...q, settings: { ...q.settings, allowBlankAnswers: e.target.checked } }))}
                />
                <span>Allow students to submit blank/empty answers</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.negativeMarking || false}
                  onChange={(e) => setQuiz(q => ({ ...q, settings: { ...q.settings, negativeMarking: e.target.checked } }))}
                />
                <span>Penalize incorrect answers (negative marking)</span>
              </label>
            </div>
          </div>

          <div className="settings-section" style={{ marginTop: '15px' }}>
            <p className="settings-label">AT THE END OF THE TEST, DISPLAY THE USER'S:</p>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.resultsDisplay?.score ?? true}
                  onChange={(e) => setQuiz(q => ({
                    ...q,
                    settings: {
                      ...q.settings,
                      resultsDisplay: { ...(q.settings?.resultsDisplay || {}), score: e.target.checked }
                    }
                  }))}
                />
                <span>Score</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.resultsDisplay?.testOutline || false}
                  onChange={(e) => setQuiz(q => ({
                    ...q,
                    settings: {
                      ...q.settings,
                      resultsDisplay: { ...(q.settings?.resultsDisplay || {}), testOutline: e.target.checked }
                    }
                  }))}
                />
                <span>Test outline</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.resultsDisplay?.correctIncorrect ?? true}
                  onChange={(e) => setQuiz(q => ({
                    ...q,
                    settings: {
                      ...q.settings,
                      resultsDisplay: { ...(q.settings?.resultsDisplay || {}), correctIncorrect: e.target.checked }
                    }
                  }))}
                />
                <span>Indicate if their response was correct or incorrect</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.resultsDisplay?.correctAnswer ?? true}
                  onChange={(e) => setQuiz(q => ({
                    ...q,
                    settings: {
                      ...q.settings,
                      resultsDisplay: { ...(q.settings?.resultsDisplay || {}), correctAnswer: e.target.checked }
                    }
                  }))}
                />
                <span>Display the correct answer</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={quiz.settings?.resultsDisplay?.explanation || false}
                  onChange={(e) => setQuiz(q => ({
                    ...q,
                    settings: {
                      ...q.settings,
                      resultsDisplay: { ...(q.settings?.resultsDisplay || {}), explanation: e.target.checked }
                    }
                  }))}
                />
                <span>Display the explanation</span>
              </label>
            </div>
          </div>

          <div className="settings-section" style={{ marginTop: '15px' }}>
            <p className="settings-label">ACCESS CONTROL</p>
            <div className="settings-field">
              <label>Who can take your test?</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="editAccessType"
                    value="anyone"
                    checked={quiz.settings?.accessControl?.accessType === 'anyone'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), accessType: 'anyone' }
                      }
                    }))}
                  />
                  <span>Anyone</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="editAccessType"
                    value="passcode"
                    checked={quiz.settings?.accessControl?.accessType === 'passcode'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), accessType: 'passcode' }
                      }
                    }))}
                  />
                  <span>Anyone who enters a passcode of my choosing</span>
                </label>
                {quiz.settings?.accessControl?.accessType === 'passcode' && (
                  <input
                    type="text"
                    placeholder="Enter passcode..."
                    value={quiz.settings?.accessControl?.passcode || ''}
                    onChange={(e) => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), passcode: e.target.value }
                      }
                    }))}
                    style={{ marginTop: '5px' }}
                  />
                )}

                <label className="radio-label">
                  <input
                    type="radio"
                    name="editAccessType"
                    value="identifier_list"
                    checked={quiz.settings?.accessControl?.accessType === 'identifier_list'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), accessType: 'identifier_list' }
                      }
                    }))}
                  />
                  <span>Anyone who enters a unique identifier (student ID, employee ID, etc) from a list that I specify</span>
                </label>
                {quiz.settings?.accessControl?.accessType === 'identifier_list' && (
                  <textarea
                    placeholder="Enter allowed IDs (one per line)..."
                    value={quiz.settings?.accessControl?.identifierList || ''}
                    onChange={(e) => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), identifierList: e.target.value }
                      }
                    }))}
                    rows="3"
                    style={{ marginTop: '5px', width: '100%', fontSize: '13px' }}
                  />
                )}

                <label className="radio-label">
                  <input
                    type="radio"
                    name="editAccessType"
                    value="email_list"
                    checked={quiz.settings?.accessControl?.accessType === 'email_list'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), accessType: 'email_list' }
                      }
                    }))}
                  />
                  <span>Anyone who enters an email address from a list that I specify</span>
                </label>
                {quiz.settings?.accessControl?.accessType === 'email_list' && (
                  <textarea
                    placeholder="Enter allowed emails (one per line)..."
                    value={quiz.settings?.accessControl?.emailList || ''}
                    onChange={(e) => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), emailList: e.target.value }
                      }
                    }))}
                    rows="3"
                    style={{ marginTop: '5px', width: '100%', fontSize: '13px' }}
                  />
                )}
              </div>
            </div>

            <div className="settings-field" style={{ marginTop: '15px' }}>
              <label>How much time do test takers have to complete the test?</label>
              <p className="settings-hint">The timer starts the moment they enter the test and continues even if they close out of the test.</p>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="editTimeLimitType"
                    value="unlimited"
                    checked={quiz.settings?.accessControl?.timeLimitType === 'unlimited'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), timeLimitType: 'unlimited' }
                      }
                    }))}
                  />
                  <span>Unlimited</span>
                </label>
                <label className="radio-label inline-input-label">
                  <input
                    type="radio"
                    name="editTimeLimitType"
                    value="timed"
                    checked={quiz.settings?.accessControl?.timeLimitType === 'timed'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), timeLimitType: 'timed' }
                      }
                    }))}
                  />
                  <input
                    type="number"
                    min="1"
                    value={quiz.settings?.accessControl?.timeLimitMinutes || 30}
                    onChange={(e) => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { 
                          ...(q.settings?.accessControl || {}), 
                          timeLimitType: 'timed',
                          timeLimitMinutes: parseInt(e.target.value) || 1 
                        }
                      }
                    }))}
                    disabled={quiz.settings?.accessControl?.timeLimitType !== 'timed'}
                    style={{ width: '70px', padding: '4px 8px', margin: '0 6px' }}
                  />
                  <span>minutes</span>
                </label>
              </div>
            </div>

            <div className="settings-field" style={{ marginTop: '15px' }}>
              <label>How many times can someone take your test?</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="editAttemptsType"
                    value="unlimited"
                    checked={quiz.settings?.accessControl?.attemptsType === 'unlimited'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), attemptsType: 'unlimited' }
                      }
                    }))}
                  />
                  <span>Unlimited</span>
                </label>
                <label className="radio-label inline-input-label">
                  <input
                    type="radio"
                    name="editAttemptsType"
                    value="limited"
                    checked={quiz.settings?.accessControl?.attemptsType === 'limited'}
                    onChange={() => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), attemptsType: 'limited' }
                      }
                    }))}
                  />
                  <input
                    type="number"
                    min="1"
                    value={quiz.settings?.accessControl?.maxAttempts || 1}
                    onChange={(e) => setQuiz(q => ({
                      ...q,
                      settings: {
                        ...q.settings,
                        accessControl: { ...(q.settings?.accessControl || {}), maxAttempts: parseInt(e.target.value) || 1 }
                      }
                    }))}
                    disabled={quiz.settings?.accessControl?.attemptsType !== 'limited'}
                    style={{ width: '70px', padding: '4px 8px', margin: '0 6px' }}
                  />
                  <span>times</span>
                </label>
              </div>
            </div>

            <div className="settings-field" style={{ marginTop: '15px' }}>
              <label>What should test takers enter to identify themselves?</label>
              <p className="settings-hint">
                This text appears above the field where the test taker enters their identifier.<br />
                <em>Examples: "Enter your name", "Enter your student ID", or "Please enter your company email address"</em>
              </p>
              <input
                type="text"
                value={quiz.settings?.accessControl?.identifierPrompt || 'Enter your name'}
                onChange={(e) => setQuiz(q => ({
                  ...q,
                  settings: {
                    ...q.settings,
                    accessControl: { ...(q.settings?.accessControl || {}), identifierPrompt: e.target.value }
                  }
                }))}
                placeholder="Enter your name"
              />
            </div>
          </div>

          <button className="btn btn-success btn-block" style={{ marginTop: '20px' }} onClick={handleSaveQuiz}>
            💾 Save Settings
          </button>
        </div>

        <div className="questions-editor">
          <div className="section-header">
            <h2>Questions ({quiz.questions.length})</h2>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                setEditingQuestion(null);
                setShowQuestionForm(true);
              }}
            >
              + Add Question
            </button>
          </div>

          {showQuestionForm && !editingQuestion && (
            <div className="question-form">
              <QuestionForm
                question={null}
                onSave={(updates) => {
                  handleAddQuestion({
                    ...updates,
                    id: `q${Date.now()}`,
                    question: {
                      ...updates.question,
                      html: updates.question.plainText
                    },
                    options: updates.options.map(option => ({
                      ...option,
                      html: option.plainText
                    })),
                    metadata: { confidence: 1, needsReview: updates.correctAnswers.length === 0 }
                  });
                }}
                onCancel={() => {
                  setShowQuestionForm(false);
                }}
              />
            </div>
          )}

          <div className="questions-list">
            {quiz.questions.map((question, index) => {
              const isEditingThis = editingQuestion && editingQuestion.id === question.id;

              if (isEditingThis) {
                return (
                  <div key={question.id} className="question-form" style={{ margin: 0 }}>
                    <QuestionForm
                      question={editingQuestion}
                      onSave={(updates) => {
                        handleUpdateQuestion(editingQuestion.id, updates);
                      }}
                      onCancel={() => {
                        setEditingQuestion(null);
                        setShowQuestionForm(false);
                      }}
                    />
                  </div>
                );
              }

              return (
                <div key={question.id} className="question-item-editor">
                  <div className="question-header-editor">
                    <div>
                      <div className="question-number-editor">Question {index + 1}</div>
                      <div className="question-text-summary">
                        {question.question.plainText || question.question.html}
                      </div>
                    </div>
                    <div className="question-actions-editor">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setEditingQuestion(question);
                          setShowQuestionForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteQuestion(question.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="question-details-summary">
                    {question.options && question.options.length > 0 && (
                      <div className="summary-item">
                        <span className="summary-label">Options:</span>
                        <span>{question.options.length}</span>
                      </div>
                    )}
                    {question.correctAnswers && question.correctAnswers.length > 0 && (
                      <div className="summary-item">
                        <span className="summary-label">Answer:</span>
                        <span>{question.correctAnswers.join(', ')}</span>
                      </div>
                    )}
                    {question.metadata?.needsReview && (
                      <div className="summary-item warning">
                        <span className="warning-badge">⚠️ Needs Review</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {answerModalOpen && (
        <div className="answer-modal-backdrop" role="presentation" onClick={() => setAnswerModalOpen(false)}>
          <section className="answer-modal" role="dialog" aria-modal="true" aria-labelledby="answer-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="answer-modal-header">
              <div>
                <p className="eyebrow">ANSWER SHEET</p>
                <h2 id="answer-modal-title">Add correct answers</h2>
                <p className="settings-hint">Enter the answer letter for each question (e.g. A, B, C, D).</p>
              </div>
              <button className="modal-close" onClick={() => setAnswerModalOpen(false)}>×</button>
            </div>

            <div className="answer-sheet-grid">
              {quiz.questions?.map((question, index) => (
                <div key={question.id || index} className="answer-sheet-row">
                  <span className="question-index">Q{index + 1}</span>
                  <input
                    id={`editor-answer-letter-${index}`}
                    type="text"
                    maxLength={1}
                    value={answers[index] || ''}
                    onChange={(e) => handleAnswerInput(index, e.target.value)}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>

            <div className="answer-modal-footer">
              <button className="btn btn-secondary" onClick={resetAnswers}>Reset All</button>
              <button className="btn btn-primary" onClick={saveAnswerSheet}>Done</button>
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

/**
 * Question Form Component
 */
function QuestionForm({ question, onSave, onCancel }) {
  const [formData, setFormData] = useState(
    question || {
      type: 'multiple_choice',
      question: { html: '', plainText: '' },
      options: [
        { id: 'A', html: '', plainText: '' },
        { id: 'B', html: '', plainText: '' },
        { id: 'C', html: '', plainText: '' },
        { id: 'D', html: '', plainText: '' }
      ],
      correctAnswers: []
    }
  );

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index][field] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleAddOption = () => {
    const nextId = String.fromCharCode(65 + formData.options.length);
    setFormData({
      ...formData,
      options: [
        ...formData.options,
        { id: nextId, html: '', plainText: '' }
      ]
    });
  };

  const handleRemoveOption = (index) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="question-form-content">
      <div className="form-group">
        <label>Question Type</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        >
          <option value="multiple_choice">Multiple Choice</option>
          <option value="multiple_select">Multiple Select</option>
          <option value="true_false">True/False</option>
          <option value="fill_blank">Fill in the Blank</option>
          <option value="short_answer">Short Answer</option>
          <option value="essay">Essay</option>
        </select>
      </div>

      <div className="form-group">
        <label>Question Text</label>
        <textarea
          value={formData.question.plainText}
          onChange={(e) => setFormData({
            ...formData,
            question: { ...formData.question, plainText: e.target.value, html: e.target.value }
          })}
          placeholder="Enter the question"
        />
      </div>

      {(formData.type === 'multiple_choice' || formData.type === 'multiple_select' || formData.type === 'true_false') && (
        <div className="form-group">
          <label>Answer Options</label>
          <div className="options-editor">
            {formData.options.map((option, index) => (
              <div key={index} className="option-input-group">
                <input
                  type="text"
                  value={option.plainText}
                  onChange={(e) => handleOptionChange(index, 'plainText', e.target.value)}
                  placeholder={`Option ${option.id}`}
                  className="option-input"
                />
                <label className="checkbox-correct">
                  <input
                    type="checkbox"
                    checked={formData.correctAnswers.includes(option.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          correctAnswers: [...formData.correctAnswers, option.id]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          correctAnswers: formData.correctAnswers.filter(a => a !== option.id)
                        });
                      }
                    }}
                  />
                  Correct
                </label>
                {formData.options.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemoveOption(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleAddOption}
          >
            + Add Option
          </button>
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" onClick={() => onSave(formData)}>
          Save Question
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default QuizEditor;
