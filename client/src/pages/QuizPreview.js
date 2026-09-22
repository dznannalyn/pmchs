import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './QuizPreview.css';

function QuizPreview({ user }) {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  const fetchQuiz = async () => {
    try {
      const response = await axios.get(`/api/quizzes/${quizId}`);
      setQuiz(response.data);
    } catch (err) {
      setError('Failed to load quiz');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      const response = await axios.post(`/api/quizzes/${quizId}/publish`);
      alert(`Quiz published! Link: ${response.data.quizLink}`);
      setQuiz({ ...quiz, isPublished: true });
    } catch (err) {
      alert('Failed to publish quiz');
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

  return (
    <div className="quiz-preview-container">
      <div className="preview-header">
        <button className="btn btn-secondary" onClick={() => navigate('/') }>
          ← Back to Dashboard
        </button>
        <h1>{quiz.title}</h1>
        {quiz.isPublished && <span className="published-badge">Published</span>}
      </div>

      <div className="quiz-stats">
        <div className="stat">
          <span className="stat-value">{quiz.questions.length}</span>
          <span className="stat-label">Total Questions</span>
        </div>
      </div>

      <div className="preview-actions">
        <button className="btn btn-secondary" onClick={() => navigate(`/quiz/${quizId}/edit`)}>
          ✏️ Edit Quiz
        </button>
        {!quiz.isPublished && (
          <button className="btn btn-success" onClick={handlePublish}>
            🚀 Publish Quiz
          </button>
        )}
      </div>

      <div className="questions-preview">
        {quiz.questions.map((question, index) => (
          <div key={question.id} className="question-preview">
            <div className="question-number">Question {index + 1}</div>

            <div className="question-text" dangerouslySetInnerHTML={{ __html: question.question.html }} />

            {question.subStatements && question.subStatements.length > 0 && (
              <div className="sub-statements">
                <div className="sub-statements-label">Statements:</div>
                <ol className="sub-statements-list">
                  {question.subStatements.map((stmt, idx) => (
                    <li key={idx} dangerouslySetInnerHTML={{ __html: stmt.html }} />
                  ))}
                </ol>
              </div>
            )}

            {question.type === 'true_false' ? (
              <div className="options-preview">
                <label className="option-radio">
                  <input type="radio" name={`q${question.id}`} />
                  <span>True</span>
                </label>
                <label className="option-radio">
                  <input type="radio" name={`q${question.id}`} />
                  <span>False</span>
                </label>
              </div>
            ) : question.type === 'essay' || question.type === 'short_answer' ? (
              <textarea className="textarea-preview" placeholder="Your answer here..." readOnly disabled />
            ) : (
              <div className="options-preview">
                {question.options.map((option) => (
                  <label key={option.id} className="option-choice">
                    <input
                      type={question.type === 'multiple_select' ? 'checkbox' : 'radio'}
                      name={`q${question.id}`}
                      disabled
                    />
                    <span dangerouslySetInnerHTML={{ __html: option.html }} />
                  </label>
                ))}
              </div>
            )}

            {question.correctAnswers.length > 0 && (
              <div className="answer-key">
                <strong>Correct Answer:</strong>{' '}
                {question.correctAnswers.map(answerId => {
                  const option = question.options.find(o => o.id === answerId);
                  return option ? option.plainText : answerId;
                }).join(', ')}
              </div>
            )}

            {question.metadata?.needsReview && (
              <div className="alert alert-warning">
                ⚠️ This question needs review
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="preview-footer">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        {!quiz.isPublished && (
          <button className="btn btn-success" onClick={handlePublish}>
            🚀 Publish Quiz
          </button>
        )}
      </div>
    </div>
  );
}

export default QuizPreview;
