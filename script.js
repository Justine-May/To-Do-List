document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskList = document.getElementById('task-list');
    const newTaskTitleInput = document.getElementById('new-task-title');
    const addTaskBtn = document.getElementById('add-task-btn');
    const listFilter = document.getElementById('list-filter');
    const addListBtn = document.getElementById('add-list-btn');
    const signInStatus = document.getElementById('sign-in-status'); // New element

    // Detail Panel elements (unchanged)
    const detailsPanel = document.getElementById('task-details-panel');
    const closeDetailsBtn = document.getElementById('close-details-btn');
    const detailTitle = document.getElementById('detail-title');
    const detailText = document.getElementById('detail-text');
    const detailDueDate = document.getElementById('detail-due-date');
    const detailList = document.getElementById('detail-list');
    const subtaskList = document.getElementById('subtask-list');
    const newSubtaskText = document.getElementById('new-subtask-text');
    const addSubtaskBtn = document.getElementById('add-subtask-btn');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const saveChangesBtn = document.getElementById('save-changes-btn');

    // --- State & Config ---
    let activeTaskId = null;
    let currentFilter = 'all';
    const DEFAULT_LISTS = [{ id: 'all', name: 'All Tasks' }, { id: 'personal', name: 'Personal' }, { id: 'work', name: 'Work' }];
    
    // AUTHENTICATION STATE
    let currentUserId = 'local_guest'; // Default ID for local storage
    const TASK_STORAGE_KEY = () => `mergedTasks_${currentUserId}`;
    const LIST_STORAGE_KEY = () => `mergedLists_${currentUserId}`;


    // --- Authentication Functions (Simulated) ---

    /**
     * Global callback function for Google Identity Services.
     * NOTE: This function MUST be global (defined without 'const' or 'let' outside DOMContentLoaded 
     * or attached to the window object) to work with the GIS script.
     */
    window.handleCredentialResponse = (response) => {
        // In a real application, you'd send this ID token to your backend for verification.
        const idToken = response.credential;
        
        try {
            // Decode the JWT to get user info (DANGEROUS on client, but fine for simulation)
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            
            // SIMULATION: Update the user state and reload data
            currentUserId = payload.sub; // Google User ID (sub field)
            signInStatus.textContent = `Signed in as ${payload.name}.`;
            
            // Re-load the list and task data using the new user ID
            renderLists();
            loadTasks();

        } catch (e) {
            console.error("Failed to decode token:", e);
        }
    };
    
    // --- Data Management (Local Storage) ---
    
    // Functions updated to use dynamic keys (TASK_STORAGE_KEY(), LIST_STORAGE_KEY())

    const getTasks = () => {
        const tasksJSON = localStorage.getItem(TASK_STORAGE_KEY());
        return tasksJSON ? JSON.parse(tasksJSON) : [];
    };

    const saveTasks = (tasks) => {
        localStorage.setItem(TASK_STORAGE_KEY(), JSON.stringify(tasks));
    };

    const getLists = () => {
        const listsJSON = localStorage.getItem(LIST_STORAGE_KEY());
        // Always include default lists for functionality
        const customLists = listsJSON ? JSON.parse(listsJSON) : DEFAULT_LISTS.slice(1); 
        return customLists;
    };

    const saveLists = (lists) => {
        localStorage.setItem(LIST_STORAGE_KEY(), JSON.stringify(lists));
    };

    const findTask = (id) => getTasks().find(t => t.id === id);


    // --- List Management & Rendering ---

    const renderLists = () => {
        // ... (Logic remains the same, but uses getLists() and saveLists())
        const customLists = getLists();
        const allLists = DEFAULT_LISTS.concat(customLists.filter(l => l.id !== 'personal' && l.id !== 'work'));
        
        listFilter.innerHTML = '';
        detailList.innerHTML = '';

        allLists.forEach(list => {
            const filterOption = document.createElement('option');
            filterOption.value = list.id;
            filterOption.textContent = list.name;
            listFilter.appendChild(filterOption);

            if (list.id !== 'all') {
                const detailOption = document.createElement('option');
                detailOption.value = list.id;
                detailOption.textContent = list.name;
                detailList.appendChild(detailOption);
            }
        });

        listFilter.value = currentFilter;
    };

    const addNewList = () => {
        const listName = prompt("Enter the name for the new list:");
        if (listName && listName.trim() !== "") {
            const lists = getLists();
            const newList = {
                id: listName.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]/g, ''), 
                name: listName.trim()
            };
            lists.push(newList);
            saveLists(lists);
            renderLists();
        }
    };

    // --- Main Task List Rendering (loadTasks and renderParentTask unchanged in core logic) ---
    
    const renderParentTask = (task) => {
        // ... (Logic from previous script)
        const listItem = document.createElement('li');
        listItem.classList.add('task-item');
        if (task.completed) listItem.classList.add('completed');
        listItem.dataset.id = task.id;

        const mainDetails = document.createElement('div');
        mainDetails.classList.add('task-main-details');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', (e) => toggleParentComplete(e, task.id));
        mainDetails.appendChild(checkbox);

        const taskText = document.createElement('span');
        taskText.classList.add('task-text');
        taskText.textContent = task.text;
        mainDetails.appendChild(taskText);

        const tagsDiv = document.createElement('div');
        tagsDiv.classList.add('task-info-tags');
        
        const subtaskCount = task.subtasks ? task.subtasks.length : 0;
        const subtaskCompleted = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
        
        let tags = [];
        if (task.dueDate) tags.push(`Due: ${task.dueDate}`);
        if (subtaskCount > 0) tags.push(`Subtasks: ${subtaskCompleted}/${subtaskCount}`);
        
        tagsDiv.textContent = tags.join(' | ');
        mainDetails.appendChild(tagsDiv);

        listItem.appendChild(mainDetails);

        listItem.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' || e.target.type !== 'checkbox') {
                 document.querySelectorAll('.task-item').forEach(item => item.classList.remove('active'));
                 listItem.classList.add('active');
                 openTaskDetails(task.id);
            }
        });

        taskList.appendChild(listItem);
    };

    const loadTasks = () => {
        // ... (Logic from previous script)
        taskList.innerHTML = '';
        const allTasks = getTasks();
        
        const filteredTasks = allTasks.filter(task => 
            currentFilter === 'all' || task.listId === currentFilter
        );

        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
            return 0;
        });

        filteredTasks.forEach(renderParentTask);
    };


    // --- Detail Panel Logic (openTaskDetails, closeTaskDetails, renderSubtasks unchanged) ---

    const openTaskDetails = (id) => {
        activeTaskId = id;
        const task = findTask(id);

        if (!task) return closeTaskDetails();

        detailTitle.textContent = `Task: ${task.text}`;
        detailText.value = task.text;
        detailDueDate.value = task.dueDate || '';
        detailList.value = task.listId;

        renderSubtasks(task.subtasks || []);
        detailsPanel.classList.remove('hidden');
    };

    const closeTaskDetails = () => {
        activeTaskId = null;
        detailsPanel.classList.add('hidden');
        document.querySelectorAll('.task-item').forEach(item => item.classList.remove('active'));
        loadTasks(); 
    };

    const renderSubtasks = (subtasks) => {
        subtaskList.innerHTML = '';
        subtasks.forEach(subtask => {
            const li = document.createElement('li');
            li.classList.add('subtask-item');
            if (subtask.completed) li.classList.add('completed');
            li.dataset.id = subtask.id;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = subtask.completed;
            checkbox.addEventListener('change', (e) => toggleSubtaskComplete(e, subtask.id));

            const textSpan = document.createElement('span');
            textSpan.classList.add('subtask-text');
            textSpan.textContent = subtask.text;

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.textContent = '—';
            deleteBtn.addEventListener('click', (e) => deleteSubtask(e, subtask.id));

            li.appendChild(checkbox);
            li.appendChild(textSpan);
            li.appendChild(deleteBtn);
            subtaskList.appendChild(li);
        });
    };
    
    // --- Event Handlers (CRUD Logic remains the same, only the get/save functions change) ---

    const addNewTask = () => {
        const text = newTaskTitleInput.value.trim();
        if (!text) return;

        const tasks = getTasks();
        const newTask = {
            id: Date.now(),
            text: text,
            listId: currentFilter !== 'all' ? currentFilter : 'personal',
            dueDate: '',
            completed: false,
            subtasks: []
        };

        tasks.push(newTask);
        saveTasks(tasks);
        newTaskTitleInput.value = '';
        loadTasks();
    };

    const saveTaskDetails = () => {
        if (!activeTaskId) return;

        let tasks = getTasks();
        const taskIndex = tasks.findIndex(t => t.id === activeTaskId);

        if (taskIndex !== -1) {
            tasks[taskIndex] = {
                ...tasks[taskIndex],
                text: detailText.value.trim(),
                dueDate: detailDueDate.value,
                listId: detailList.value
            };
            saveTasks(tasks);
            loadTasks();
            detailTitle.textContent = `Task: ${detailText.value.trim()}`;
        }
    };

    const toggleParentComplete = (event, id) => {
        let tasks = getTasks();
        tasks = tasks.map(task => {
            if (task.id === id) {
                const isCompleted = !task.completed;
                task.subtasks = (task.subtasks || []).map(sub => ({ ...sub, completed: isCompleted }));
                return { ...task, completed: isCompleted };
            }
            return task;
        });

        saveTasks(tasks);
        loadTasks();
        if (activeTaskId === id) {
             const updatedTask = findTask(id);
             renderSubtasks(updatedTask.subtasks);
        }
    };

    const deleteActiveTask = () => {
        if (!activeTaskId || !confirm("Delete this task and all its subtasks?")) return;
        let tasks = getTasks();
        tasks = tasks.filter(task => task.id !== activeTaskId);
        saveTasks(tasks);
        closeTaskDetails();
    };

    const addSubtask = () => {
        if (!activeTaskId) return;
        const subtext = newSubtaskText.value.trim();
        if (!subtext) return;

        let tasks = getTasks();
        const taskIndex = tasks.findIndex(t => t.id === activeTaskId);

        if (taskIndex !== -1) {
            const newSubtask = {
                id: Date.now() + Math.random(),
                text: subtext,
                completed: false
            };
            tasks[taskIndex].subtasks = [...(tasks[taskIndex].subtasks || []), newSubtask];

            saveTasks(tasks);
            newSubtaskText.value = '';
            renderSubtasks(tasks[taskIndex].subtasks);
            loadTasks(); 
        }
    };

    const toggleSubtaskComplete = (event, subId) => {
        if (!activeTaskId) return;
        let tasks = getTasks();
        const taskIndex = tasks.findIndex(t => t.id === activeTaskId);

        if (taskIndex !== -1) {
            const task = tasks[taskIndex];
            const subtasks = task.subtasks.map(sub => {
                if (sub.id === subId) return { ...sub, completed: !sub.completed };
                return sub;
            });
            
            task.subtasks = subtasks;
            
            const allSubtasksCompleted = subtasks.every(sub => sub.completed);
            task.completed = allSubtasksCompleted;

            saveTasks(tasks);
            renderSubtasks(task.subtasks);
            loadTasks(); 
        }
    };
    
    const deleteSubtask = (event, subId) => {
        if (!activeTaskId) return;
        let tasks = getTasks();
        const taskIndex = tasks.findIndex(t => t.id === activeTaskId);

        if (taskIndex !== -1) {
            tasks[taskIndex].subtasks = tasks[taskIndex].subtasks.filter(sub => sub.id !== subId);
            saveTasks(tasks);
            renderSubtasks(tasks[taskIndex].subtasks);
            loadTasks(); 
        }
    };


    // --- Initialization ---

    // Event Listeners
    addTaskBtn.addEventListener('click', addNewTask);
    newTaskTitleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewTask(); });
    addListBtn.addEventListener('click', addNewList);
    listFilter.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        loadTasks();
    });
    closeDetailsBtn.addEventListener('click', closeTaskDetails);
    saveChangesBtn.addEventListener('click', saveTaskDetails);
    deleteTaskBtn.addEventListener('click', deleteActiveTask);
    addSubtaskBtn.addEventListener('click', addSubtask);
    newSubtaskText.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSubtask(); });

    // Load initial data
    renderLists();
    loadTasks();
});