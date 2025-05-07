const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const port = 3000;

// Middleware
app.use(express.static('public'));
app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Nodemailer Transporter
const nm = require('nodemailer');
const transporter = nm.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Reminder System: Send email for urgent tasks every 30 seconds
setInterval(async () => {
  try {
    const [tasks] = await pool.query(`
      SELECT t.text, u.email
      FROM tasks t
      JOIN users u ON t.userId = u.id
      WHERE t.urgent = TRUE AND t.completed = FALSE
    `);
    for (const task of tasks) {
      const mailoptions = {
        from: process.env.EMAIL_USER,
        to: task.email,
        subject: `Reminder: Urgent Task "${task.text}"`,
        text: `This is a reminder for your urgent task: "${task.text}". Please complete it soon!`
      };
      try {
        const info = await new Promise((resolve, reject) => {
          transporter.sendMail(mailoptions, (error, info) => {
            if (error) reject(error);
            else resolve(info);
          });
        });
        console.log(`Email sent for task "${task.text}": ${info.response}`);
      } catch (error) {
        console.error(`Error sending email for task "${task.text}": ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error fetching urgent tasks:', error);
  }
}, 30 * 1000);

// Middleware to verify JWT
const authenticate = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Signup Endpoint
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login Endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const [users] = await pool.query('SELECT id, email, password FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all tasks for authenticated user
app.get('/tasks', authenticate, async (req, res) => {
  try {
    const [tasks] = await pool.query('SELECT id AS _id, text, urgent, completed, userId FROM tasks WHERE userId = ?', [req.userId]);
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST a new task
app.post('/tasks', authenticate, async (req, res) => {
  const { text, urgent } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Task text is required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO tasks (text, urgent, completed, userId) VALUES (?, ?, ?, ?)',
      [text, urgent || false, false, req.userId]
    );
    const task = { _id: result.insertId, text, urgent: urgent || false, completed: false, userId: req.userId };
    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT to toggle task completion
app.put('/tasks/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    const [tasks] = await pool.query('SELECT id, completed FROM tasks WHERE id = ? AND userId = ?', [id, req.userId]);
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const completed = !tasks[0].completed;
    await pool.query('UPDATE tasks SET completed = ? WHERE id = ?', [completed, id]);
    const task = { _id: id, text: tasks[0].text, urgent: tasks[0].urgent, completed, userId: req.userId };
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a task
app.delete('/tasks/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ? AND userId = ?', [id, req.userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});