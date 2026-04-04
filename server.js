const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// Create patients table if it doesn't exist
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      severity TEXT NOT NULL,
      symptoms TEXT,
      priority INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      arrived_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Database ready.');
}

// GET all patients
app.get('/api/queue', async (req, res) => {
  const result = await pool.query('SELECT * FROM patients ORDER BY id ASC');
  const patients = result.rows.map(r => ({
    id: r.id,
    name: r.name,
    age: r.age,
    gender: r.gender,
    severity: r.severity,
    symptoms: r.symptoms,
    priority: r.priority,
    status: r.status,
    arrivedAt: r.arrived_at
  }));
  res.json({ patients });
});

// POST add patient
app.post('/api/patients', async (req, res) => {
  const { name, age, gender, severity, symptoms } = req.body;
  if (!name || !age || !gender || !severity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const parsedAge = parseInt(age, 10);
  const priority = calculatePriority(parsedAge, severity);
  const result = await pool.query(
    `INSERT INTO patients (name, age, gender, severity, symptoms, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'waiting') RETURNING *`,
    [name, parsedAge, gender, severity, symptoms || '', priority]
  );
  const r = result.rows[0];
  res.json({ id: r.id, name: r.name, age: r.age, gender: r.gender, severity: r.severity, symptoms: r.symptoms, priority: r.priority, status: r.status, arrivedAt: r.arrived_at });
});

// PATCH serve patient
app.patch('/api/patients/:id/serve', async (req, res) => {
  const result = await pool.query(
    `UPDATE patients SET status = 'serving' WHERE id = $1 RETURNING *`,
    [parseInt(req.params.id, 10)]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
  res.json(result.rows[0]);
});

// PATCH complete patient
app.patch('/api/patients/:id/complete', async (req, res) => {
  const result = await pool.query(
    `UPDATE patients SET status = 'done' WHERE id = $1 RETURNING *`,
    [parseInt(req.params.id, 10)]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
  res.json(result.rows[0]);
});

// DELETE completed patients
app.delete('/api/patients/completed', async (req, res) => {
  await pool.query(`DELETE FROM patients WHERE status = 'done'`);
  res.json({ success: true });
});

// DELETE all patients
app.delete('/api/patients', async (req, res) => {
  await pool.query(`DELETE FROM patients`);
  res.json({ success: true });
});

// DELETE single patient
app.delete('/api/patients/:id', async (req, res) => {
  const result = await pool.query(
    `DELETE FROM patients WHERE id = $1 RETURNING id`,
    [parseInt(req.params.id, 10)]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
  res.json({ success: true });
});

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`CareFirst server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});
