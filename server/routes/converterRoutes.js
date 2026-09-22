import express from 'express';
import multer from 'multer';
import axios from 'axios';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const conversions = {
  'word-to-pdf': { input: ['doc', 'docx'], output: 'pdf' },
  'pdf-to-word': { input: ['pdf'], output: 'docx' },
  'pdf-to-excel': { input: ['pdf'], output: 'xlsx' },
  'excel-to-pdf': { input: ['xls', 'xlsx'], output: 'pdf' },
  'powerpoint-to-pdf': { input: ['ppt', 'pptx'], output: 'pdf' },
  'pdf-to-powerpoint': { input: ['pdf'], output: 'pptx' }
};

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const getExtension = filename => filename.toLowerCase().split('.').pop();

router.post('/:conversion', upload.single('file'), async (req, res) => {
  const config = conversions[req.params.conversion];
  const apiKey = process.env.CLOUDCONVERT_API_KEY;

  if (!config) {
    return res.status(404).json({ error: 'Unsupported conversion' });
  }

  if (!apiKey) {
    return res.status(503).json({
      error: 'CloudConvert is not configured',
      details: 'Set CLOUDCONVERT_API_KEY in the server environment.'
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!config.input.includes(getExtension(req.file.originalname))) {
    return res.status(400).json({
      error: `This conversion accepts: ${config.input.map(extension => `.${extension}`).join(', ')}`
    });
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const jobResponse = await axios.post('https://api.cloudconvert.com/v2/jobs', {
      tasks: {
        'import-file': { operation: 'import/upload' },
        convert: {
          operation: 'convert',
          input: 'import-file',
          output_format: config.output
        },
        'export-file': { operation: 'export/url', input: 'convert' }
      }
    }, { headers });

    const job = jobResponse.data.data;
    const importTask = job.tasks.find(task => task.name === 'import-file');
    const uploadUrl = importTask.result?.form?.url;
    const uploadParameters = importTask.result?.form?.parameters || {};

    if (!uploadUrl) {
      throw new Error('CloudConvert did not return an upload URL');
    }

    const formData = new FormData();
    Object.entries(uploadParameters).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData });

    if (!uploadResponse.ok) {
      throw new Error(`CloudConvert upload failed with status ${uploadResponse.status}`);
    }

    let completedJob;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(1000);
      const statusResponse = await axios.get(`https://api.cloudconvert.com/v2/jobs/${job.id}`, {
        headers,
        params: { include: 'tasks' }
      });
      completedJob = statusResponse.data.data;
      if (completedJob.status === 'finished' || completedJob.status === 'error') break;
    }

    if (!completedJob || completedJob.status !== 'finished') {
      throw new Error('CloudConvert timed out or reported an error');
    }

    const exportTask = completedJob.tasks.find(task => task.name === 'export-file');
    const outputFile = exportTask?.result?.files?.[0];
    if (!outputFile?.url) {
      throw new Error('CloudConvert did not return a converted file');
    }

    const convertedFile = await axios.get(outputFile.url, { responseType: 'arraybuffer' });
    const outputName = `${req.file.originalname.replace(/\.[^.]+$/, '')}.${config.output}`;
    res.setHeader('Content-Type', convertedFile.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    return res.send(Buffer.from(convertedFile.data));
  } catch (error) {
    const details = error.response?.data?.message || error.message;
    console.error('Conversion error:', details);
    return res.status(502).json({ error: 'File conversion failed', details });
  }
});

export default router;
