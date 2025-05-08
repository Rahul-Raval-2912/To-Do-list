const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const authDiv = document.getElementById('auth');
const todoDiv = document.getElementById('todo');
const toggleAuth = document.getElementById('toggleAuth');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  try {
    const response = await fetch('http://localhost:3000/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (response.ok) {
      alert('Signup successful! Please log in.');
      toggleAuth.click();
    } else {
      alert('Signup failed');
    }
  } catch (error) {
    alert('Error during signup');
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('token', data.token);
      authDiv.style.display = 'none';
      todoDiv.style.display = 'block';
      loadTasks();
    } else {
      alert('Login failed: ' + data.error);
    }
  } catch (error) {
    alert('Error during login');
  }
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('taskInput').value;
  const urgent = document.getElementById('urgent').checked;
  try {
    await fetch('http://localhost:3000/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text, urgent })
    });
    taskForm.reset();
    loadTasks();
  } catch (error) {
    alert('Error adding task');
  }
});

async function loadTasks() {
  try {
    const response = await fetch('http://localhost:3000/tasks', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const tasks = await response.json();
    taskList.innerHTML = '';
    tasks.forEach(task => {
      const li = document.createElement('li');
      li.innerHTML = `
        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id}, ${!task.completed})">
        <span style="${task.completed ? 'text-decoration: line-through;' : ''} ${task.urgent ? 'color: red;' : ''}">
          ${task.text}
        </span>
        <button onclick="deleteTask(${task.id})">Delete</button>
      `;
      taskList.appendChild(li);
    });
  } catch (error) {
    alert('Error loading tasks');
  }
}

async function toggleTask(id, completed) {
  try {
    const response = await fetch(`http://localhost:3000/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ completed })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Toggle failed: ${errorData.error}`);
    }
    loadTasks();
  } catch (error) {
    console.error('Error toggling task:', error);
    alert('Failed to toggle task: ' + error.message);
  }
}

async function deleteTask(id) {
  try {
    const response = await fetch(`http://localhost:3000/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Delete failed: ${errorData.error}`);
    }
    loadTasks();
  } catch (error) {
    console.error('Error deleting task:', error);
    alert('Failed to delete task: ' + error.message);
  }
}

toggleAuth.addEventListener('click', () => {
  loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
  signupForm.style.display = signupForm.style.display === 'none' ? 'block' : 'none';
  toggleAuth.textContent = loginForm.style.display === 'none' ? 'Switch to Login' : 'Switch to Signup';
});