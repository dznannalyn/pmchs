import React from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './FileConverter.css';

const conversionLabels = {
  'word-to-pdf': 'Word to PDF',
  'pdf-to-word': 'PDF to Word',
  'pdf-to-excel': 'PDF to Excel',
  'excel-to-pdf': 'Excel to PDF',
  'powerpoint-to-pdf': 'PowerPoint to PDF',
  'pdf-to-powerpoint': 'PDF to PowerPoint'
};

function FileConverter() {
  const { conversion } = useParams();
  const conversionLabel = conversionLabels[conversion];
  const [file, setFile] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [converting, setConverting] = React.useState(false);

  if (!conversion) {
    return (
      <section className="file-converter-page">
        <div className="file-converter-header">
          <p className="file-converter-eyebrow">File converter</p>
          <h1>Choose a conversion</h1>
          <p>Select the file conversion you want to use.</p>
        </div>
        <div className="conversion-grid">
          {Object.entries(conversionLabels).map(([key, label]) => (
            <Link key={key} to={`/converter/${key}`} className="conversion-card">
              <span className="conversion-card-icon">⇄</span>
              <span>{label}</span>
              <small>Open converter</small>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  const handleConvert = async event => {
    event.preventDefault();
    if (!file) {
      setStatus('Choose a file first.');
      return;
    }

    setConverting(true);
    setStatus('Converting file...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`/api/converter/${conversion}`, formData, {
        responseType: 'blob'
      });
      const downloadUrl = window.URL.createObjectURL(response.data);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${file.name.replace(/\.[^.]+$/, '')}.${conversion.endsWith('word') ? 'docx' : conversion.endsWith('excel') ? 'xlsx' : conversion.endsWith('powerpoint') ? 'pptx' : 'pdf'}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setStatus('Conversion complete.');
    } catch (error) {
      const errorText = error.response?.data instanceof Blob
        ? await error.response.data.text()
        : '';
      let message = 'Conversion failed.';
      try {
        message = JSON.parse(errorText).details || JSON.parse(errorText).error || message;
      } catch (parseError) {
        // Keep the generic message when the server response is not JSON.
      }
      setStatus(message);
    } finally {
      setConverting(false);
    }
  };

  return (
    <section className="file-converter-page">
      <div className="file-converter-header">
        <Link to="/converter" className="converter-back-link">← Back to converters</Link>
        <p className="file-converter-eyebrow">File converter</p>
        <h1>{conversionLabel}</h1>
        <p>Select a file to convert it to the requested format.</p>
      </div>
      <form className="file-converter-upload" onSubmit={handleConvert}>
        <label htmlFor="converter-file">Choose a file</label>
        <input id="converter-file" type="file" onChange={event => setFile(event.target.files[0] || null)} />
        <button
          type="submit"
          className={file && !converting ? 'convert-button is-ready' : 'convert-button'}
          disabled={!file || converting}
        >
          {converting ? 'Converting...' : 'Convert file'}
        </button>
        {file && <span>Selected: {file.name}</span>}
        {status && <span className="converter-status">{status}</span>}
      </form>
      {converting && (
        <div className="converter-loading-overlay" role="status" aria-live="polite">
          <div className="converter-loading-dialog">
            <div className="converter-spinner" aria-hidden="true"></div>
            <strong>Converting your file</strong>
            <span>Please wait while the conversion finishes.</span>
          </div>
        </div>
      )}
    </section>
  );
}

export default FileConverter;