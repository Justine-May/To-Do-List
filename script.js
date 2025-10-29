// Global context variable for drawing
let ctx; 

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Selectors and Mappings ---
    const modal = document.getElementById('task-details-modal');
    const closeButton = document.querySelector('.close-button');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const quadrants = document.querySelectorAll('.quadrant');
    const matrixContainer = document.getElementById('matrix-container');
    const allTasksContainer = document.getElementById('all-tasks-container');
    const allTasksList = document.getElementById('all-tasks-list');
    
    // Menu item selectors (CRITICAL for view switching)
    const allTasksMenuItem = document.getElementById('all-tasks-menu-item');
    const stickyWallMenuItem = document.getElementById('sticky-wall-menu-item'); 
    const calendarMenuItem = document.getElementById('calendar-menu-item'); // NEW
    const todayMenuItem = document.querySelector('.task-item.active'); 
    
    // Corkboard selectors
    const stickyCanvasBoard = document.getElementById('sticky-canvas-board'); 
    const addNoteCenterBtn = document.getElementById('add-note-center'); 
    
    // Calendar selectors (NEW)
    const calendarContainer = document.getElementById('calendar-container');
    const calendarGrid = document.querySelector('.calendar-grid');
    const currentMonthYearDisplay = document.getElementById('current-month-year');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const selectedDayDateDisplay = document.getElementById('selected-day-date');
    const dailyTaskList = document.getElementById('daily-task-list');

    // Main toolbar selectors
    const stickyToolbarContainer = document.getElementById('sticky-toolbar-container');
    const stickyNoteColorPicker = document.getElementById('sticky-note-color-picker');
    const drawingOptionsToolbar = document.getElementById('drawing-options-toolbar');
    const stampRadialMenu = document.getElementById('stamp-radial-menu');
    const stickyNoteToolBtn = document.getElementById('sticky-note-tool-btn'); 
    const stampToolBtn = document.getElementById('stamp-tool-btn'); 
    const drawingToolBtn = document.getElementById('drawing-tool-btn'); 

    // Form fields
    const taskForm = document.getElementById('task-form');
    const taskIdInput = document.getElementById('current-task-id');
    const taskTitleInput = document.getElementById('task-title');
    const taskDescriptionTextarea = document.getElementById('task-description');
    const taskDueDateInput = document.getElementById('task-due-date');

    // --- Sidebar Toggle Logic (NEW) ---
    const menuToggle = document.querySelector('.menu-toggle');
    const appContainer = document.querySelector('.app-container');
    
    if (menuToggle && appContainer) {
        menuToggle.addEventListener('click', () => {
            appContainer.classList.toggle('collapsed');
            
            // Save state to localStorage (good practice for user preference)
            const isCollapsed = appContainer.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);
        });
        
        // Check local storage for initial state on load
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            appContainer.classList.add('collapsed');
        }
    }
    // --- End Sidebar Toggle Logic ---

    // --- GLOBALS FOR TASK MANAGEMENT ---
    let draggedTask = null;
    let taskIdCounter = 1;
    let isCreatingNewTask = false;
    let newTaskQuadrant = 'do'; 
    
    // Calendar state variables (NEW)
    let currentCalendarDate = new Date(); // Tracks the current month shown
    let selectedCalendarDate = new Date(new Date().toDateString()); // Tracks the currently clicked day (set to today)
    
    // Canvas state variables
    let notePlacementX = 0;
    let notePlacementY = 0;
    let isNewTaskFromCanvas = false; 
    
    // Toolbar state variables (FigmaJam-like)
    let currentStickyNoteColor = 'white'; 
    let activeTool = 'select'; // Default active tool (FigmaJam-like)

    // Hand Tool Panning Variables
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    
    // Drawing Variables (NEW)
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentLineWidth = 8;
    let currentDrawingColor = 'black'; 

    let allTasksData = JSON.parse(localStorage.getItem('eisenhowerTasks')) || [];

    // Initialize taskIdCounter based on loaded data
    if (allTasksData.length > 0) {
        const maxId = Math.max(...allTasksData.map(task => task.id));
        taskIdCounter = maxId + 1;
    }

    const STICKY_NOTE_BG_COLORS = {
        'white': '#ffffff', 'light-gray': '#EAEAEA', 'light-red': '#FFA07A', 
        'light-orange': '#FFD700', 'light-yellow': '#FFFFE0', 'light-green': '#90EE90', 
        'light-blue': '#A7C8E7', 'purple': '#D4A9D4', 'pink': '#ffb6c1'
    };
    
    // --- Canvas Initialization / Resizing (FIX) ---
    const drawingCanvas = document.getElementById('drawing-canvas');

    function resizeCanvas() {
        if (drawingCanvas && stickyCanvasBoard) {
            // Set canvas dimensions to the scrollable area (min-width/height defined in CSS)
            drawingCanvas.width = stickyCanvasBoard.scrollWidth;
            drawingCanvas.height = stickyCanvasBoard.scrollHeight;
            
            // Re-get context on resize, although usually not necessary, it's safer
            ctx = drawingCanvas.getContext('2d');
            
            // Set drawing properties
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            // You might need logic here to redraw previous canvas content if you were saving it.
        }
    }
    
    // Initial canvas setup
    if (drawingCanvas) {
        resizeCanvas();
    }


    // Initial greeting update (for completeness)
    const mainGreeting = document.getElementById('main-greeting');
    if (mainGreeting) mainGreeting.textContent = `Hi, User!`;


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
    
    function deleteTask(taskId) {
        allTasksData = allTasksData.filter(task => task.id !== parseInt(taskId));
        saveTasksToLocalStorage();
        renderMatrixView();
        renderAllTasksView();
        renderStickyWall();
        renderCalendarView(); // NEW
    }
    
    // --- Toolbar and Tool Logic (FigmaJam-like) ---

    function setActiveTool(toolName) {
        // 1. Clear active state on all main tool buttons
        document.querySelectorAll('.sticky-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        
        // 2. Hide radial menus 
        stickyNoteColorPicker.classList.remove('show');
        stampRadialMenu.classList.remove('show');
        
        // 3. Hide secondary drawing toolbar if a non-drawing tool is selected
        if (toolName !== 'marker' && toolName !== 'highlighter' && toolName !== 'eraser') {
            drawingOptionsToolbar.classList.remove('show');
            stickyCanvasBoard.classList.remove('drawing-active'); // DISABLE DRAWING
        }

        // 4. Remove hand tool class from canvas and reset cursor
        stickyCanvasBoard.classList.remove('hand-tool-active');
        stickyCanvasBoard.style.cursor = 'default';
        
        // 5. Update the active tool state
        activeTool = toolName;

        // 6. Apply active state and control canvas behavior
        
        // Find the main tool button based on toolName (handles 'select', 'hand', 'drawing', 'sticky-note', 'stamp')
        const mainToolButton = document.querySelector(`.sticky-toolbar .tool-btn[data-tool="${toolName}"]`);
        if (mainToolButton) {
            mainToolButton.classList.add('active');
        }
        
        // Special case: If a drawing sub-tool is selected, activate the main 'drawing' button and show the sub-toolbar
        if (toolName === 'marker' || toolName === 'highlighter' || toolName === 'eraser') {
            stickyCanvasBoard.classList.add('drawing-active'); // ENABLE DRAWING
            if(drawingToolBtn) drawingToolBtn.classList.add('active');
            drawingOptionsToolbar.classList.add('show');
            
            // Also activate the specific sub-tool button
            document.querySelectorAll('#drawing-options-toolbar .tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
            const subToolButton = document.querySelector(`#drawing-options-toolbar .tool-btn[data-tool="${toolName}"]`);
            if (subToolButton) {
                subToolButton.classList.add('active');
            }
            stickyCanvasBoard.style.cursor = 'crosshair';
        } else if (toolName === 'sticky-note') {
             stickyCanvasBoard.style.cursor = 'copy';
        } else if (toolName === 'hand') {
            stickyCanvasBoard.classList.add('hand-tool-active');
            stickyCanvasBoard.style.cursor = 'grab';
        }
    }
    
    // --- Drawing Function (CRITICAL FIX) ---
    function draw(e) {
        if (!isDrawing || !ctx) return; 

        // Prevent scrolling/panning while drawing
        e.preventDefault(); 
        
        const rect = drawingCanvas.getBoundingClientRect();
        // Get mouse coordinates relative to the canvas viewport
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Adjust coordinates for canvas scroll position to draw in the correct place
        const x = mouseX + stickyCanvasBoard.scrollLeft;
        const y = mouseY + stickyCanvasBoard.scrollTop;
        
        ctx.beginPath();
        
        // Set drawing style based on active tool
        if (activeTool === 'marker') {
            ctx.strokeStyle = currentDrawingColor;
            ctx.lineWidth = currentLineWidth; // 8px
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'source-over'; // Standard draw
        } else if (activeTool === 'highlighter') {
            // Apply a slight opacity to the drawing color for the highlighter effect
            const rgbaColor = currentDrawingColor.startsWith('#') ? hexToRgba(currentDrawingColor, 0.5) : `rgba(${currentDrawingColor}, 0.5)`;
            ctx.strokeStyle = rgbaColor;
            ctx.lineWidth = 20; // Thicker
            ctx.globalAlpha = 1.0; // Alpha is built into the color
            ctx.globalCompositeOperation = 'source-over';
        } else if (activeTool === 'eraser') {
            // Eraser uses destination-out to permanently clear pixels
            ctx.strokeStyle = 'rgba(0,0,0,1)'; // The color doesn't matter for destination-out
            ctx.lineWidth = 30; 
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'destination-out'; // Erase by cutting away existing content
        }

        // Draw the line segment
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
    }

    // Helper function for highlighter color (since colors are defined as hex/names)
    function hexToRgba(hex, alpha) {
        if (hex.toLowerCase() === 'black') return `rgba(0,0,0, ${alpha})`;
        if (hex.toLowerCase() === 'red') return `rgba(255,0,0, ${alpha})`;
        if (hex.toLowerCase() === 'blue') return `rgba(0,0,255, ${alpha})`;
        const bigint = parseInt(hex.slice(1), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // --- Hand Tool Panning Logic ---
    stickyCanvasBoard.addEventListener('mousedown', (e) => {
        // 1. Hand Tool Panning
        if (activeTool === 'hand') {
            e.preventDefault();
            isPanning = true;
            stickyCanvasBoard.classList.add('is-panning');
            startX = e.clientX;
            startY = e.clientY;
            scrollLeft = stickyCanvasBoard.scrollLeft;
            scrollTop = stickyCanvasBoard.scrollTop;
            
            // Disable dragging on all notes while panning
            document.querySelectorAll('.sticky-note-card').forEach(note => note.setAttribute('draggable', 'false'));
            return;
        }
        
        // 2. Sticky Note Creation
        if (activeTool === 'sticky-note') {
            // Only create a note if clicking the empty canvas or the central button
            if (e.target === stickyCanvasBoard || e.target.closest('#add-note-center')) {
                e.preventDefault();
                isNewTaskFromCanvas = true; 
                
                // Get click position relative to the scrollable area
                const rect = stickyCanvasBoard.getBoundingClientRect();
                notePlacementX = e.clientX - rect.left + stickyCanvasBoard.scrollLeft;
                notePlacementY = e.clientY - rect.top + stickyCanvasBoard.scrollTop;
                
                // Open the modal for task input
                openTaskModal(); 
                return;
            }
        }
        
        // 3. Drawing Start
        if (activeTool === 'marker' || activeTool === 'highlighter' || activeTool === 'eraser') {
            if (e.target === drawingCanvas) {
                isDrawing = true;
                const rect = drawingCanvas.getBoundingClientRect();
                // Set initial lastX/lastY, adjusted for scroll position
                lastX = e.clientX - rect.left + stickyCanvasBoard.scrollLeft;
                lastY = e.clientY - rect.top + stickyCanvasBoard.scrollTop;
            }
        }

    });

    stickyCanvasBoard.addEventListener('mousemove', (e) => {
        e.preventDefault(); 
        
        // 1. Panning logic
        if (isPanning) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            // Scroll the canvas
            stickyCanvasBoard.scrollLeft = scrollLeft - dx;
            stickyCanvasBoard.scrollTop = scrollTop - dy;
            return;
        }
        
        // 2. Drawing logic
        if (isDrawing) {
            draw(e);
        }
    });

    window.addEventListener('mouseup', () => {
        // 1. Panning stop
        if (isPanning) {
            isPanning = false;
            stickyCanvasBoard.classList.remove('is-panning');
             // Re-enable dragging on all notes 
            document.querySelectorAll('.sticky-note-card').forEach(note => note.setAttribute('draggable', 'true'));
            return;
        }
        
        // 2. Drawing stop
        if (isDrawing) {
            isDrawing = false;
            // Optionally, save the drawing state here if needed
        }
    });

    // --- End Drawing and Panning Logic ---

    // --- Modal Functions (for Task Details) ---

    function openTaskModal(taskId) {
        // Clear previous state
        taskForm.reset();
        taskIdInput.value = '';
        deleteTaskBtn.style.display = 'none';
        isCreatingNewTask = true;
        
        // Update title and quadrant default for new task
        document.getElementById('task-modal-title').textContent = 'Add New Task';
        const defaultQuadrantSelect = document.getElementById('task-quadrant');
        if (defaultQuadrantSelect) defaultQuadrantSelect.value = newTaskQuadrant; 
        
        // Load existing task data if an ID is provided
        if (taskId !== undefined) {
            const task = getTaskData(taskId);
            if (task) {
                isCreatingNewTask = false;
                document.getElementById('task-modal-title').textContent = 'Edit Task';
                taskIdInput.value = task.id;
                taskTitleInput.value = task.title;
                taskDescriptionTextarea.value = task.description || '';
                taskDueDateInput.value = task.dueDate || '';
                defaultQuadrantSelect.value = task.quadrant;
                deleteTaskBtn.style.display = 'inline-block';
                // Add logic to load tags and subtasks here...
            }
        }
        
        // Show the modal
        modal.style.display = 'block';
    }

    // Event listener to close modal
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Close modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
    
    // Task Form Submission
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const taskId = taskIdInput.value ? parseInt(taskIdInput.value) : taskIdCounter;
            const title = taskTitleInput.value;
            const description = taskDescriptionTextarea.value;
            const dueDate = taskDueDateInput.value;
            const quadrant = document.getElementById('task-quadrant').value;
            
            if (!title.trim()) {
                alert('Task title is required.');
                return;
            }

            let task = getTaskData(taskId);
            
            if (isCreatingNewTask) {
                 // Create a new task object
                 task = {
                    id: taskId,
                    title: title,
                    description: description,
                    dueDate: dueDate,
                    quadrant: quadrant,
                    completed: false,
                    tags: [], // Placeholder for tags
                    subtasks: [], // Placeholder for subtasks
                    // Add canvas properties if the task originated from the sticky wall tool
                    ...(isNewTaskFromCanvas && activeTool === 'sticky-note' && {
                        stickyNoteColor: currentStickyNoteColor,
                        canvasX: notePlacementX,
                        canvasY: notePlacementY,
                        // Reset the state after creation
                        isNewTaskFromCanvas: false
                    })
                 };
                 allTasksData.push(task);
                 taskIdCounter++;
            } else {
                // Update existing task
                updateTaskData(taskId, { title, description, dueDate, quadrant });
            }
            
            saveTasksToLocalStorage();
            modal.style.display = 'none';
            renderMatrixView();
            renderAllTasksView();
            renderStickyWall();
            renderCalendarView(); // NEW
            
            // Reset sticky note creation state
            isNewTaskFromCanvas = false;
        });
    }
    
    // Delete Task button in modal
    if (deleteTaskBtn) {
        deleteTaskBtn.addEventListener('click', () => {
            const taskId = taskIdInput.value;
            if (taskId && confirm('Are you sure you want to delete this task?')) {
                deleteTask(taskId);
                modal.style.display = 'none';
            }
        });
    }

    // --- Rendering Functions ---

    // Renders tasks in the Eisenhower Matrix view
    function renderMatrixView() {
        if (!matrixContainer) return;
        
        // Clear all quadrant task lists
        quadrants.forEach(q => {
            const taskList = q.querySelector('.task-list');
            if (taskList) taskList.innerHTML = '';
        });
        
        allTasksData.filter(task => !task.canvasX && !task.canvasY).forEach(task => {
            const taskElement = createTaskElement(task, 'matrix');
            const targetQuadrant = document.querySelector(`.${task.quadrant} .task-list`);
            if (targetQuadrant) {
                targetQuadrant.appendChild(taskElement);
            }
        });
        
        // Attach event listeners for drag and drop to the matrix elements
        addDragListenersToTasks('.matrix-task-item');
        
        // Hide/Show correct view
        if (matrixContainer.style.display !== 'block') return;
        matrixContainer.style.display = 'block';
        allTasksContainer.style.display = 'none';
        document.getElementById('sticky-wall-container').style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'none';
    }
    
    // Renders tasks in the "All Tasks" list view
    function renderAllTasksView() {
        if (!allTasksList) return;
        allTasksList.innerHTML = ''; 

        allTasksData.forEach(task => {
            const taskElement = createTaskElement(task, 'all-tasks');
            allTasksList.appendChild(taskElement);
        });
        
        // Hide/Show correct view
        if (allTasksContainer.style.display !== 'block') return;
        matrixContainer.style.display = 'none';
        allTasksContainer.style.display = 'block';
        document.getElementById('sticky-wall-container').style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'none';
    }
    
    // Renders the sticky wall
    function renderStickyWall() {
        const wallContainer = document.getElementById('sticky-wall-container');
        if (!wallContainer || !stickyCanvasBoard) return;
        
        // Clear existing notes (but keep the canvas and add button)
        document.querySelectorAll('.sticky-note-card').forEach(note => note.remove());
        
        let notesExist = false;
        allTasksData.filter(task => task.canvasX !== undefined && task.canvasY !== undefined).forEach(task => {
            const noteElement = createStickyNoteElement(task);
            stickyCanvasBoard.appendChild(noteElement);
            notesExist = true;
        });
        
        // Hide/Show the central add button
        if (addNoteCenterBtn) {
            addNoteCenterBtn.style.display = notesExist ? 'none' : 'block';
        }
        
        // Hide/Show the toolbar
        if (stickyToolbarContainer) {
            stickyToolbarContainer.style.display = 'flex'; // Always show the toolbar on this view
        }

        // Hide/Show correct view
        if (wallContainer.style.display !== 'block') return;
        matrixContainer.style.display = 'none';
        allTasksContainer.style.display = 'none';
        wallContainer.style.display = 'block';
        if (calendarContainer) calendarContainer.style.display = 'none';
    }
    
    // Renders the calendar view
    function renderCalendarView(month = currentCalendarDate.getMonth(), year = currentCalendarDate.getFullYear()) {
        if (!calendarContainer || !calendarGrid) return;
        
        // Update state and header
        currentCalendarDate.setMonth(month, 1); // Set to the 1st of the month
        currentCalendarDate.setFullYear(year); 
        
        if (currentMonthYearDisplay) {
            currentMonthYearDisplay.textContent = currentCalendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        }

        // Set initial selected day list content
        updateDailyTaskList(selectedCalendarDate);

        calendarGrid.innerHTML = ''; // Clear the grid (but keep day names)
        
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday...
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Add headers (Sunday - Saturday)
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const header = document.createElement('div');
            header.className = 'day-name';
            header.textContent = day;
            calendarGrid.appendChild(header);
        });
        
        // Helper to check if two dates are the same day
        const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
        
        // Add padding days for the previous month
        const startDay = firstDayOfMonth; // If first day is Sunday (0), this is 0
        for (let i = 0; i < startDay; i++) {
            const paddingDay = document.createElement('div');
            paddingDay.className = 'calendar-day inactive';
            calendarGrid.appendChild(paddingDay);
        }

        // Add actual days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            // Check if this day is the current selected day
            if (selectedCalendarDate && isSameDay(date, selectedCalendarDate)) {
                dayElement.classList.add('selected');
            }
            
            dayElement.setAttribute('data-date', date.toISOString().split('T')[0]); // YYYY-MM-DD format
            
            // Day Number
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayElement.appendChild(dayNumber);
            
            // Task Markers
            const tasksForDay = allTasksData.filter(task => task.dueDate && isSameDay(new Date(task.dueDate), date));
            if (tasksForDay.length > 0) {
                const markersContainer = document.createElement('div');
                markersContainer.className = 'task-markers';
                tasksForDay.forEach(task => {
                    const marker = document.createElement('span');
                    marker.className = `task-marker marker-${task.quadrant}`;
                    markersContainer.appendChild(marker);
                });
                dayElement.appendChild(markersContainer);
            }
            
            dayElement.addEventListener('click', (e) => {
                // Remove selected class from all days
                document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
                // Add selected class to the clicked day
                dayElement.classList.add('selected');
                
                // Update selected date state and task list
                selectedCalendarDate = date;
                updateDailyTaskList(selectedCalendarDate);
            });
            
            calendarGrid.appendChild(dayElement);
        }

        // Hide/Show correct view
        if (calendarContainer.style.display !== 'block') return;
        matrixContainer.style.display = 'none';
        allTasksContainer.style.display = 'none';
        document.getElementById('sticky-wall-container').style.display = 'none';
        calendarContainer.style.display = 'block';
    }

    // Controls for calendar month navigation
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            renderCalendarView(currentCalendarDate.getMonth() - 1, currentCalendarDate.getFullYear());
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            renderCalendarView(currentCalendarDate.getMonth() + 1, currentCalendarDate.getFullYear());
        });
    }

    // Updates the list of tasks for the currently selected day
    function updateDailyTaskList(date) {
        if (!selectedDayDateDisplay || !dailyTaskList) return;

        selectedDayDateDisplay.textContent = date ? date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No Day Selected';
        dailyTaskList.innerHTML = '';
        
        if (!date) return;
        
        const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
        
        const tasksForDay = allTasksData.filter(task => task.dueDate && isSameDay(new Date(task.dueDate), date));

        if (tasksForDay.length === 0) {
            dailyTaskList.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No tasks scheduled for this day.</p>';
            return;
        }

        tasksForDay.forEach(task => {
            const listItem = createTaskElement(task, 'calendar-list');
            dailyTaskList.appendChild(listItem);
        });
    }
    
    // --- Element Creators ---

    // Creates a common task list item for Matrix and All Tasks views
    function createTaskElement(task, viewType = 'matrix') {
        const listItem = document.createElement('li');
        listItem.classList.add('task-item');
        listItem.classList.add(`${viewType}-task-item`);
        listItem.setAttribute('data-task-id', task.id);
        listItem.setAttribute('draggable', viewType === 'matrix' ? 'true' : 'false');
        
        if (task.completed) {
            listItem.classList.add('completed');
        }

        // Main task content (flexed)
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.flexGrow = '1';
        
        // Checkbox/Icon
        const icon = document.createElement('i');
        icon.className = `fas fa-check ${task.completed ? '' : 'fa-list-check'}`;
        icon.style.color = task.completed ? '#5cb85c' : '#6a40e1';
        icon.style.cursor = 'pointer';
        icon.style.minWidth = '20px'; // Prevent icon jumping
        icon.style.textAlign = 'center';
        icon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening modal
            updateTaskData(task.id, { completed: !task.completed });
            renderMatrixView();
            renderAllTasksView();
            renderCalendarView();
        });
        
        // Title Span
        const titleSpan = document.createElement('span');
        titleSpan.textContent = task.title;
        titleSpan.style.marginLeft = '10px';
        titleSpan.style.flexGrow = '1';

        // Date Span (only for All Tasks/Calendar views)
        if (viewType === 'all-tasks' || viewType === 'calendar-list') {
            const dateSpan = document.createElement('span');
            dateSpan.className = 'task-date';
            dateSpan.textContent = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date';
            content.appendChild(dateSpan);
        }

        content.appendChild(icon);
        content.appendChild(titleSpan);

        listItem.appendChild(content);

        // Click to open modal
        listItem.addEventListener('click', () => {
            newTaskQuadrant = task.quadrant; // Set quadrant for the form
            openTaskModal(task.id);
        });

        // Add quadrant color dot to all-tasks view
        if (viewType === 'all-tasks' || viewType === 'calendar-list') {
             const dot = document.createElement('span');
             dot.className = `color-dot ${task.quadrant}`;
             dot.style.marginLeft = '10px';
             
             // Simple color mapping for dot backgrounds (should match CSS)
             let dotColor;
             switch(task.quadrant) {
                 case 'do': dotColor = '#d9534f'; break; // Red
                 case 'schedule': dotColor = '#5bc0de'; break; // Blue
                 case 'delegate': dotColor = '#f0ad4e'; break; // Yellow/Orange
                 case 'delete': dotColor = '#5cb85c'; break; // Green
                 default: dotColor = '#ccc';
             }
             dot.style.backgroundColor = dotColor;
             
             listItem.style.borderLeftColor = dotColor; // Use dot color for border
             
             listItem.appendChild(dot);
        }
        
        return listItem;
    }
    
    // Creates a sticky note element for the corkboard view
    function createStickyNoteElement(task) {
        const note = document.createElement('div');
        note.className = 'sticky-note-card';
        note.setAttribute('data-task-id', task.id);
        note.setAttribute('draggable', 'true'); // Notes are always draggable
        
        // Position the note based on saved coordinates
        if (task.canvasX !== undefined && task.canvasY !== undefined) {
            note.style.left = `${task.canvasX}px`;
            note.style.top = `${task.canvasY}px`;
        }
        
        // Set background color
        const bgColor = STICKY_NOTE_BG_COLORS[task.stickyNoteColor] || STICKY_NOTE_BG_COLORS['white'];
        note.style.backgroundColor = bgColor;
        
        // Title (ContentEditable)
        const title = document.createElement('h4');
        title.setAttribute('contenteditable', 'true');
        title.setAttribute('placeholder', 'Note Title');
        title.textContent = task.title;
        title.addEventListener('blur', (e) => {
            updateTaskData(task.id, { title: e.target.textContent });
        });
        
        // Description (ContentEditable)
        const description = document.createElement('p');
        description.setAttribute('contenteditable', 'true');
        description.setAttribute('placeholder', 'Note content...');
        description.textContent = task.description || '';
        description.addEventListener('blur', (e) => {
            updateTaskData(task.id, { description: e.target.textContent });
        });
        
        // Date
        const date = document.createElement('span');
        date.className = 'card-date';
        date.textContent = task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'No Due Date';

        // Append to note
        note.appendChild(title);
        note.appendChild(description);
        note.appendChild(date);
        
        // Add listeners for movement
        addStickyNoteDragListeners(note, task.id);

        return note;
    }


    // --- View Switching Logic ---

    function switchView(viewName) {
        // Hide all main containers
        matrixContainer.style.display = 'none';
        allTasksContainer.style.display = 'none';
        document.getElementById('sticky-wall-container').style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'none';
        
        // Hide/Show the toolbar (only visible on sticky wall)
        if (stickyToolbarContainer) {
            stickyToolbarContainer.style.display = viewName === 'sticky-wall' ? 'flex' : 'none';
        }
        
        // Remove 'active' class from all main menu items
        document.querySelectorAll('.menu-sections .task-item').forEach(item => item.classList.remove('active'));

        // Show the selected container and set menu item active
        if (viewName === 'matrix') {
            matrixContainer.style.display = 'block';
            if (todayMenuItem) todayMenuItem.classList.add('active'); 
            renderMatrixView(); // Re-render to ensure data is fresh
        } else if (viewName === 'all-tasks') {
            allTasksContainer.style.display = 'block';
            if (allTasksMenuItem) allTasksMenuItem.classList.add('active'); 
            renderAllTasksView(); // Re-render to ensure data is fresh
        } else if (viewName === 'sticky-wall') {
            document.getElementById('sticky-wall-container').style.display = 'block';
            if (stickyWallMenuItem) stickyWallMenuItem.classList.add('active');
            renderStickyWall(); // Re-render to ensure data is fresh
            setActiveTool(activeTool); // Ensure tool is active and cursor is set
        } else if (viewName === 'calendar') {
            if (calendarContainer) calendarContainer.style.display = 'block';
            if (calendarMenuItem) calendarMenuItem.classList.add('active');
            renderCalendarView(); // Re-render to ensure data is fresh
        }
    }

    // Attach view switch listeners
    if (todayMenuItem) todayMenuItem.addEventListener('click', () => switchView('matrix'));
    if (allTasksMenuItem) allTasksMenuItem.addEventListener('click', () => switchView('all-tasks'));
    if (stickyWallMenuItem) stickyWallMenuItem.addEventListener('click', () => switchView('sticky-wall'));
    if (calendarMenuItem) calendarMenuItem.addEventListener('click', () => switchView('calendar'));


    // --- Drag and Drop Logic (Matrix View) ---

    function addDragListenersToTasks(selector) {
        document.querySelectorAll(selector).forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedTask = item;
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('is-dragging');
            });

            item.addEventListener('dragend', () => {
                draggedTask.classList.remove('is-dragging');
                draggedTask = null;
            });
        });

        quadrants.forEach(quadrant => {
            quadrant.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow drop
                e.dataTransfer.dropEffect = 'move';
                quadrant.classList.add('drag-over');
            });

            quadrant.addEventListener('dragleave', () => {
                quadrant.classList.remove('drag-over');
            });

            quadrant.addEventListener('drop', (e) => {
                e.preventDefault();
                quadrant.classList.remove('drag-over');
                
                if (draggedTask) {
                    const taskId = draggedTask.getAttribute('data-task-id');
                    const newQuadrant = quadrant.classList.contains('do') ? 'do' : 
                                        quadrant.classList.contains('schedule') ? 'schedule' : 
                                        quadrant.classList.contains('delegate') ? 'delegate' : 'delete';
                                        
                    updateTaskData(taskId, { quadrant: newQuadrant });
                    renderMatrixView(); // Re-render the whole matrix for simplicity
                }
            });
        });
    }

    // --- Drag and Drop Logic (Sticky Wall View) ---

    function addStickyNoteDragListeners(note, taskId) {
        note.addEventListener('dragstart', (e) => {
            if (activeTool === 'select' || activeTool === 'sticky-note') {
                 // Use a slight offset to position the cursor correctly
                const offsetX = e.clientX - note.getBoundingClientRect().left;
                const offsetY = e.clientY - note.getBoundingClientRect().top;
                e.dataTransfer.setDragImage(note, offsetX, offsetY); 
                e.dataTransfer.setData('text/plain', taskId); // Pass ID
                e.dataTransfer.effectAllowed = 'move';
                note.classList.add('is-dragging');
            } else {
                e.preventDefault(); // Prevent dragging if another tool is active
            }
        });
        
        // This is a common pattern for drag-on-dragend on a canvas (where you can't use dropzone)
        stickyCanvasBoard.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            e.dataTransfer.dropEffect = 'move';
        });

        stickyCanvasBoard.addEventListener('drop', (e) => {
            e.preventDefault();
            const droppedTaskId = e.dataTransfer.getData('text/plain');
            const noteToMove = document.querySelector(`.sticky-note-card[data-task-id="${droppedTaskId}"]`);
            
            if (noteToMove) {
                // Calculate new position relative to the scrollable container
                const newX = e.clientX + stickyCanvasBoard.scrollLeft - stickyCanvasBoard.getBoundingClientRect().left;
                const newY = e.clientY + stickyCanvasBoard.scrollTop - stickyCanvasBoard.getBoundingClientRect().top;
                
                noteToMove.style.left = `${newX}px`;
                noteToMove.style.top = `${newY}px`;
                
                // Update the data
                updateTaskData(droppedTaskId, { 
                    canvasX: newX, 
                    canvasY: newY
                });
            }
        });

        note.addEventListener('dragend', () => {
            note.classList.remove('is-dragging');
        });
    }

    // --- Toolbar Event Listeners ---
    
    // Tool buttons (Select, Hand, Sticky Note, Stamp, Drawing)
    document.querySelectorAll('.sticky-toolbar .tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            setActiveTool(tool);
            
            // Toggle radial menus explicitly
            if (tool === 'sticky-note') {
                stickyNoteColorPicker.classList.toggle('show');
                stampRadialMenu.classList.remove('show');
            } else if (tool === 'stamp') {
                stampRadialMenu.classList.toggle('show');
                stickyNoteColorPicker.classList.remove('show');
            }
        });
    });

    // Sticky Note Color Picker Swatches
    if (stickyNoteColorPicker) {
        stickyNoteColorPicker.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (swatch) {
                // Update active color in state
                currentStickyNoteColor = swatch.getAttribute('data-color');
                
                // Update active swatch visual
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
            }
        });
    }
    
    // Drawing Sub-Tool buttons (Marker, Highlighter, Eraser)
    document.querySelectorAll('#drawing-options-toolbar .tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            setActiveTool(tool);
        });
    });
    
    // Drawing Color Swatches (Secondary Toolbar)
    document.querySelectorAll('#drawing-options-toolbar .color-swatch-drawing').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.getAttribute('data-color');
            currentDrawingColor = color;
            
            document.querySelectorAll('#drawing-options-toolbar .color-swatch-drawing').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
        });
    });
    
    // Initial load logic
    function initializeApp() {
        // Data sanitization/migration to ensure all new fields exist
        allTasksData = allTasksData.map(task => ({
             id: task.id,
             title: task.title,
             description: task.description,
             dueDate: task.dueDate,
             completed: task.completed,
             tags: task.tags || [],
             subtasks: task.subtasks || [],
             // Ensure legacy tasks get quadrant/sticky info
             completedDate: task.completedDate !== undefined ? task.completedDate : (task.completed ? task.date : null),
             stickyNoteColor: task.stickyNoteColor !== undefined ? task.stickyNoteColor : 'white',
             quadrant: task.quadrant !== undefined ? task.quadrant : (task.canvasX === undefined && task.canvasY === undefined ? 'do' : undefined),
             canvasX: task.canvasX !== undefined ? task.canvasX : undefined, 
             canvasY: task.canvasY !== undefined ? task.canvasY : undefined  
        }));

        const maxId = allTasksData.length > 0 ? Math.max(...allTasksData.map(task => task.id)) : 0;
        taskIdCounter = maxId + 1;
    }
    
    // Populate and set initial active color for sticky note picker
    if(stickyNoteColorPicker) {
        stickyNoteColorPicker.innerHTML = ''; // Clear placeholders
        Object.keys(STICKY_NOTE_BG_COLORS).forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.setAttribute('data-color', color);
            swatch.style.backgroundColor = STICKY_NOTE_BG_COLORS[color];
            if (color === currentStickyNoteColor) {
                swatch.classList.add('active');
            }
            stickyNoteColorPicker.appendChild(swatch);
        });
    }

    // Initial render and view set
    initializeApp();
    renderMatrixView();
    renderAllTasksView();
    renderCalendarView(); // Initial calendar rendering for data load, but view is set to matrix
    switchView('matrix'); // Start with the matrix view by default
    setActiveTool('select'); // Default active tool on sticky wall
});