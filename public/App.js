const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const authDiv = document.getElementById('auth');
const todoDiv = document.getElementById('todo');
const toggleAuth = document.getElementById('toggleAuth');

// Prevent hash navigation
window.onload = () => {
  if (window.location.hash) {
    console.log('Removing hash from URL');
    window.location.replace(window.location.pathname);
  }
};

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  console.log('Signup attempt:', { email });
  try {
    const response = await fetch('http://localhost:3000/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    console.log('Signup response:', data);
    if (response.ok) {
      console.log('Signup successful:', data);
      alert('Signup successful! Please log in.');
      toggleAuth.click();
    } else {
      console.error('Signup failed:', data);
      alert('Signup failed: ' + data.error);
    }
  } catch (error) {
    console.error('Signup error:', error);
    alert('Error during signup: ' + error.message);
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  console.log('Login attempt:', { email });
  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    console.log('Login response:', data);
    if (response.ok) {
      localStorage.setItem('token', data.token);
      console.log('Token stored:', data.token.substring(0, 20) + '...');
      authDiv.style.display = 'none';
      todoDiv.style.display = 'block';
      loadTasks();
    } else {
      console.error('Login failed:', data);
      alert('Login failed: ' + data.error);
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Error during login: ' + error.message);
  }
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('taskInput').value;
  const urgent = document.getElementById('urgent').checked;
  const dueTime = document.getElementById('dueTime').value; // Get time input
  console.log('Add task attempt:', { text, urgent, dueTime });
  try {
    const response = await fetch('http://localhost:3000/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text, urgent, dueTime })
    });
    const data = await response.json();
    console.log('Add task response:', data);
    if (!response.ok) {
      console.error('Add task failed:', data);
      throw new Error(`Add task failed: ${data.error}`);
    }
    console.log('Task added:', data);
    taskForm.reset();
    loadTasks();
  } catch (error) {
    console.error('Add task error:', error);
    alert('Error adding task: ' + error.message);
  }
});

async function loadTasks() {
  console.log('Loading tasks...');
  try {
    const response = await fetch('http://localhost:3000/tasks', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    console.log('Load tasks response:', data);
    if (!response.ok) {
      console.error('Load tasks failed:', data);
      throw new Error(`Load tasks failed: ${data.error}`);
    }
    const tasks = data;
    console.log('Tasks loaded:', tasks);
    taskList.innerHTML = '';
    tasks.forEach(task => {
      const li = document.createElement('li');
      li.innerHTML = `
        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id}, ${!task.completed})">
        <span style="${task.completed ? 'text-decoration: line-through;' : ''} ${task.urgent ? 'color: red;' : ''}">
          ${task.text}${task.dueTime ? ' (Due: ' + task.dueTime + ')' : ''}
        </span>
        <button onclick="deleteTask(${task.id})">Delete</button>
      `;
      taskList.appendChild(li);
    });
  } catch (error) {
    console.error('Load tasks error:', error);
    alert('Error loading tasks: ' + error.message);
  }
}

async function toggleTask(id, completed) {
  console.log('Toggle task:', { id, completed });
  try {
    const response = await fetch(`http://localhost:3000/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ completed })
    });
    const data = await response.json();
    console.log('Toggle response:', data);
    if (!response.ok) {
      console.error('Toggle failed:', data);
      throw new Error(`Toggle failed: ${data.error}`);
    }
    console.log('Toggle successful:', data);
    loadTasks();
  } catch (error) {
    console.error('Error toggling task:', error);
    alert('Failed to toggle task: ' + error.message);
  }
}

async function deleteTask(id) {
  console.log('Delete task:', { id });
  try {
    const response = await fetch(`http://localhost:3000/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    console.log('Delete response:', data);
    if (!response.ok) {
      console.error('Delete failed:', data);
      throw new Error(`Delete failed: ${data.error}`);
    }
    console.log('Delete successful:', data);
    loadTasks();
  } catch (error) {
    console.error('Error deleting task:', error);
    alert('Failed to delete task: ' + error.message);
  }
}

function logout() {
  console.log('Logging out...');
  localStorage.removeItem('token');
  authDiv.style.display = 'block';
  todoDiv.style.display = 'none';
  taskList.innerHTML = '';
  console.log('Logout successful');
}

toggleAuth.addEventListener('click', () => {
  loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
  signupForm.style.display = signupForm.style.display === 'none' ? 'block' : 'none';
  toggleAuth.textContent = loginForm.style.display === 'none' ? 'Switch to Login' : 'Switch to Signup';
});