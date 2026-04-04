const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'patients.json');

app.use(express.json());
app.use(express.static(__dirname));

const SEVERITY_SCORE = { critical: 300, severe: 150, moderate: 80, mild: 30 };

function calculatePriority(age, severity) {
  let score = SEVERITY_SCORE[severity] || 0;
  if (age >= 65) {
    score += 40;
    if (age >= 80) score += 15;
  }
  if (age <= 5) score += 20;
  return score;
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { patients: [], nextId: 1 };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all patients
app.get('/api/queue', (req, res) => {
  const data = loadData();
  res.json(data);
});

// POST add patient
app.post('/api/patients', (req, res) => {
  const { name, age, gender, severity, symptoms } = req.body;
  if (!name || !age || !gender || !severity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const data = loadData();
  const parsedAge = parseInt(age, 10);
  const priority = calculatePriority(parsedAge, severity);
  const patient = {
    id: data.nextId++,
    name,
    age: parsedAge,
    gender,
    severity,
    symptoms: symptoms || '',
    priority,
    status: 'waiting',
    arrivedAt: new Date().toISOString()
  };
  data.patients.push(patient);
  saveData(data);
  res.json(patient);
});

// PATCH serve patient
app.patch('/api/patients/:id/serve', (req, res) => {
  const data = loadData();
  const p = data.patients.find(x => x.id === parseInt(req.params.id, 10));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  p.status = 'serving';
  saveData(data);
  res.json(p);
});

// PATCH complete patient
app.patch('/api/patients/:id/complete', (req, res) => {
  const data = loadData();
  const p = data.patients.find(x => x.id === parseInt(req.params.id, 10));
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  p.status = 'done';
  saveData(data);
  res.json(p);
});

// DELETE completed patients — must be before /:id route
app.delete('/api/patients/completed', (req, res) => {
  const data = loadData();
  data.patients = data.patients.filter(p => p.status !== 'done');
  saveData(data);
  res.json({ success: true });
});

// DELETE all patients
app.delete('/api/patients', (req, res) => {
  const data = loadData();
  data.patients = [];
  saveData(data);
  res.json({ success: true });
});

// DELETE single patient
app.delete('/api/patients/:id', (req, res) => {
  const data = loadData();
  const before = data.patients.length;
  data.patients = data.patients.filter(x => x.id !== parseInt(req.params.id, 10));
  if (data.patients.length === before) return res.status(404).json({ error: 'Patient not found' });
  saveData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`CareFirst server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/home.html to view the app`);
});
