const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.static('public')); // Serve public directory
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/To_Do.html'); // Serve To_Do.html for root
});
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
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
    res.status(500).json({ error: 'Error logging in' });
  }
});

app.get('/tasks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE userId = ?', [userId]);
    res.json(tasks);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/tasks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { text, urgent } = req.body;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const [result] = await pool.query('INSERT INTO tasks (text, urgent, userId) VALUES (?, ?, ?)', [text, urgent, userId]);
    res.status(201).json({ id: result.insertId, text, urgent, completed: false, userId });
  } catch (error) {
    res.status(500).json({ error: 'Error adding task' });
  }
});

app.put('/tasks/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { id } = req.params;
  const { completed } = req.body;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    await pool.query('UPDATE tasks SET completed = ? WHERE id = ? AND userId = ?', [completed, id, userId]);
    res.json({ message: 'Task updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating task' });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { id } = req.params;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    await pool.query('DELETE FROM tasks WHERE id = ? AND userId = ?', [id, userId]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting task' });
  }
});

setInterval(async () => {
  try {
    const [tasks] = await pool.query(`
      SELECT t.text, u.email
      FROM tasks t
      JOIN users u ON t.userId = u.id
      WHERE t.urgent = TRUE AND t.completed = FALSE
    `);
    for (const task of tasks) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: task.email,
        subject: 'Urgent Task Reminder',
        text: `Don't forget to complete your urgent task: ${task.text}`
      });
    }
  } catch (error) {
    console.error('Error fetching urgent tasks:', error);
  }
}, 30 * 1000);

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});