// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const DB_FILE = path.join(__dirname, 'database.sqlite');
const SEED_SQL = path.join(__dirname, 'seed', 'seed.sql');

// Create or open database
const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) return console.error('Failed to open DB:', err.message);
  if (!dbExists) console.log('Database file created:', DB_FILE);
});

// Initialize DB using seed SQL (if the file exists)
if (fs.existsSync(SEED_SQL)) {
  const seedSql = fs.readFileSync(SEED_SQL, 'utf8');
  db.exec(seedSql, (err) => {
    if (err) console.error('Error running seed SQL:', err.message);
    else if (!dbExists) console.log('Database initialized from seed/seed.sql');
  });
} else {
  console.warn('Warning: seed/seed.sql not found. Database tables may not be created.');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/courses
app.get('/api/courses', (req, res) => {
  db.all('SELECT id, code, title, capacity FROM courses', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/register
// body: { name, email, course_id }
app.post('/api/register', (req, res) => {
  const { name, email, course_id } = req.body;
  if (!name || !email || !course_id) {
    return res.status(400).json({ error: 'Missing name, email or course_id' });
  }

  db.serialize(() => {
    // 1) Ensure student exists (or create)
    db.get('SELECT id FROM students WHERE email = ?', [email], (err, studentRow) => {
      if (err) return res.status(500).json({ error: err.message });

      const createStudentIfNeeded = (cb) => {
        if (studentRow && studentRow.id) return cb(studentRow.id);
        db.run('INSERT INTO students(name,email) VALUES(?,?)', [name, email], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          cb(this.lastID);
        });
      };

      createStudentIfNeeded((studentId) => {
        // 2) Check course exists and capacity
        db.get('SELECT capacity FROM courses WHERE id = ?', [course_id], (err, courseRow) => {
          if (err) return res.status(500).json({ error: err.message });
          if (!courseRow) return res.status(400).json({ error: 'Course not found' });

          db.get('SELECT COUNT(*) as cnt FROM registrations WHERE course_id = ?', [course_id], (err, cntRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (cntRow.cnt >= courseRow.capacity) {
              return res.status(400).json({ error: 'Course is full' });
            }

            // 3) Insert registration
            db.run('INSERT INTO registrations(student_id, course_id) VALUES(?, ?)', [studentId, course_id], function (err) {
              if (err) return res.status(500).json({ error: err.message });
              return res.json({ success: true, registration_id: this.lastID });
            });
          });
        });
      });
    });
  });
});

// Optional: simple status endpoint
app.get('/api/status', (req, res) => res.json({ ok: true }));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
// Add near other API endpoints
app.get('/api/registrations-count', (req, res) => {
  db.get('SELECT COUNT(*) as cnt FROM registrations', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row ? row.cnt : 0 });
  });
});
