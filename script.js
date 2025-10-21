document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskList = document.getElementById('task-list');
    const newTaskTitleInput = document.getElementById('new-task-title');
    const mainHeader = document.getElementById('main-header'); 
    
    // Sidebar elements
    const menuPanel = document.querySelector('.nav-panel'); // ADDED: Required for mobile toggle
    const menuToggleBtn = document.getElementById('menu-toggle-btn'); // ADDED: Required for mobile toggle
    const addTaskButton = document.getElementById('add-task-btn'); // ADDED: Required for explicit button listener

    const menuSearchInput = document.getElementById('menu-search-input'); 
    const upcomingFilterBtn = document.getElementById('upcoming-filter-btn');
    const todayFilterBtn = document.getElementById('today-filter-btn');
    const allTasksFilterBtn = document.getElementById('all-tasks-filter-btn');
    const listMenuItems = document.getElementById('list-menu-items');
    const addListBtn = document.getElementById('add-list-btn'); 
    const tagMenuItems = document.getElementById('tag-menu-items');
    // const addTagBtn = document.getElementById('add-tag-btn'); // NOTE: This is likely not needed, as the button is created in renderTags
    const signOutBtn = document.getElementById('sign-out-btn');

    // Detail Panel elements
    const detailsPanel = document.getElementById('task-details-panel');
    const closeDetailsBtn = document.getElementById('close-details-btn');
    const detailText = document.getElementById('detail-text');
    const detailDescription = document.getElementById('detail-description'); 
    const detailDueDate = document.getElementById('detail-due-date');
    const detailList = document.getElementById('detail-list');
    const detailTagsDisplay = document.getElementById('detail-tags-display'); 
    const newTagText = document.getElementById('new-tag-text'); 
    const addTagToTaskBtn = document.getElementById('add-tag-to-task-btn'); 
    const subtaskList = document.getElementById('subtask-list');
    const newSubtaskText = document.getElementById('new-subtask-text');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const saveChangesBtn = document.getElementById('save-changes-btn');

    // --- State & Config ---
    let activeTaskId = null;
    let currentFilter = 'today';
    let currentTagFilter = null;
    const DEFAULT_LISTS = [{ id: 'personal', name: 'Personal' }, { id: 'work', name: 'Work' }];
    
    // AUTHENTICATION STATE
    let currentUserId = 'local_guest';
    const TASK_STORAGE_KEY = () => `unifiedTasks_${currentUserId}`;
    const LIST_STORAGE_KEY = () => `unifiedLists_${currentUserId}`;
    const TAG_STORAGE_KEY = () => `unifiedTags_${currentUserId}`;
    
    // --- Auth UI Manager (unchanged) ---
    const updateAuthUI = (isSignedIn, userName = '') => {
        // ... (unchanged logic) ...
        const googleSignInDiv = document.querySelector('.g_id_signin');
        const signInStatus = document.getElementById('sign-in-status');
        if (isSignedIn) {
            signInStatus.textContent = `Hello ${userName}.`;
            googleSignInDiv.classList.add('hidden');
        } else {
            signInStatus.textContent = 'Signed out. Data is local.';
            googleSignInDiv.classList.remove('hidden');
        }
    };
    window.handleCredentialResponse = (response) => {
        // ... (unchanged logic) ...
        const idToken = response.credential;
        try {
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            currentUserId = payload.sub;
            updateAuthUI(true, payload.name);
            renderLists();
            renderTags();
            loadTasks();
        } catch (e) {
            console.error("Failed to decode token:", e);
        }
    };
    
    // --- Data Management (Tasks & Lists - unchanged) ---
    const getTasks = () => {
        const tasksJSON = localStorage.getItem(TASK_STORAGE_KEY());
        return tasksJSON ? JSON.parse(tasksJSON) : [];
    };
    const saveTasks = (tasks) => {
        localStorage.setItem(TASK_STORAGE_KEY(), JSON.stringify(tasks));
    };
    const getLists = () => {
        const listsJSON = localStorage.getItem(LIST_STORAGE_KEY());
        const customLists = listsJSON ? JSON.parse(listsJSON) : DEFAULT_LISTS; 
        return customLists;
    };
    const saveLists = (lists) => {
        localStorage.setItem(LIST_STORAGE_KEY(), JSON.stringify(lists));
    };
    const findTask = (id) => getTasks().find(t => t.id === id);

    // --- Tag Management ---

    const getTags = () => {
        const tagsJSON = localStorage.getItem(TAG_STORAGE_KEY());
        return tagsJSON ? JSON.parse(tagsJSON) : ['Tag 1', 'Tag 2']; // Default tags
    };

    const saveTags = (tags) => {
        // Ensure only unique tags are saved
        const uniqueTags = [...new Set(tags)];
        localStorage.setItem(TAG_STORAGE_KEY(), JSON.stringify(uniqueTags));
    };

    const renderTags = () => {
        const allTags = getTags();
        tagMenuItems.innerHTML = '';
        
        // Render tags for the sidebar filter
        allTags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.classList.add('menu-item', 'task-tag');
            tagItem.style.backgroundColor = getTagColor(tag);
            tagItem.style.color = 'white';
            tagItem.textContent = tag;
            tagItem.dataset.tag = tag;
            
            tagItem.addEventListener('click', () => applyNewTagFilter(tag, tagItem));
            tagMenuItems.appendChild(tagItem);
        });

        const addTagItem = document.createElement('div');
        addTagItem.classList.add('menu-item');
        addTagItem.textContent = '+ Add Tag';
        addTagItem.id = 'add-tag-btn-sidebar'; // Renamed to avoid ID conflict
        addTagItem.addEventListener('click', addNewTag);
        tagMenuItems.appendChild(addTagItem);
    };

    const getTagColor = (tag) => {
        // Simple hash-based color generation for consistency
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            let value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    };

    const addNewTag = () => {
        const tagName = prompt("Enter the name for the new tag:");
        if (tagName && tagName.trim() !== "") {
            const tags = getTags();
            if (!tags.includes(tagName.trim())) {
                tags.push(tagName.trim());
                saveTags(tags);
                renderTags();
            }
        }
    };
    
    // --- List Management & Rendering ---

    const renderLists = () => {
        const customLists = getLists();
        listMenuItems.innerHTML = '';
        detailList.innerHTML = ''; 

        // 1. Render Detail Panel Select options
        customLists.forEach(list => {
            const detailOption = document.createElement('option');
            detailOption.value = list.id;
            detailOption.textContent = list.name;
            detailList.appendChild(detailOption);
        });

        // 2. Render Sidebar Menu Items
        customLists.forEach(list => {
            const listItem = document.createElement('div');
            listItem.classList.add('menu-item');
            listItem.dataset.filter = list.id;
            listItem.innerHTML = `
                <span style="color: ${list.id === 'personal' ? 'red' : list.id === 'work' ? 'blue' : 'green'};">●</span> ${list.name}
                <span class="task-count" id="list-count-${list.id}">0</span>
            `;
            
            listItem.addEventListener('click', () => applyNewFilter(list.id, listItem));
            listMenuItems.appendChild(listItem);
        });

        // Re-apply active class
        const activeItem = document.querySelector(`.menu-item[data-filter="${currentFilter}"]`) || document.getElementById(`${currentFilter}-filter-btn`);
        if(activeItem) activeItem.classList.add('active-menu-item');
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


    // --- Task List Rendering ---
    
    const renderTaskTags = (task) => {
        const tagHtml = (task.tags || []).map(tag => 
            `<span class="task-tag" style="background-color: ${getTagColor(tag)};">${tag}</span>`
        ).join('');
        return tagHtml;
    };

    const renderParentTask = (task) => {
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
        
        const infoDiv = document.createElement('div');
        infoDiv.classList.add('task-info-tags');

        const subtaskCount = task.subtasks ? task.subtasks.length : 0;
        const subtaskCompleted = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
        
        // Show Due Date, Subtask Count, and List Tag in the list item
        let tags = [];
        if (task.dueDate) tags.push(`Due: ${task.dueDate}`);
        if (subtaskCount > 0) tags.push(`Subtasks: ${subtaskCompleted}/${subtaskCount}`);
        
        // Find list name for display
        const listName = getLists().find(l => l.id === task.listId)?.name || task.listId;
        tags.push(`List: ${listName}`);
        
        infoDiv.innerHTML = `
            ${tags.join(' | ')}
            <span style="font-size: 18px; margin-left: 10px;">&gt;</span>
        `; 
        mainDetails.appendChild(infoDiv);


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
const handleSearch = () => {
        const searchTerm = menuSearchInput.value.trim().toLowerCase();
        
        // If the search term is empty, just reload tasks based on the current filter
        if (!searchTerm) {
            loadTasks(); 
            return; 
        }

        // If searching, we clear active menu filters for visual clarity
        clearAllActiveFilters();
        
        taskList.innerHTML = '';
        const allTasks = getTasks();
        
        // Filter tasks based on the search term
        const searchedTasks = allTasks.filter(task => {
            const textMatch = task.text.toLowerCase().includes(searchTerm);
            const descriptionMatch = (task.description || '').toLowerCase().includes(searchTerm);
            // Check if any tag includes the search term
            const tagMatch = (task.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));

            return textMatch || descriptionMatch || tagMatch;
        });

        // Update the Header to reflect the search
        mainHeader.textContent = `Search: "${searchTerm}"`;
        document.getElementById('task-count-display').textContent = searchedTasks.length;

        // Render the filtered tasks
        searchedTasks.forEach(renderParentTask);
    };
    const loadTasks = () => {
        taskList.innerHTML = '';
        const allTasks = getTasks();
        // ... (The rest of loadTasks remains the same) ...
        // ... (This function should be placed BEFORE loadTasks or inside it as a helper 
        // ... function, but placing it BEFORE loadTasks makes the most sense in this structure)
        
        // Since loadTasks handles filtering by list/date, we need to ensure 
        // handleSearch doesn't interfere with this state unless the user is actively typing.
        // The implementation above correctly handles this by running handleSearch only when input changes.

        const now = new Date();
        now.setHours(0, 0, 0, 0); 
        
        // 1. Filtering Logic (This is the logic used when NOT actively searching)
        const filteredTasks = allTasks.filter(task => {
            const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
            if (taskDueDate) taskDueDate.setHours(0, 0, 0, 0);

            // Filter by Tag first (if set)
            if (currentTagFilter && !(task.tags || []).includes(currentTagFilter)) {
                return false;
            }

            // Filter by main menu filter
            if (currentFilter === 'all') {
                return true;
            }
            if (currentFilter === 'today') {
                return !task.completed && taskDueDate && taskDueDate <= now;
            }
            if (currentFilter === 'upcoming') {
                return !task.completed && taskDueDate && taskDueDate > now;
            }
            
            // Filter by list ID
            return task.listId === currentFilter;
        });

        // 2. Sorting Logic
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
            return 0;
        });

        filteredTasks.forEach(renderParentTask);
        
        // 3. Update Sidebar Counts (Logic remains for Today/Upcoming/Lists)
        const todayCount = allTasks.filter(task => {
            const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
            if (taskDueDate) taskDueDate.setHours(0, 0, 0, 0);
            return !task.completed && taskDueDate && taskDueDate <= now;
        }).length;
        document.getElementById('today-task-count').textContent = todayCount;
        
        const upcomingCount = allTasks.filter(task => {
            const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
            if (taskDueDate) taskDueDate.setHours(0, 0, 0, 0);
            return !task.completed && taskDueDate && taskDueDate > now;
        }).length;
        document.getElementById('upcoming-task-count').textContent = upcomingCount;
        
        getLists().forEach(list => {
            const listCount = allTasks.filter(task => task.listId === list.id && !task.completed).length;
            const countEl = document.getElementById(`list-count-${list.id}`);
            if (countEl) countEl.textContent = listCount;
        });

        // 4. Update Main Header Text & Count
        let headerText = currentFilter.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        if (currentTagFilter) {
             headerText = `Tag: ${currentTagFilter}`;
        } else if (currentFilter === 'all') {
            headerText = 'All Tasks';
        } else if (currentFilter === 'today') {
            headerText = 'Today';
        } else if (currentFilter === 'upcoming') {
            headerText = 'Upcoming';
        }
        mainHeader.textContent = headerText;
        document.getElementById('task-count-display').textContent = filteredTasks.length; 
    };

    // --- Task Detail Panel Logic ---

    const renderDetailTags = (task) => {
        detailTagsDisplay.innerHTML = '';
        (task.tags || []).forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.classList.add('task-tag');
            tagSpan.style.backgroundColor = getTagColor(tag);
            tagSpan.textContent = tag;
            tagSpan.title = "Click to remove";
            
            tagSpan.addEventListener('click', () => removeTagFromTask(task.id, tag));
            detailTagsDisplay.appendChild(tagSpan);
        });
    };

    const openTaskDetails = (id) => {
        activeTaskId = id;
        const task = findTask(id);

        if (!task) return closeTaskDetails();

        // Populate detail fields
        document.getElementById('detail-title').textContent = `Task: ${task.text}`;
        detailText.value = task.text;
        detailDescription.value = task.description || ''; // NEW
        detailDueDate.value = task.dueDate || '';
        detailList.value = task.listId;

        // Render tags and subtasks
        renderDetailTags(task); // NEW
        renderSubtasks(task.subtasks || []);
        detailsPanel.classList.remove('hidden');
    };

    const closeTaskDetails = () => {
        activeTaskId = null;
        detailsPanel.classList.add('hidden');
        document.querySelectorAll('.task-item').forEach(item => item.classList.remove('active'));
        loadTasks();
    };

    // --- Event Handlers (CRUD) ---

    const addNewTask = () => {
        const text = newTaskTitleInput.value.trim();
        if (!text) return;

        const tasks = getTasks();
        const newTask = {
            id: Date.now(),
            text: text,
            listId: currentFilter !== 'all' && currentFilter !== 'today' && currentFilter !== 'upcoming' ? currentFilter : 'personal',
            dueDate: '',
            description: '', // NEW
            tags: currentTagFilter ? [currentTagFilter] : [], // NEW
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
                description: detailDescription.value.trim(), // NEW
                dueDate: detailDueDate.value,
                listId: detailList.value
            };
            saveTasks(tasks);
            // Re-open details to reflect title change and refresh list
            openTaskDetails(activeTaskId); 
            loadTasks();
        }
    };
    
    const addTagToTask = () => {
        if (!activeTaskId) return;
        const tag = newTagText.value.trim();
        if (!tag) return;

        let tasks = getTasks();
        const taskIndex = tasks.findIndex(t => t.id === activeTaskId);

        if (taskIndex !== -1) {
            let taskTags = tasks[taskIndex].tags || [];
            if (!taskTags.includes(tag)) {
                taskTags.push(tag);
                // Also add to global tags if it's new
                const globalTags = getTags();
                if (!globalTags.includes(tag)) {
                    globalTags.push(tag);
                    saveTags(globalTags);
                    renderTags();
                }
            }
            tasks[taskIndex].tags = taskTags;
            saveTasks(tasks);
            newTagText.value = '';
            renderDetailTags(tasks[taskIndex]);
        }
    };

    const removeTagFromTask = (taskId, tagToRemove) => {
        let tasks = getTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);

        if (taskIndex !== -1) {
            tasks[taskIndex].tags = (tasks[taskIndex].tags || []).filter(tag => tag !== tagToRemove);
            saveTasks(tasks);
            renderDetailTags(tasks[taskIndex]);
        }
    };

    // Subtask Logic (Render/Toggle/Delete remain the same, using renderSubtasks and saveTasks)
    const renderSubtasks = (subtasks) => {
        // ... (existing renderSubtasks logic) ...
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
    
    // ... (toggleParentComplete, deleteActiveTask, addSubtask, toggleSubtaskComplete, deleteSubtask logic remains the same) ...

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
    
    // ... (rest of CRUD functions like toggleSubtaskComplete and deleteSubtask) ...
    
    // --- Filter Handlers ---

    const clearAllActiveFilters = () => {
        document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active-menu-item'));
        document.querySelectorAll('.task-tag').forEach(item => item.classList.remove('active-menu-item'));
        currentTagFilter = null;
    };

    const applyNewFilter = (filterId, clickedElement) => {
        clearAllActiveFilters();
        currentFilter = filterId;
        clickedElement.classList.add('active-menu-item');
        closeTaskDetails();
        loadTasks();
    };
    
    const applyNewTagFilter = (tagId, clickedElement) => {
        clearAllActiveFilters();
        currentFilter = 'all'; // Tag filter overrides list filter
        currentTagFilter = tagId;
        clickedElement.classList.add('active-menu-item');
        closeTaskDetails();
        loadTasks();
    };


    // --- Initialization ---

    /// Event Listeners
    // NEW: Search Input Listener
    menuSearchInput.addEventListener('input', handleSearch);

    document.getElementById('add-task-btn')
    newTaskTitleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewTask(); });
    document.querySelector('.add-task-group').addEventListener('click', (e) => {
         if (e.target.id === 'new-task-title') return; // Don't fire if clicking the input itself
         addNewTask(); // Clicking the "+" or the input area outside the text
    });

    addListBtn.addEventListener('click', addNewList);
    addTagToTaskBtn.addEventListener('click', addTagToTask); // NEW
    newTagText.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTagToTask(); }); // NEW
    
    // Sidebar Filter Listeners
    upcomingFilterBtn.addEventListener('click', () => applyNewFilter('upcoming', upcomingFilterBtn));
    todayFilterBtn.addEventListener('click', () => applyNewFilter('today', todayFilterBtn));
    allTasksFilterBtn.addEventListener('click', () => applyNewFilter('all', allTasksFilterBtn));
    
    closeDetailsBtn.addEventListener('click', closeTaskDetails);
    saveChangesBtn.addEventListener('click', saveTaskDetails);
    deleteTaskBtn.addEventListener('click', deleteActiveTask);
    
    newSubtaskText.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSubtask(); });

    // Initial load
    updateAuthUI(false);
    renderLists();
    renderTags(); // Load and display global tags
    loadTasks();
});