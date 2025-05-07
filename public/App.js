document.addEventListener('DOMContentLoaded', checkAuth);

function checkAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('todoSection').classList.remove('hidden');
    loadTasks();
  } else {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('todoSection').classList.add('hidden');
    showSignup();
  }
}

function showSignup() {
  document.getElementById('signupForm').classList.remove('hidden');
  document.getElementById('loginForm').classList.add('hidden');
}

function showLogin() {
  document.getElementById('signupForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
}

async function signup() {
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  if (!email || !password) {
    alert('Please enter email and password');
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Signup failed');
    alert('Signup successful! Please log in.');
    showLogin();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!email || !password) {
    alert('Please enter email and password');
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('token', data.token);
    checkAuth();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

function logout() {
  localStorage.removeItem('token');
  checkAuth();
}

async function addTask() {
  const taskInput = document.getElementById('taskInput');
  const urgentInput = document.getElementById('urgentInput');
  const text = taskInput.value.trim();
  if (text === '') return;
  try {
    const response = await fetch('http://localhost:3000/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text, urgent: urgentInput.checked })
    });
    if (!response.ok) throw new Error('Failed to add task');
    const newTask = await response.json();
    renderTask(newTask);
    taskInput.value = '';
    urgentInput.checked = false;
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

function renderTask(task) {
  const taskList = document.getElementById('taskList');
  const li = document.createElement('li');
  li.className = 'flex items-center justify-between p-2 bg-gray-50 rounded-lg';
  li.dataset.id = task._id;
  li.innerHTML = `
    <div class="flex items-center">
      <input
        type="checkbox"
        ${task.completed ? 'checked' : ''}
        onchange="toggleTask('${task._id}')"
        class="mr-2"
      />
      <span class="${task.completed ? 'line-through text-gray-500' : ''} ${task.urgent ? 'text-red-600' : ''}">
        ${task.text}
      </span>
    </div>
    <button
      onclick="deleteTask('${task._id}')"
      class="text-red-500 hover:text-red-700"
    >
      Delete
    </button>
  `;
  taskList.appendChild(li);
}

async function loadTasks() {
  try {
    const response = await fetch('http://localhost:3000/tasks', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to fetch tasks');
    const tasks = await response.json();
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    tasks.forEach(task => renderTask(task));
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function toggleTask(id) {
  try {
    const response = await fetch(`http://localhost:3000/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bennett ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to toggle task');
    loadTasks();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function deleteTask(id) {
  try {
    const response = await fetch(`http://localhost:3000/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to delete task');
    loadTasks();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}