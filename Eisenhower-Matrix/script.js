document.addEventListener('DOMContentLoaded', () => {
    // --- Global Selectors and Mappings ---
    const modal = document.getElementById('task-details-modal');
    const closeButton = document.querySelector('.close-button');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const quadrants = document.querySelectorAll('.quadrant');
    const selectedTagsContainer = document.getElementById('selected-tags');
    const matrixContainer = document.getElementById('matrix-container');
    const allTasksContainer = document.getElementById('all-tasks-container');
    const allTasksList = document.getElementById('all-tasks-list');
    const allTasksMenuItem = document.getElementById('all-tasks-menu-item');
    
    let draggedTask = null; 
    let taskIdCounter = 1; 

    // DATA STRUCTURE: Store all tasks here for persistence and sorting
    // This simulates a simple database where all tasks live, regardless of their display location.
    let allTasksData = [
        // Placeholder data, matching the empty HTML but maintaining structure
        // In a real app, this would be loaded from local storage or a server.
    ];

    const QUADRANT_TAGS = {
        'do': ['Urgent', 'Important'],
        'schedule': ['Not Urgent', 'Important'],
        'delegate': ['Urgent', 'Not Important'],
        'delete': ['Not Urgent', 'Not Important']
    };

    // --- Core Data Management ---

    function getTaskData(taskId) {
        return allTasksData.find(task => task.id === parseInt(taskId));
    }
    
    function updateTaskData(taskId, updates) {
        const taskIndex = allTasksData.findIndex(task => task.id === parseInt(taskId));
        if (taskIndex !== -1) {
            allTasksData[taskIndex] = { ...allTasksData[taskIndex], ...updates };
        }
    }

    // --- Task Rendering/Movement ---

    // Function to handle completion: move from matrix to data, and update view
    function handleTaskCompletion(taskElement, isChecked) {
        const taskId = taskElement.getAttribute('data-task-id');
        updateTaskData(taskId, { completed: isChecked });

        if (isChecked) {
            // Task completed: Hide from the matrix
            taskElement.style.display = 'none';
        } else {
            // Task uncompleted: Re-show in its quadrant
            taskElement.style.display = 'flex';
        }

        // Always refresh the "All Tasks" list whenever a task status changes
        renderAllTasksView();
    }

    // Function to generate a new task HTML element (used for both matrix and all-tasks view)
    function generateTaskHtmlElement(task) {
        const newTask = document.createElement('li');
        newTask.className = `task-item ${task.completed ? 'completed' : ''}`;
        newTask.setAttribute('data-task-id', task.id);
        newTask.setAttribute('data-date', task.date); 
        newTask.setAttribute('draggable', 'true'); 

        const dateString = new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        newTask.innerHTML = `
            <i class="fas fa-check"></i> ${task.text}
            <span class="task-date">${dateString}</span>
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
        `;

        setupTaskListeners(newTask);
        setupDragAndDropListeners(newTask);
        return newTask;
    }

    // Function to display the All Tasks view
    function renderAllTasksView() {
        allTasksList.innerHTML = '';
        
        // 1. Sort: Newest to oldest (assuming higher ID or date means newer)
        const sortedTasks = allTasksData.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 2. Render sorted tasks
        sortedTasks.forEach(task => {
            const taskElement = generateTaskHtmlElement(task);
            allTasksList.appendChild(taskElement);
        });
    }

    // Function to switch between Matrix and All Tasks view
    function switchView(viewName) {
        if (viewName === 'matrix') {
            matrixContainer.style.display = 'block';
            allTasksContainer.style.display = 'none';
        } else if (viewName === 'all') {
            matrixContainer.style.display = 'none';
            allTasksContainer.style.display = 'block';
            renderAllTasksView(); // Render/refresh whenever we switch to this view
        }
        
        // Update active class in sidebar (Simplified for this example)
        document.querySelectorAll('.task-item').forEach(item => item.classList.remove('active'));
        document.querySelector('#all-tasks-menu-item')?.classList.add('active'); // Use optional chaining for safety
    }
    
    // --- Event Listeners and Setup ---

    function setupTaskListeners(taskElement) {
        // Open modal listener
        taskElement.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
                return; 
            }
            const clickedElement = e.target.closest('.task-item');
            if(clickedElement) {
                openTaskDetails(clickedElement);
            }
        });

        // Checkbox toggle listener (NEW LOGIC)
        const checkbox = taskElement.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const elementToUpdate = document.querySelector(`.task-item[data-task-id="${taskElement.getAttribute('data-task-id')}"]`);
                
                // Add/remove visual class for all instances of this task (in both matrix/all list)
                document.querySelectorAll(`.task-item[data-task-id="${taskElement.getAttribute('data-task-id')}"]`).forEach(item => {
                    item.classList.toggle('completed', checkbox.checked);
                });

                // Apply logic to hide from matrix (if completed)
                if(elementToUpdate.closest('.matrix-grid')) {
                    handleTaskCompletion(elementToUpdate, checkbox.checked);
                }
            });
        }
    }

    // Sidebar view switch listener (NEW)
    allTasksMenuItem.addEventListener('click', () => {
        switchView('all');
    });

    // Initial setup for existing sidebar elements (ensure matrix view is default)
    document.querySelectorAll('.task-item').forEach(item => {
        if (item.id !== 'all-tasks-menu-item') {
            item.addEventListener('click', () => {
                switchView('matrix');
                // You would typically filter tasks here (e.g., show only 'Today' tasks)
            });
        }
    });

    // --- Drag and Drop Handlers (Adapted) ---

    function setupDragAndDropListeners(taskElement) {
        taskElement.addEventListener('dragstart', handleDragStart);
        taskElement.addEventListener('dragend', handleDragEnd);
    }
    
    function handleDragStart(e) {
        draggedTask = this;
        setTimeout(() => this.classList.add('is-dragging'), 0); 
        e.dataTransfer.setData('text/plain', this.getAttribute('data-task-id'));
    }

    function handleDragEnd() {
        this.classList.remove('is-dragging');
        draggedTask = null;
    }

    quadrants.forEach(quadrant => {
        const taskList = quadrant.querySelector('.task-list');

        quadrant.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            quadrant.classList.add('drag-over');
        });

        quadrant.addEventListener('dragleave', () => {
            quadrant.classList.remove('drag-over');
        });
        
        quadrant.addEventListener('drop', (e) => {
            e.preventDefault();
            quadrant.classList.remove('drag-over');

            if (draggedTask) {
                const addTaskButton = taskList.querySelector('.add-task');
                
                if (addTaskButton) {
                    taskList.insertBefore(draggedTask, addTaskButton);
                } else {
                    taskList.appendChild(draggedTask);
                }

                // IMPORTANT: Update data with new quadrant attribute
                updateTaskData(draggedTask.getAttribute('data-task-id'), { quadrant: quadrant.getAttribute('data-quadrant') });
            }
        });
    });

    // --- Task Details Modal Logic ---

    // Function to open the modal and populate data
    function openTaskDetails(taskElement) {
        // ... (Modal logic remains the same, using task data) ...
        const taskTitle = taskElement.textContent.trim().split('\n')[0].replace('✓', '').trim();
        const taskId = taskElement.getAttribute('data-task-id');
        const dueDate = taskElement.getAttribute('data-date'); 
        
        // Determine the quadrant key
        const quadrantElement = taskElement.closest('.quadrant');
        const quadrantKey = quadrantElement ? quadrantElement.getAttribute('data-quadrant') : getTaskData(taskId)?.quadrant;

        // 3. Populate form fields
        document.getElementById('current-task-id').value = taskId;
        document.getElementById('task-title').value = taskTitle;
        document.getElementById('task-description').value = ''; 
        
        let dateObj = new Date(dueDate);
        if (!isNaN(dateObj)) {
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            document.getElementById('task-due-date').value = `${yyyy}-${mm}-${dd}`;
        }

        // 4. Populate Tags based on Quadrant (AUTOMATIC ONLY)
        selectedTagsContainer.innerHTML = ''; 
        if (quadrantKey && QUADRANT_TAGS[quadrantKey]) {
            QUADRANT_TAGS[quadrantKey].forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'selected-tag';
                tagSpan.textContent = tag;
                selectedTagsContainer.appendChild(tagSpan);
            });
        }
        
        // 5. Reset other fields
        document.getElementById('task-list').value = 'Personal';
        document.getElementById('subtask-list').innerHTML = `
            <li class="new-subtask">
                <input type="text" placeholder="Add a new subtask">
                <button type="button" class="add-subtask-btn"><i class="fas fa-plus"></i></button>
            </li>
        `;

        modal.style.display = 'block';
    }

    // --- Add New Task Functionality (UPDATED) ---
    const addButtons = document.querySelectorAll('.add-task');
    
    addButtons.forEach(button => {
        button.addEventListener('click', () => {
            const list = button.closest('.task-list');
            const quadrantElement = button.closest('.quadrant');
            const quadrantKey = quadrantElement ? quadrantElement.getAttribute('data-quadrant') : 'do'; // Default to 'do'
            const taskText = prompt("Enter the new task description:");
            
            if (taskText) {
                const today = new Date();
                const dateString = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

                const newTaskData = {
                    id: taskIdCounter++,
                    text: taskText,
                    date: dateString,
                    completed: false,
                    quadrant: quadrantKey
                };

                // 1. Add to central data store
                allTasksData.push(newTaskData);

                // 2. Create the element for the matrix
                const newTaskElement = generateTaskHtmlElement(newTaskData);
                
                // 3. Insert into the matrix view
                list.insertBefore(newTaskElement, button);
            }
        });
    });

    // --- Initialize ---
    switchView('matrix'); // Ensure the matrix view is shown on load
});