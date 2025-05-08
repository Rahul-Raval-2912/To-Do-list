const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.static('public')); // Serve public directory
app.get('/', (req, res) => {
  console.log('Serving To_Do.html for /');
  res.sendFile(path.join(__dirname, 'public', 'To_Do.html')); // Serve To_Do.html for root
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

// Email transport configuration using suggested settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'todol6564@gmail.com',
    pass: 'trebnwfvggcskfts'
  }
});

// Verify email transport configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transport verification failed:', error);
  } else {
    console.log('Email transport ready');
  }
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  console.log('Signup attempt:', { email });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
    console.log('Signup successful:', { userId: result.insertId, email });
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Error creating user' });
    }
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email });
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    console.log('Users found:', users.length);
    if (users.length === 0) {
      console.log('Login failed: User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
      console.log('Login failed: Incorrect password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful:', { userId: user.id, token: token.substring(0, 20) + '...' });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

app.get('/tasks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('GET /tasks - No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE userId = ?', [userId]);
    res.json(tasks);
  } catch (error) {
    console.error('GET /tasks - Error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/tasks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { text, urgent, dueTime } = req.body;
  console.log('POST /tasks - Request:', { text, urgent, dueTime, token: token?.substring(0, 20) + '...' });
  if (!token) {
    console.log('POST /tasks - No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    console.log('POST /tasks - Verified userId:', userId);
    // Validate dueTime format (HH:MM or null)
    const validDueTime = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : null;
    console.log('POST /tasks - Validated dueTime:', validDueTime);
    const [result] = await pool.query(
      'INSERT INTO tasks (text, urgent, dueTime, userId) VALUES (?, ?, ?, ?)',
      [text, urgent, validDueTime, userId]
    );
    console.log('POST /tasks - Task added:', { id: result.insertId, text, urgent, dueTime: validDueTime });
    if (urgent && validDueTime) {
      scheduleReminder(result.insertId, text, urgent, validDueTime, userId);
    }
    res.status(201).json({ id: result.insertId, text, urgent, dueTime: validDueTime, completed: false, userId });
  } catch (error) {
    console.error('POST /tasks - Error:', error);
    res.status(500).json({ error: 'Error adding task: ' + error.message });
  }
});

app.put('/tasks/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { id } = req.params;
  const { completed } = req.body;
  if (!token) {
    console.log('PUT /tasks/:id - No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const [result] = await pool.query('UPDATE tasks SET completed = ? WHERE id = ? AND userId = ?', [completed, id, userId]);
    console.log(`PUT /tasks/${id} - Result:`, result);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Task not found or not authorized' });
    }
    res.json({ message: 'Task updated' });
  } catch (error) {
    console.error('PUT /tasks/:id - Error:', error);
    res.status(500).json({ error: 'Error updating task' });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { id } = req.params;
  if (!token) {
    console.log('DELETE /tasks/:id - No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ? AND userId = ?', [id, userId]);
    console.log(`DELETE /tasks/${id} - Result:`, result);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Task not found or not authorized' });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('DELETE /tasks/:id - Error:', error);
    res.status(500).json({ error: 'Error deleting task' });
  }
});

async function scheduleReminder(taskId, text, urgent, dueTime, userId) {
  if (!urgent || !dueTime) {
    console.log(`No reminder scheduled for task ${taskId}: not urgent or no dueTime`);
    return;
  }
  try {
    const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      console.log(`No user found for userId ${userId}`);
      return;
    }
    const email = users[0].email;

    // Parse dueTime (e.g., "02:00" for 2:00 AM)
    const [hours, minutes] = dueTime.split(':').map(Number);
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setHours(hours, minutes, 0, 0);

    // If dueTime is earlier today, set to tomorrow
    if (dueDate < now) {
      dueDate.setDate(dueDate.getDate() + 1);
    }

    // Schedule reminder 5 minutes before dueTime
    const reminderTime = new Date(dueDate.getTime() - 5 * 60 * 1000);
    const delay = reminderTime.getTime() - now.getTime();

    if (delay < 0) {
      console.log(`Reminder for task ${taskId} skipped: dueTime in the past`);
      return;
    }

    console.log(`Scheduling reminder for task ${taskId} at ${reminderTime} to ${email}`);
    setTimeout(async () => {
      try {
        const [tasks] = await pool.query('SELECT completed FROM tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0 || tasks[0].completed) {
          console.log(`Reminder for task ${taskId} skipped: task completed or deleted`);
          return;
        }
        const mailOptions = {
          from: 'todol6564@gmail.com',
          to: email,
          subject: 'Urgent Task Reminder',
          text: `Reminder: Your urgent task "${text}" is due at ${dueTime}.`
        };
        console.log(`Sending reminder for task ${taskId} to ${email}`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`Reminder email sent for task ${taskId} to ${email}: ${info.response}`);
      } catch (error) {
        console.error(`Error sending reminder for task ${taskId}:`, error);
      }
    }, delay);
  } catch (error) {
    console.error(`Error scheduling reminder for task ${taskId}:`, error);
  }
}

// Initialize reminders for existing urgent tasks on server start
async function initializeReminders() {
  try {
    const [tasks] = await pool.query(`
      SELECT t.id, t.text, t.urgent, t.dueTime, t.userId
      FROM tasks t
      WHERE t.urgent = TRUE AND t.completed = FALSE AND t.dueTime IS NOT NULL
    `);
    console.log(`Found ${tasks.length} urgent tasks with dueTime for reminders`);
    for (const task of tasks) {
      scheduleReminder(task.id, task.text, task.urgent, task.dueTime, task.userId);
    }
  } catch (error) {
    console.error('Error initializing reminders:', error);
  }
}

initializeReminders();

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});