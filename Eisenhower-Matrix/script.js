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
    const stickyWallMenuItem = document.getElementById('sticky-wall-menu-item'); 
    const stickyBoard = document.getElementById('sticky-canvas-board');
    const boardColumns = document.querySelectorAll('.board-column'); 

    // NEW TOOLBAR SELECTORS (MAIN)
    const stickyToolbarContainer = document.getElementById('sticky-toolbar-container');
    const stickyNoteToolBtn = document.querySelector('.sticky-note-tool');
    const stickyNoteColorPicker = document.getElementById('sticky-note-color-picker');
    const stampToolBtn = document.querySelector('.stamp-tool');
    const stampRadialMenu = document.getElementById('stamp-radial-menu');

    // NEW TOOLBAR SELECTORS (DRAWING OPTIONS)
    const drawingToolTriggers = document.querySelectorAll('.drawing-tool-trigger');
    const drawingOptionsToolbar = document.getElementById('drawing-options-toolbar');
    const drawingColorSwatches = document.querySelectorAll('.color-swatch-drawing');
    
    const radialCenter = document.querySelector('.radial-center');
    const mainGreeting = document.getElementById('main-greeting');
    const editableQuote = document.getElementById('editable-quote');

    // --- GLOBALS FOR TASK MANAGEMENT ---
    let draggedTask = null;
    let taskIdCounter = 1;
    let isCreatingNewTask = false;
    let newTaskQuadrant = '';
    
    // NEW: Toolbar state variables
    let currentStickyNoteColor = 'yellow'; // Default sticky note color
    let currentStampIcon = '<i class="fas fa-user"></i>'; // Default stamp icon for center
    let activeTool = 'select'; // Default active tool
    
    // NEW: Drawing state variables
    let currentDrawingTool = 'washi'; // Default to washi
    let currentThickness = 'thin';
    let currentDrawingColor = 'black'; 

    // Initialize tasks and load from Local Storage
    let allTasksData = JSON.parse(localStorage.getItem('eisenhowerTasks')) || [];

    const QUADRANT_TAGS = {
        'do': ['Urgent', 'Important'],
        'schedule': ['Not Urgent', 'Important'],
        'delegate': ['Urgent', 'Not Important'],
        'delete': ['Not Urgent', 'Not Important']
    };

    // Mapping for sticky note background colors
    const STICKY_NOTE_BG_COLORS = {
        'yellow': '#fcfc88',
        'white': '#ffffff',
        'pink': '#ffb6c1',
        'orange': '#ffaf4d',
        'green': '#a8e0b6',
        'light-blue': '#a7c8e7',
        'purple': '#d4a9d4',
        'red': '#e7a7a7'
    };

    // --- Initialization ---

    const USER_NAME = "Alice";
    mainGreeting.textContent = `Hi, ${USER_NAME}!`;

    const savedQuote = localStorage.getItem('userQuote');
    if (savedQuote) {
        editableQuote.textContent = savedQuote;
    } else {
        editableQuote.textContent = "Empty quote";
    }

    editableQuote.addEventListener('input', () => {
        localStorage.setItem('userQuote', editableQuote.textContent);
    });

    // --- Core Data Management ---

    function saveTasksToLocalStorage() {
        localStorage.setItem('eisenhowerTasks', JSON.stringify(allTasksData));
    }

    function getTaskData(taskId) {
        return allTasksData.find(task => task.id === parseInt(taskId));
    }

    function updateTaskData(taskId, updates) {
        const taskIndex = allTasksData.findIndex(task => task.id === parseInt(taskId));
        if (taskIndex !== -1) {
            allTasksData[taskIndex] = { ...allTasksData[taskIndex], ...updates };
            saveTasksToLocalStorage();
        }
    }

    // --- Task Rendering/Movement ---

    function handleTaskCompletion(taskElement, isChecked) {
        const taskId = taskElement.getAttribute('data-task-id');
        const now = new Date().toISOString().split('T')[0];

        updateTaskData(taskId, {
            completed: isChecked,
            completedDate: isChecked ? now : null
        });

        if (taskElement.closest('.matrix-grid') && isChecked) {
            taskElement.remove();
        }

        document.querySelectorAll(`.task-item[data-task-id="${taskId}"]`).forEach(item => {
            item.classList.toggle('completed', isChecked);
            item.querySelector('input[type="checkbox"]').checked = isChecked;
        });

        renderAllTasksView();
        renderStickyWall(); 
    }

    function generateTaskHtmlElement(task) {
        const newTask = document.createElement('li');
        newTask.className = `task-item ${task.completed ? 'completed' : ''}`;
        newTask.setAttribute('data-task-id', task.id);
        const sortDate = task.completed && task.completedDate ? task.completedDate : task.date;
        newTask.setAttribute('data-date', sortDate);
        newTask.setAttribute('draggable', 'true');

        let dateString;
        if (task.completed && task.completedDate) {
            const dateObj = new Date(task.completedDate);
            dateString = 'Done: ' + dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else {
            const dateObj = new Date(task.date);
            dateString = isNaN(dateObj.getTime()) ? 'No Due Date' : 'Due: ' + dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        newTask.innerHTML = `
            <i class="fas fa-check"></i> ${task.text}
            <span class="task-date">${dateString}</span>
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
        `;

        setupTaskListeners(newTask);
        setupDragAndDropListeners(newTask);
        return newTask;
    }

    function renderAllTasksView() {
        allTasksList.innerHTML = '';

        const sortedTasks = allTasksData.sort((a, b) => {
            const dateA = a.completed && a.completedDate ? new Date(a.completedDate) : new Date(a.date);
            const dateB = b.completed && b.completedDate ? new Date(b.completedDate) : new Date(b.date);
            return dateB - dateA;
        });

        sortedTasks.forEach(task => {
            const taskElement = generateTaskHtmlElement(task);
            allTasksList.appendChild(taskElement);
        });
    }

    function renderMatrixView() {
        quadrants.forEach(quadrant => {
            const taskList = quadrant.querySelector('.task-list');
            const addTaskButton = taskList.querySelector('.add-task');
            const quadrantKey = quadrant.getAttribute('data-quadrant');

            Array.from(taskList.children).filter(child => !child.classList.contains('add-task')).forEach(child => child.remove());

            const tasksInQuadrant = allTasksData.filter(task => task.quadrant === quadrantKey && !task.completed);

            tasksInQuadrant.forEach(task => {
                const taskElement = generateTaskHtmlElement(task);
                taskList.insertBefore(taskElement, addTaskButton);
            });
        });
    }

    // --- REVISED STICKY WALL RENDER LOGIC (Board View) ---
    function renderStickyWall() {
        boardColumns.forEach(column => {
            const taskList = column.querySelector('.board-task-list');
            const quadrantKey = column.getAttribute('data-quadrant');
            taskList.innerHTML = ''; // Clear existing cards

            const tasksInQuadrant = allTasksData.filter(task => task.quadrant === quadrantKey);

            tasksInQuadrant.forEach(task => {
                const card = createStickyBoardCard(task);
                taskList.appendChild(card);
            });
        });
    }

    function createStickyBoardCard(task) {
        const card = document.createElement('li');
        
        // Use the saved stickyNoteColor for background style
        const bgColor = STICKY_NOTE_BG_COLORS[task.stickyNoteColor] || STICKY_NOTE_BG_COLORS['yellow'];
        
        card.className = `sticky-note-card ${task.quadrant}-color ${task.completed ? 'completed-note' : ''}`;
        card.style.backgroundColor = bgColor; 
        
        if (task.stickyNoteColor === 'white') {
            card.style.border = '1px solid #ddd';
        }

        card.setAttribute('data-task-id', task.id);
        card.setAttribute('draggable', 'true');

        let dateString;
        if (task.completed && task.completedDate) {
            const dateObj = new Date(task.completedDate);
            dateString = 'Completed: ' + dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            const dateObj = new Date(task.date);
            dateString = isNaN(dateObj.getTime()) ? 'No Due Date' : 'Due: ' + dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        card.innerHTML = `
            <h4>${task.text}</h4>
            <p>${task.description || 'No description.'}</p>
            <span class="card-date">${dateString}</span>
        `;
        
        card.addEventListener('click', () => {
             const tempTaskElement = { getAttribute: (attr) => attr === 'data-task-id' ? task.id : null };
             isCreatingNewTask = false;
             openTaskDetails(tempTaskElement);
        });

        setupBoardDragAndDrop(card);
        return card;
    }

    // --- View Switching Logic ---
    function switchView(viewName) {
        document.querySelectorAll('.menu-sections ul li').forEach(item => item.classList.remove('active'));

        // Hide all containers
        matrixContainer.style.display = 'none';
        allTasksContainer.style.display = 'none';
        document.getElementById('sticky-wall-container').style.display = 'none';
        stickyToolbarContainer.style.display = 'none'; 
        drawingOptionsToolbar.classList.remove('show'); // NEW: Hide drawing options bar on view switch

        if (viewName === 'matrix') {
            matrixContainer.style.display = 'block';
            renderMatrixView();
            document.querySelector('.task-item.active')?.classList.remove('active');
            document.querySelector('.task-item:not(#all-tasks-menu-item):not(#sticky-wall-menu-item)')?.classList.add('active');
        } else if (viewName === 'all') {
            allTasksContainer.style.display = 'block';
            renderAllTasksView();
            allTasksMenuItem.classList.add('active');
        } else if (viewName === 'sticky') {
            document.getElementById('sticky-wall-container').style.display = 'block';
            stickyToolbarContainer.style.display = 'flex'; 
            renderStickyWall();
            stickyWallMenuItem.classList.add('active');
            // When switching to sticky wall, re-enable the last active tool
            setActiveTool(activeTool); 
        }
    }

    // --- Drag and Drop Handlers (Unchanged) ---
    function setupDragAndDropListeners(taskElement) {
        taskElement.addEventListener('dragstart', handleDragStart);
        taskElement.addEventListener('dragend', handleDragEnd);
    }

    function setupBoardDragAndDrop(cardElement) {
        cardElement.addEventListener('dragstart', handleDragStart);
        cardElement.addEventListener('dragend', handleDragEnd);
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
            
            if (draggedTask && (draggedTask.closest('.matrix-grid') || draggedTask.closest('#sticky-canvas-board'))) {
                const addTaskButton = taskList.querySelector('.add-task');
                
                if (addTaskButton) {
                    taskList.insertBefore(draggedTask, addTaskButton);
                } else {
                    taskList.appendChild(draggedTask);
                }
                updateTaskData(draggedTask.getAttribute('data-task-id'), { quadrant: quadrant.getAttribute('data-quadrant') });
                
                renderStickyWall(); 
            }
        });
    });

    boardColumns.forEach(column => {
        const taskList = column.querySelector('.board-task-list');

        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            
            if (draggedTask && (draggedTask.classList.contains('task-item') || draggedTask.classList.contains('sticky-note-card'))) {
                
                const targetQuadrant = column.getAttribute('data-quadrant');
                
                updateTaskData(draggedTask.getAttribute('data-task-id'), { quadrant: targetQuadrant });
                
                renderStickyWall(); 
                renderMatrixView(); 
            }
        });
    });

    // --- Event Listeners and Modal Logic (Mostly Unchanged) ---

    function setupTaskListeners(taskElement) {
        taskElement.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
                return;
            }
            const clickedElement = e.target.closest('.task-item');
            if(clickedElement) {
                isCreatingNewTask = false;
                openTaskDetails(clickedElement);
            }
        });

        const checkbox = taskElement.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                handleTaskCompletion(taskElement, checkbox.checked);
            });
        }
    }

    document.querySelector('.matrix-grid').addEventListener('click', (e) => {
        const addButton = e.target.closest('.add-task');
        if (addButton) {
            const quadrantElement = addButton.closest('.quadrant');
            const quadrantKey = quadrantElement ? quadrantElement.getAttribute('data-quadrant') : 'do';
            
            isCreatingNewTask = true;
            newTaskQuadrant = quadrantKey;
            
            openTaskDetails();
        }
    });

    stickyBoard.addEventListener('click', (e) => {
        const addButton = e.target.closest('.add-task-board');
        if (addButton) {
            const columnElement = addButton.closest('.board-column');
            const quadrantKey = columnElement ? columnElement.getAttribute('data-quadrant') : 'do';
            
            isCreatingNewTask = true;
            newTaskQuadrant = quadrantKey;
            
            openTaskDetails();
        }
    });

    allTasksMenuItem.addEventListener('click', () => {
        switchView('all');
    });

    stickyWallMenuItem.addEventListener('click', () => {
        switchView('sticky');
    });

    document.querySelectorAll('.menu-sections ul li').forEach(item => {
        if (item.id !== 'all-tasks-menu-item' && item.id !== 'sticky-wall-menu-item' && !item.classList.contains('list-item')) {
            item.addEventListener('click', () => {
                switchView('matrix');
                document.querySelectorAll('.menu-sections ul li').forEach(navItem => navItem.classList.remove('active'));
                item.classList.add('active');
            });
        }
    });

    function closeTaskDetails() { 
        modal.style.display = 'none'; 
        isCreatingNewTask = false;
        newTaskQuadrant = '';
    }

    function openTaskDetails(taskElement = null) {
        const taskIdInput = document.getElementById('current-task-id');
        const titleInput = document.getElementById('task-title');
        const descInput = document.getElementById('task-description');
        const dateInput = document.getElementById('task-due-date');
        const deleteButton = document.getElementById('delete-task-btn');
        const modalTitle = modal.querySelector('h2');
        
        let taskData = {};

        if (taskElement?.getAttribute('data-task-id')) {
            const taskId = taskElement.getAttribute('data-task-id');
            taskData = getTaskData(taskId);
            
            modalTitle.textContent = 'Edit Task Details';
            deleteButton.style.display = 'inline-block';
            taskIdInput.value = taskId;
            titleInput.value = taskData?.text || '';
            descInput.value = taskData?.description || '';

            const dueDate = taskData?.date;
            let dateObj = new Date(dueDate);
            if (!isNaN(dateObj.getTime())) {
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                dateInput.value = `${yyyy}-${mm}-${dd}`;
            } else {
                 dateInput.value = '';
            }

            selectedTagsContainer.innerHTML = '';
            if (taskData?.quadrant && QUADRANT_TAGS[taskData.quadrant]) {
                QUADRANT_TAGS[taskData.quadrant].forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'selected-tag';
                    tagSpan.textContent = tag;
                    selectedTagsContainer.appendChild(tagSpan);
                });
            }

        } else {
            modalTitle.textContent = 'Create New Task';
            deleteButton.style.display = 'none';
            
            taskIdInput.value = '';
            titleInput.value = '';
            descInput.value = '';
            dateInput.value = '';
            
            selectedTagsContainer.innerHTML = '';
            if (newTaskQuadrant && QUADRANT_TAGS[newTaskQuadrant]) {
                QUADRANT_TAGS[newTaskQuadrant].forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'selected-tag';
                    tagSpan.textContent = tag;
                    selectedTagsContainer.appendChild(tagSpan);
                });
            }
        }
        
        document.getElementById('task-list').value = 'Personal';
        document.getElementById('subtask-list').innerHTML = `
            <li class="new-subtask">
                <input type="text" placeholder="Add a new subtask">
                <button type="button" class="add-subtask-btn"><i class="fas fa-plus"></i></button>
            </li>
        `;
        
        modal.style.display = 'block';
    }

    closeButton.addEventListener('click', closeTaskDetails);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeTaskDetails();
        }
    });
    
    document.getElementById('task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const taskId = document.getElementById('current-task-id').value;
        const newTitle = document.getElementById('task-title').value;
        const newDescription = document.getElementById('task-description').value;
        const newDueDate = document.getElementById('task-due-date').value;

        if (!newTitle.trim()) {
            alert("Task title cannot be empty.");
            return;
        }

        if (isCreatingNewTask) {
            const today = new Date();
            const dateString = newDueDate || today.toISOString().split('T')[0];

            const newTaskData = {
                id: taskIdCounter++,
                text: newTitle,
                date: dateString,
                completed: false,
                completedDate: null,
                quadrant: newTaskQuadrant,
                description: newDescription,
                stickyNoteColor: currentStickyNoteColor 
            };

            allTasksData.push(newTaskData);
            saveTasksToLocalStorage();
            alert('New task created!');

        } else {
            updateTaskData(taskId, {
                text: newTitle,
                description: newDescription,
                date: newDueDate,
            });
            alert('Changes saved!');
        }
        
        isCreatingNewTask = false;
        newTaskQuadrant = '';
        
        renderMatrixView();
        renderAllTasksView();
        renderStickyWall();
        closeTaskDetails();
    });
    
    deleteTaskBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this task?')) {
            const taskIdToDelete = document.getElementById('current-task-id').value;
            allTasksData = allTasksData.filter(task => task.id !== parseInt(taskIdToDelete));
            saveTasksToLocalStorage();

            document.querySelectorAll(`.task-item[data-task-id="${taskIdToDelete}"]`).forEach(el => el.remove());

            alert('Task deleted.');
            closeTaskDetails();
            renderMatrixView();
            renderAllTasksView();
            renderStickyWall();
        }
    });

    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // --- TOOLBAR INTERACTION LOGIC (REVISED) ---

    function setActiveTool(toolName) {
        document.querySelectorAll('.sticky-toolbar .tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const selectedBtn = document.querySelector(`.sticky-toolbar .tool-btn[data-tool="${toolName}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
            activeTool = toolName;
        }
        // Hide all sub-menus and secondary bars when a new main tool is selected
        stickyNoteColorPicker.classList.remove('show');
        stampRadialMenu.classList.remove('show');
        
        // Hide the secondary drawing toolbar when selecting a non-drawing tool
        const isDrawingTool = ['washi', 'eraser', 'highlighter', 'marker'].includes(toolName);
        if (!isDrawingTool) {
            drawingOptionsToolbar.classList.remove('show');
        }
    }
    
    // Function to handle showing/hiding the drawing options bar
    function handleDrawingToolClick(toolName) {
        // 1. Set the main active tool
        setActiveTool(toolName); 

        // 2. Show the secondary options bar
        drawingOptionsToolbar.classList.add('show');
        
        // 3. Update the tool selector inside the secondary bar (UX improvement)
        document.querySelectorAll('#drawing-options-toolbar .tool-selection .secondary-tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#drawing-options-toolbar .tool-selection .secondary-tool-btn[data-tool="${toolName}"]`)?.classList.add('active');

        currentDrawingTool = toolName;
        // console.log(`Current Drawing Tool: ${currentDrawingTool}`);
    }


    // 1. Listener for the main drawing tool buttons (Washi, Eraser, Highlighter, Marker)
    drawingToolTriggers.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            handleDrawingToolClick(tool);
        });
    });

    // 2. Listener for thickness selection in the secondary bar
    document.querySelector('.thickness-options').addEventListener('click', (e) => {
        const thicknessBtn = e.target.closest('.secondary-tool-btn[data-thickness]');
        if (thicknessBtn) {
            document.querySelectorAll('.thickness-options .secondary-tool-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            thicknessBtn.classList.add('active');
            currentThickness = thicknessBtn.getAttribute('data-thickness');
        }
    });

    // 3. Listener for color/pattern selection in the secondary bar
    document.querySelector('.color-pattern-options').addEventListener('click', (e) => {
        const colorSwatch = e.target.closest('.color-swatch-drawing');
        if (colorSwatch) {
            document.querySelectorAll('.color-pattern-options .color-swatch-drawing').forEach(swatch => {
                swatch.classList.remove('active');
            });
            colorSwatch.classList.add('active');
            currentDrawingColor = colorSwatch.getAttribute('data-color');
        }
    });


    // Event listener for all main toolbar buttons (excluding drawing triggers)
    document.querySelectorAll('.sticky-toolbar .tool-btn:not(.drawing-tool-trigger)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tool = btn.getAttribute('data-tool');
            
            // Toggle specific sub-menus (Sticky Note and Stamp)
            if (tool === 'sticky-note') {
                e.stopPropagation(); 
                stickyNoteColorPicker.classList.toggle('show');
                stampRadialMenu.classList.remove('show'); 
                drawingOptionsToolbar.classList.remove('show'); // Hide drawing options
            } else if (tool === 'stamp') {
                e.stopPropagation();
                stampRadialMenu.classList.toggle('show');
                stickyNoteColorPicker.classList.remove('show'); 
                drawingOptionsToolbar.classList.remove('show'); // Hide drawing options
                positionRadialMenuItems(); 
            } else {
                setActiveTool(tool); // Select or Hand
            }
        });
    });

    // Color picker functionality
    stickyNoteColorPicker.addEventListener('click', (e) => {
        const colorSwatch = e.target.closest('.color-swatch');
        if (colorSwatch) {
            document.querySelectorAll('#sticky-note-color-picker .color-swatch').forEach(swatch => {
                swatch.classList.remove('active');
            });
            colorSwatch.classList.add('active');
            currentStickyNoteColor = colorSwatch.getAttribute('data-color');
            stickyNoteColorPicker.classList.remove('show'); 
            setActiveTool('sticky-note'); 
        }
    });

    // Stamp radial menu functionality
    stampRadialMenu.addEventListener('click', (e) => {
        const radialItem = e.target.closest('.radial-item');
        if (radialItem) {
            currentStampIcon = radialItem.innerHTML; 
            radialCenter.innerHTML = currentStampIcon; 
            stampRadialMenu.classList.remove('show'); 
            setActiveTool('stamp'); 
        }
    });

    // Close sub-menus if clicking outside
    document.addEventListener('click', (e) => {
        const stickyNoteBtnElement = document.querySelector('.sticky-note-tool');
        if (stickyNoteColorPicker && stickyNoteBtnElement && !stickyNoteColorPicker.contains(e.target) && !stickyNoteBtnElement.contains(e.target)) {
            stickyNoteColorPicker.classList.remove('show');
        }
        
        const stampBtnElement = document.querySelector('.stamp-tool');
        if (stampRadialMenu && stampBtnElement && !stampRadialMenu.contains(e.target) && !stampBtnElement.contains(e.target)) {
            stampRadialMenu.classList.remove('show');
        }
        
        // Logic for hiding the Drawing Options Toolbar
        const drawingToolsSection = document.querySelector('.drawing-tools-section');
        const drawingToolTriggerClicked = e.target.closest('.drawing-tool-trigger');
        
        // Hide the drawing options bar if click is outside of the options bar AND outside of the main drawing tool buttons
        if (drawingOptionsToolbar.classList.contains('show') && 
            !drawingOptionsToolbar.contains(e.target) && 
            !drawingToolTriggerClicked) {
            
            // If the active tool is a drawing tool, we don't deactivate it, just hide the options
            // If the click was on another non-drawing tool, setActiveTool already hid this bar.
            drawingOptionsToolbar.classList.remove('show');
        }
    });

    // Function to dynamically position radial menu items
    function positionRadialMenuItems() {
        const items = document.querySelectorAll('#stamp-radial-menu .radial-item');
        const numItems = items.length;
        const radius = 70; 
        const centerX = stampRadialMenu.offsetWidth / 2;
        const centerY = stampRadialMenu.offsetHeight / 2;

        items.forEach((item, index) => {
            const angle = (index / numItems) * 2 * Math.PI - (Math.PI / 2); 
            
            const x = centerX + radius * Math.cos(angle) - item.offsetWidth / 2;
            const y = centerY + radius * Math.sin(angle) - item.offsetHeight / 2;
            
            item.style.left = `${x}px`;
            item.style.top = `${y}px`;
        });
    }


    // --- Initial Load ---
    if (allTasksData.length > 0) {
        allTasksData = allTasksData.map(task => ({
             ...task,
             completedDate: task.completedDate !== undefined ? task.completedDate : (task.completed ? task.date : null),
             stickyNoteColor: task.stickyNoteColor !== undefined ? task.stickyNoteColor : 'yellow' 
        }));

        const maxId = Math.max(...allTasksData.map(task => task.id));
        taskIdCounter = maxId + 1;
    }
    
    // Set initial view and active tool
    switchView('matrix');
    setActiveTool('select'); 
});