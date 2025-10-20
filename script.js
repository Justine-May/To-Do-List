document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');

    // --- Data Management (Local Storage) ---

    /**
     * Retrieves tasks from local storage or returns an empty array.
     */
    const getTasks = () => {
        const tasksJSON = localStorage.getItem('tasks');
        return tasksJSON ? JSON.parse(tasksJSON) : [];
    };

    /**
     * Saves the current tasks array to local storage.
     * @param {Array} tasks - The array of task objects to save.
     */
    const saveTasks = (tasks) => {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    };

    // --- UI Rendering ---

    /**
     * Renders a single task item (<li>) and appends it to the list.
     * @param {Object} task - The task object { id, text, completed }.
     */
    const renderTask = (task) => {
        const listItem = document.createElement('li');
        listItem.classList.add('task-item');
        if (task.completed) {
            listItem.classList.add('completed');
        }
        listItem.dataset.id = task.id;

        // Checkbox for completion
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', toggleComplete);

        // Task text
        const taskText = document.createElement('span');
        taskText.classList.add('task-text');
        taskText.textContent = task.text;

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.textContent = '×'; // Unicode times symbol
        deleteBtn.addEventListener('click', deleteTask);

        // Assemble the list item
        listItem.appendChild(checkbox);
        listItem.appendChild(taskText);
        listItem.appendChild(deleteBtn);

        taskList.appendChild(listItem);
    };

    /**
     * Clears and re-renders the entire task list from local storage.
     */
    const loadTasks = () => {
        taskList.innerHTML = ''; // Clear existing tasks
        const tasks = getTasks();
        tasks.forEach(renderTask);
    };

    // --- Event Handlers (CRUD) ---

    /**
     * Handles the 'Add Task' button click or 'Enter' key press.
     */
    const addTask = () => {
        const text = taskInput.value.trim();

        if (text === '') {
            alert('Please enter a task!');
            return;
        }

        const tasks = getTasks();
        const newTask = {
            id: Date.now(), // Simple unique ID
            text: text,
            completed: false
        };

        tasks.push(newTask);
        saveTasks(tasks);

        taskInput.value = ''; // Clear input
        loadTasks(); // Reload the list
    };

    /**
     * Toggles the completion status of a task.
     */
    const toggleComplete = (event) => {
        const listItem = event.target.closest('.task-item');
        const id = parseInt(listItem.dataset.id);
        
        let tasks = getTasks();
        tasks = tasks.map(task => {
            if (task.id === id) {
                return { ...task, completed: !task.completed };
            }
            return task;
        });

        saveTasks(tasks);
        loadTasks(); // Reload the list to update classes
    };

    /**
     * Deletes a task from the list and local storage.
     */
    const deleteTask = (event) => {
        const listItem = event.target.closest('.task-item');
        const id = parseInt(listItem.dataset.id);

        let tasks = getTasks();
        tasks = tasks.filter(task => task.id !== id);

        saveTasks(tasks);
        loadTasks(); // Reload the list
    };


    // --- Initialization ---
    
    // Add event listeners
    addTaskBtn.addEventListener('click', addTask);
    
    // Allow 'Enter' key to submit task
    taskInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addTask();
        }
    });

    // Load tasks when the page loads
    loadTasks();
});