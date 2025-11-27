// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'verysecretkey123';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'database.sqlite');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;
async function initDb(){
  db = await open({ filename: DB_FILE, driver: sqlite3.Database });

  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'student',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      title TEXT,
      description TEXT,
      seats INTEGER DEFAULT 30,
      instructorEmail TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER,
      courseId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(studentId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(courseId) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE(studentId, courseId)
    );
  `);

  const usersCount = await db.get(`SELECT COUNT(*) as c FROM users`);
  if (usersCount.c === 0) {
    console.log('Seeding default users and courses...');
    const adminPass = await bcrypt.hash('pass1234', 10);
    const instrPass = await bcrypt.hash('9052141823', 10);
    const studentPass = await bcrypt.hash('student123', 10);

    await db.run(`INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`, ['Admin', 'admin@example.com', adminPass, 'admin']);
    await db.run(`INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`, ['Instructor', 'gforget92@gmail.com', instrPass, 'instructor']);
    await db.run(`INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`, ['Student', 'student@example.com', studentPass, 'student']);

    const courses = [
      ['CS101','Intro to Computer Science','Basics of computing',50,'gforget92@gmail.com'],
      ['EE201','Circuit Theory','Circuit analysis and methods',40,'gforget92@gmail.com'],
      ['MA101','Calculus I','Differential calculus',60,'gforget92@gmail.com']
    ];
    const stmt = await db.prepare(`INSERT INTO courses (code, title, description, seats, instructorEmail) VALUES (?,?,?,?,?)`);
    for (const c of courses) { await stmt.run(c); }
    await stmt.finalize();
    console.log('Seeding finished.');
  } else {
    console.log('DB already has users, skipping seed.');
  }
}

function signToken(user){ return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' }); }

function authMiddleware(roles = []) {
  if (typeof roles === 'string') roles = [roles];
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: 'No token provided' });
    const token = header.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await db.get('SELECT id,name,email,role FROM users WHERE id = ?', [payload.id]);
      if (!user) return res.status(401).json({ message: 'User not found' });
      if (roles.length && !roles.includes(user.role)) return res.status(403).json({ message: 'Forbidden' });
      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

// ping
app.get('/api/ping', (req, res) => res.json({ ok: true, msg: 'Deccan College API' }));

// auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ message: 'Email already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const r = await db.run('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)', [name || 'User', email, hashed, 'student']);
    const user = { id: r.lastID, name: name || 'User', email, role: 'student' };
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userRow = await db.get('SELECT id,name,email,password,role FROM users WHERE email = ?', [email]);
    if (!userRow) return res.status(400).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, userRow.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
    const user = { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role };
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// courses list
app.get('/api/courses', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM courses ORDER BY title COLLATE NOCASE');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// create course (admin)
app.post('/api/courses', authMiddleware('admin'), async (req, res) => {
  try {
    const { code, title, description, seats, instructorEmail } = req.body;
    if (!code || !title) return res.status(400).json({ message: 'Code and title required' });
    await db.run('INSERT INTO courses (code,title,description,seats,instructorEmail) VALUES (?,?,?,?,?)', [code, title, description || '', seats || 30, instructorEmail || '']);
    const added = await db.get('SELECT * FROM courses WHERE code = ?', [code]);
    res.json(added);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ message: 'Course code exists' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// update course (admin)
app.put('/api/courses/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, title, description, seats, instructorEmail } = req.body;
    await db.run(
      `UPDATE courses SET code = ?, title = ?, description = ?, seats = ?, instructorEmail = ? WHERE id = ?`,
      [code, title, description || '', seats || 30, instructorEmail || '', id]
    );
    const updated = await db.get('SELECT * FROM courses WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// delete course (admin)
app.delete('/api/courses/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM courses WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// register for a course (student)
app.post('/api/register/:courseId', authMiddleware('student'), async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const regCount = await db.get('SELECT COUNT(*) as c FROM registrations WHERE courseId = ?', [courseId]);
    if (course.seats && regCount.c >= course.seats) return res.status(400).json({ message: 'No seats left' });

    try {
      await db.run('INSERT INTO registrations (studentId,courseId) VALUES (?,?)', [req.user.id, courseId]);
      return res.json({ message: 'Registered' });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ message: 'Already registered' });
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// my registrations
app.get('/api/registration/my', authMiddleware('student'), async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT r.id as regId, r.createdAt as registeredAt, c.id as courseId, c.code, c.title, c.description, c.seats, c.instructorEmail
      FROM registrations r
      JOIN courses c ON r.courseId = c.id
      WHERE r.studentId = ?
      ORDER BY r.createdAt DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// fallback for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ message: 'API route not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// start
const PORT = process.env.PORT || 5000;
initDb().then(()=> {
  app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
}).catch(err => {
  console.error('Failed to init DB', err);
  process.exit(1);
});
