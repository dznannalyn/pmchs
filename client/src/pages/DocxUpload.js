import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './DocxUpload.css';
import Dashboard from './Dashboard';

function DocxUpload({ user }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseStage, setParseStage] = useState('');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const progressIntervalRef = useRef(null);

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (!selectedFile.name.endsWith('.docx')) {
        setError('Only .docx files are accepted');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  }, []);

  const { getInputProps, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    setParseStage('Uploading document to server...');
    setCompletedSteps([]);
    setError(null);

    // Start progress simulation for server processing phase
    let currentPct = 5;
    const startProgressSimulation = () => {
      setCompletedSteps(['upload']);
      setParseStage('Reading document structure...');
      currentPct = 30;
      setUploadProgress(30);

      progressIntervalRef.current = setInterval(() => {
        currentPct += Math.floor(Math.random() * 3) + 1; // Increment smoothly by 1-3%
        
        if (currentPct >= 30 && currentPct < 55) {
          setParseStage('Analyzing document structure...');
        } else if (currentPct >= 55 && currentPct < 78) {
          setCompletedSteps(['upload', 'structure']);
          setParseStage('Extracting questions, options & answer keys...');
        } else if (currentPct >= 78 && currentPct < 92) {
          setCompletedSteps(['upload', 'structure', 'extract']);
          setParseStage('Validating question formatting & choices...');
        } else if (currentPct >= 92 && currentPct < 98) {
          setParseStage('Preparing interactive quiz preview...');
        }

        if (currentPct >= 98) {
          currentPct = 98; // Cap at 98% until server finishes
        }

        setUploadProgress(currentPct);
      }, 350);
    };

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'user-id': user?.id || 'anonymous'
        },
        onUploadProgress: (progressEvent) => {
          const rawPct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Map file upload to 5% -> 30% range
          const mappedPct = Math.min(30, Math.max(5, Math.round(5 + (rawPct * 0.25))));
          setUploadProgress(mappedPct);

          if (rawPct >= 100 && !progressIntervalRef.current) {
            startProgressSimulation();
          }
        }
      });

      // Clear interval when server completes
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      if (response.data.success) {
        setUploadProgress(100);
        setCompletedSteps(['upload', 'structure', 'extract', 'preview']);
        setParseStage('✓ Generation complete!');
        setSuccess(`✓ Successfully parsed ${response.data.totalQuestionsDetected} questions`);

        setTimeout(() => {
          navigate('/import-preview', {
            state: {
              importId: response.data.importId,
              filename: response.data.filename,
              questions: response.data.questions,
              totalDetected: response.data.totalQuestionsDetected,
              needsReview: response.data.questionsNeedingReview,
              issues: response.data.issues
            }
          });
        }, 1000);
      }
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      const responseError = err.response?.data;
      setError(
        responseError?.details
          ? `${responseError.error}: ${responseError.details}`
          : responseError?.error || 'Failed to upload file'
      );
    } finally {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setUploading(false);
    }
  };

  const handleClear = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setFile(null);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);
    setParseStage('');
    setCompletedSteps([]);
  };

  return (
    <div className="docx-upload-page">
      <div className="docx-upload-grid">
        
        {/* Left Column: Made quizzes */}
        <div className="upload-info-column made-quizzes-column">
          <h2 className="manage-quizzes-heading">MANAGE QUIZZES</h2>
          <Dashboard user={user} hideHeader />
        </div>

        {/* Right Column: Dropzone & Realtime Progress */}
        <div className="upload-action-column card">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <input {...getInputProps()} />
          {file && <span className="file-name compact-file-name">{file.name}</span>}

          {/* Real-time Progress Bar & Step Tracker */}
          {uploading && (
            <div className="premium-progress">
              <div className="progress-header">
                <span className="progress-text">{parseStage}</span>
                <span className="progress-percentage">{uploadProgress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill animated-bar" style={{ width: `${uploadProgress}%` }}></div>
              </div>

              {/* Step Checklist */}
              <div className="progress-steps-checklist">
                <div className={`step-check-item ${completedSteps.includes('upload') ? 'done' : 'active'}`}>
                  <span className="step-check-icon">{completedSteps.includes('upload') ? '✓' : '⚙️'}</span>
                  <span>Upload & Reading Document</span>
                </div>
                <div className={`step-check-item ${completedSteps.includes('structure') ? 'done' : completedSteps.includes('upload') ? 'active' : ''}`}>
                  <span className="step-check-icon">{completedSteps.includes('structure') ? '✓' : completedSteps.includes('upload') ? '⚙️' : '○'}</span>
                  <span>Extracting Questions & Options</span>
                </div>
                <div className={`step-check-item ${completedSteps.includes('extract') ? 'done' : completedSteps.includes('structure') ? 'active' : ''}`}>
                  <span className="step-check-icon">{completedSteps.includes('extract') ? '✓' : completedSteps.includes('structure') ? '⚙️' : '○'}</span>
                  <span>Validating Answer Keys & Formatting</span>
                </div>
                <div className={`step-check-item ${completedSteps.includes('preview') ? 'done' : completedSteps.includes('extract') ? 'active' : ''}`}>
                  <span className="step-check-icon">{completedSteps.includes('preview') ? '✓' : completedSteps.includes('extract') ? '⚙️' : '○'}</span>
                  <span>Readying Quiz Preview</span>
                </div>
              </div>
            </div>
          )}

          <div className="button-group">
            {file && !uploading && (
              <button className="btn btn-secondary clear-btn" onClick={handleClear} style={{ flex: 1 }}>
                Clear
              </button>
            )}
            
            {!file ? (
              <button
                className="btn btn-primary generate-btn"
                onClick={open}
                style={{ flex: 2 }}
              >
                Upload File
              </button>
            ) : (
              <button
                className="btn btn-primary generate-btn"
                onClick={handleUpload}
                disabled={uploading}
                style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
              >
                {uploading ? (
                  <>
                    <div className="button-spinner"></div>
                    Generating... ({uploadProgress}%)
                  </>
                ) : 'Generate Quiz'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default DocxUpload;
