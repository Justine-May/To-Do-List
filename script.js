// 1. Get DOM elements
const taskInput = document.getElementById('taskInput');
const addTaskButton = document.getElementById('addTaskButton');
const todoList = document.getElementById('todoList');

// 2. Event Listener for adding a task
addTaskButton.addEventListener('click', addTask);
taskInput.addEventListener('keypress', function(e) {
    // Allows adding a task by pressing the 'Enter' key
    if (e.key === 'Enter') {
        addTask();
    }
});

// 3. Function to add a new task
function addTask() {
    const taskText = taskInput.value.trim();

    // Check if input is empty
    if (taskText === '') {
        alert('Please enter a task!');
        return;
    }

    // Create new list item (li)
    const listItem = document.createElement('li');
    listItem.innerHTML = `
        <input type="checkbox" class="task-checkbox">
        <span class="task-text">${taskText}</span>
        <button class="delete-btn">🗑️</button>
    `;

    // 4. Add functionality for 'Mark as Done' (toggle 'done' class)
    const taskSpan = listItem.querySelector('span');
    taskSpan.addEventListener('click', function() {
        listItem.classList.toggle('done');
    });

    // 5. Add functionality for 'Delete'
    const deleteButton = listItem.querySelector('.delete-btn');
    deleteButton.addEventListener('click', function() {
        todoList.removeChild(listItem);
    });

    // Append the new task to the list
    todoList.appendChild(listItem);

    // Clear the input field
    taskInput.value = '';
    taskInput.focus(); // Keep focus on input for quick additions
}
// Get the new sort button
const sortTasksButton = document.getElementById('sortTasksButton'); 

// Add the event listener
sortTasksButton.addEventListener('click', sortTasks);

// Function to sort tasks
function sortTasks() {
    const list = document.getElementById('todoList');
    // Get all list items (tasks)
    const items = Array.from(list.children); 

    // 1. Separate tasks into two groups
    const pendingTasks = items.filter(item => !item.classList.contains('done'));
    const completedTasks = items.filter(item => item.classList.contains('done'));

    // 2. Clear the current list order
    list.innerHTML = ''; 

    // 3. Re-append the lists, placing Pending tasks first
    
    // Append all pending tasks
    pendingTasks.forEach(task => {
        list.appendChild(task);
    });

    // Append all completed tasks (they will appear at the bottom)
    completedTasks.forEach(task => {
        list.appendChild(task);
    });
}
