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
    const todayMenuItem = document.querySelector('.task-item.active'); 
    
    // Corkboard selectors
    const stickyCanvasBoard = document.getElementById('sticky-canvas-board'); 
    const addNoteCenterBtn = document.getElementById('add-note-center'); 
    
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

    // --- GLOBALS FOR TASK MANAGEMENT ---
    let draggedTask = null;
    let taskIdCounter = 1;
    let isCreatingNewTask = false;
    let newTaskQuadrant = 'do'; 
    
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
                 // Calculate coordinates relative to the canvas's scroll position
                 notePlacementX = e.offsetX; 
                 notePlacementY = e.offsetY; 
                 
                 // If clicking the central button, place the note just below it
                 if (e.target.closest('#add-note-center')) {
                     // Get the canvas board center and adjust for scroll position
                     const centerX = stickyCanvasBoard.scrollWidth / 2;
                     const centerY = stickyCanvasBoard.scrollHeight / 2;
                     notePlacementX = centerX + 20; 
                     notePlacementY = centerY + 20; 
                 }
                 
                 const newNoteText = 'New Sticky Note'; 
                 const newNoteDescription = 'Start typing here...';

                 const newTask = {
                    id: taskIdCounter++,
                    text: newNoteText,
                    description: newNoteDescription,
                    date: new Date().toISOString().split('T')[0],
                    quadrant: undefined, 
                    completed: false,
                    stickyNoteColor: currentStickyNoteColor,
                    canvasX: notePlacementX,
                    canvasY: notePlacementY
                };

                allTasksData.push(newTask);
                saveTasksToLocalStorage();
                renderStickyWall(); 
                
                // Immediately switch to Select tool and focus on the new note
                setActiveTool('select');
                
                const newCard = document.querySelector(`.sticky-note-card[data-task-id="${newTask.id}"]`);
                if (newCard) {
                    newCard.querySelector('h4').focus();
                }
             }
        }
    });

    stickyCanvasBoard.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        // Apply inverse movement to the scroll position
        stickyCanvasBoard.scrollLeft = scrollLeft - dx;
        stickyCanvasBoard.scrollTop = scrollTop - dy;
    });

    stickyCanvasBoard.addEventListener('mouseup', () => {
        isPanning = false;
        stickyCanvasBoard.classList.remove('is-panning');
        
        // Re-enable dragging on all notes after panning stops
        document.querySelectorAll('.sticky-note-card').forEach(note => note.setAttribute('draggable', 'true'));
    });

    stickyCanvasBoard.addEventListener('mouseleave', () => {
        isPanning = false;
        stickyCanvasBoard.classList.remove('is-panning');
        
        // Re-enable dragging on all notes
        document.querySelectorAll('.sticky-note-card').forEach(note => note.setAttribute('draggable', 'true'));
    });
    
    // --- Drawing Tool Event Listeners (CRITICAL FIX) ---
    if (drawingCanvas) {
        drawingCanvas.addEventListener('mousedown', (e) => {
            if (activeTool === 'marker' || activeTool === 'highlighter' || activeTool === 'eraser') {
                isDrawing = true;
                // Get coordinates relative to canvas viewport
                const rect = drawingCanvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // Adjust coordinates for canvas scroll position
                lastX = mouseX + stickyCanvasBoard.scrollLeft;
                lastY = mouseY + stickyCanvasBoard.scrollTop;
                draw(e); // Start drawing immediately
            }
        });

        drawingCanvas.addEventListener('mousemove', draw);

        drawingCanvas.addEventListener('mouseup', () => {
            isDrawing = false;
        });

        drawingCanvas.addEventListener('mouseleave', () => {
            isDrawing = false;
        });
    }


    // --- Task Rendering/Movement ---
    // ... (rest of the task logic functions remain the same: handleTaskCompletion, generateTaskHtmlElement, renderAllTasksView, renderMatrixView) ...

    function handleTaskCompletion(taskElement, isChecked) {
        const taskId = taskElement.getAttribute('data-task-id');
        const now = new Date().toISOString().split('T')[0];

        updateTaskData(taskId, {
            completed: isChecked,
            completedDate: isChecked ? now : null
        });
        
        // Remove from Matrix immediately if completed
        if (taskElement.closest('.matrix-grid') && isChecked) {
            taskElement.remove();
        }
        
        // Sync completion status across all views (sidebar, all tasks, sticky wall)
        document.querySelectorAll(`[data-task-id="${taskId}"]`).forEach(item => {
             // For list items
            if (item.classList.contains('task-item')) {
                item.classList.toggle('completed', isChecked);
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = isChecked;
            }
             // For sticky notes
            if (item.classList.contains('sticky-note-card')) {
                 item.classList.toggle('completed-note', isChecked);
            }
        });

        renderAllTasksView();
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

            // Only show non-completed tasks that belong in the matrix (i.e., don't have canvas coords)
            const tasksInQuadrant = allTasksData.filter(task => 
                task.quadrant === quadrantKey && 
                !task.completed &&
                task.canvasX === undefined &&
                task.canvasY === undefined
            );

            tasksInQuadrant.forEach(task => {
                const taskElement = generateTaskHtmlElement(task);
                taskList.insertBefore(taskElement, addTaskButton); 
            });
        });
    }


    // --- CORKBOARD RENDER LOGIC ---
    function renderStickyWall() {
        // Clear all previous notes but keep the central button and the drawing canvas
        const notesAndCanvas = stickyCanvasBoard.querySelectorAll('.sticky-note-card, #drawing-canvas');
        notesAndCanvas.forEach(el => {
            if (el.id !== 'drawing-canvas') {
                el.remove();
            }
        });

        const canvasTasks = allTasksData.filter(task => task.canvasX !== undefined && task.canvasY !== undefined);

        canvasTasks.forEach(task => {
            const card = createStickyBoardCard(task);
            stickyCanvasBoard.appendChild(card);
        });
        
        // Hide/Show the central button based on whether any notes exist
        addNoteCenterBtn.style.display = canvasTasks.length === 0 ? 'block' : 'none';
    }

    function createStickyBoardCard(task) {
        const card = document.createElement('div'); 
        
        const bgColor = STICKY_NOTE_BG_COLORS[task.stickyNoteColor] || STICKY_NOTE_BG_COLORS['white']; 
        
        card.className = `sticky-note-card ${task.completed ? 'completed-note' : ''}`;
        card.style.backgroundColor = bgColor; 
        
        card.style.position = 'absolute';
        card.style.left = `${task.canvasX}px`;
        card.style.top = `${task.canvasY}px`;
        
        if (task.stickyNoteColor === 'white') {
            card.style.border = '1px solid #ddd';
        }

        card.setAttribute('data-task-id', task.id);
        card.setAttribute('draggable', 'true'); 

        let dateString = task.date ? new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No Due Date';

        card.innerHTML = `
            <h4 contenteditable="true">${task.text}</h4>
            <p contenteditable="true">${task.description || 'No description.'}</p>
            <span class="card-date">${dateString}</span>
        `;
        
        card.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.addEventListener('blur', (e) => {
                const taskId = card.getAttribute('data-task-id');
                const updatedField = e.target.tagName === 'H4' ? 'text' : 'description';
                updateTaskData(taskId, { [updatedField]: e.target.textContent });
            });
        });
        
        card.addEventListener('click', (e) => {
            // Prevent modal from opening if clicking to edit text or if currently dragging
            if (e.target.hasAttribute('contenteditable') || card.classList.contains('is-dragging')) return;
            openTaskDetails(card);
        });

        setupBoardDragAndDrop(card);
        return card;
    }

    // --- Drag and Drop Handlers (The movement logic remains the same) ---

    function setupDragAndDropListeners(taskElement) {
        taskElement.addEventListener('dragstart', handleDragStart);
        taskElement.addEventListener('dragend', handleDragEnd);
    }
    
    function setupBoardDragAndDrop(cardElement) {
        cardElement.addEventListener('dragstart', handleCanvasDragStart);
        cardElement.addEventListener('dragend', handleCanvasDragEnd);
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
    
    function handleCanvasDragStart(e) {
        draggedTask = this;
        setTimeout(() => this.classList.add('is-dragging'), 0);
        e.dataTransfer.setData('text/plain', this.getAttribute('data-task-id'));
        
        const rect = this.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setData('application/x-drag-offset-x', offsetX);
        e.dataTransfer.setData('application/x-drag-offset-y', offsetY);
    }
    
    function handleCanvasDragEnd() {
        this.classList.remove('is-dragging');
        draggedTask = null;
    }

    // Matrix Drop Zone
    quadrants.forEach(quadrant => {
        quadrant.addEventListener('dragover', (e) => { e.preventDefault(); quadrant.classList.add('drag-over'); });
        quadrant.addEventListener('dragleave', () => { quadrant.classList.remove('drag-over'); });
        quadrant.addEventListener('drop', (e) => {
            e.preventDefault();
            quadrant.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const targetQuadrant = quadrant.getAttribute('data-quadrant');
            
            const taskData = getTaskData(taskId);
            if (taskData) {
                updateTaskData(taskId, { 
                    quadrant: targetQuadrant,
                    // Remove canvas coordinates when dropping back into Matrix
                    canvasX: undefined, 
                    canvasY: undefined
                }); 
            }
            renderMatrixView();
            renderStickyWall();
        });
    });


    // Sticky Canvas Drop Zone
    stickyCanvasBoard.addEventListener('dragover', (e) => {
        e.preventDefault();
        stickyCanvasBoard.classList.add('drag-over');
    });

    stickyCanvasBoard.addEventListener('dragleave', () => {
        stickyCanvasBoard.classList.remove('drag-over');
    });

    stickyCanvasBoard.addEventListener('drop', (e) => {
        e.preventDefault();
        stickyCanvasBoard.classList.remove('drag-over');
        
        const taskId = e.dataTransfer.getData('text/plain');
        const taskData = getTaskData(taskId);
        
        if (taskData) {
            const offsetX = parseFloat(e.dataTransfer.getData('application/x-drag-offset-x')) || 0;
            const offsetY = parseFloat(e.dataTransfer.getData('application/x-drag-offset-y')) || 0;
            
            // Calculate new position relative to the canvas's scroll position
            const canvasRect = stickyCanvasBoard.getBoundingClientRect();
            let newX = e.clientX - canvasRect.left - offsetX + stickyCanvasBoard.scrollLeft;
            let newY = e.clientY - canvasRect.top - offsetY + stickyCanvasBoard.scrollTop;

            const noteWidth = 200;
            const noteHeight = 150; 
            // Boundary checks
            newX = Math.max(0, newX);
            newY = Math.max(0, newY);
            newX = Math.min(newX, stickyCanvasBoard.scrollWidth - noteWidth);
            newY = Math.min(newY, stickyCanvasBoard.scrollHeight - noteHeight);

            updateTaskData(taskId, {
                canvasX: newX,
                canvasY: newY,
                // Ensure note is removed from Matrix quadrant view if dropped on canvas
                quadrant: undefined 
            });

            renderStickyWall();
            renderMatrixView();
        }
    });

    // --- View Switching Logic (FIX: Added resizeCanvas call) ---
    function switchView(viewName) {
        // 1. Reset all active menu items
        document.querySelectorAll('.menu-sections ul li').forEach(item => item.classList.remove('active'));

        // 2. Hide all main containers
        matrixContainer.style.display = 'none';
        allTasksContainer.style.display = 'none';
        document.getElementById('sticky-wall-container').style.display = 'none';

        // 3. Hide toolbar and sub-menus by default (except when sticky is active)
        stickyToolbarContainer.style.display = 'none';
        drawingOptionsToolbar.classList.remove('show');
        stickyNoteColorPicker.classList.remove('show');
        stampRadialMenu.classList.remove('show');

        // 4. Show the selected view
        if (viewName === 'matrix') {
            matrixContainer.style.display = 'block';
            renderMatrixView();
            if (todayMenuItem) todayMenuItem.classList.add('active');
        } else if (viewName === 'all') {
            allTasksContainer.style.display = 'block';
            renderAllTasksView();
            allTasksMenuItem.classList.add('active');
        } else if (viewName === 'sticky') {
            document.getElementById('sticky-wall-container').style.display = 'block';
            stickyToolbarContainer.style.display = 'flex'; // Show the toolbar
            resizeCanvas(); // CRITICAL FIX: Ensure canvas is sized correctly when view loads
            renderStickyWall();
            setActiveTool(activeTool); // Re-activate the last tool, defaults to 'select' on first load.
            stickyWallMenuItem.classList.add('active');
        }
    }

    // --- Modal and Form Logic ---
    // ... (modal functions remain the same: setupTaskListeners, openTaskDetails, closeModal, form submit logic) ...

    function setupTaskListeners(taskElement) {
        taskElement.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                openTaskDetails(taskElement);
            }
        });

        const checkbox = taskElement.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                handleTaskCompletion(taskElement, e.target.checked);
            });
        }
    }

    function openTaskDetails(element) {
        const taskId = element.getAttribute('data-task-id');
        const task = getTaskData(taskId);
        
        if (!task) return; 

        isCreatingNewTask = false;
        taskIdInput.value = task.id;
        taskTitleInput.value = task.text;
        taskDescriptionTextarea.value = task.description || '';
        document.getElementById('task-quadrant').value = task.quadrant || 'do';
        taskDueDateInput.value = task.date;
        
        // Tags and subtasks logic would be here if fully implemented
        
        modal.style.display = 'block';
        deleteTaskBtn.style.display = 'inline-block';
    }

    function closeModal() {
        modal.style.display = 'none';
        isCreatingNewTask = false; 
        taskForm.reset();
        // Clear inputs that are not part of reset()
        taskIdInput.value = ''; 
    }

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const taskId = taskIdInput.value;
        
        const updates = {
            text: taskTitleInput.value,
            description: taskDescriptionTextarea.value,
            date: taskDueDateInput.value,
            quadrant: document.getElementById('task-quadrant').value,
        };

        if (taskId) {
            updateTaskData(taskId, updates);
        } else {
             // This is mostly for matrix/list view creation
            const newTask = {
                ...updates,
                id: taskIdCounter++,
                completed: false,
                stickyNoteColor: currentStickyNoteColor,
                // Ensure new tasks created from form do NOT have canvas coords
                canvasX: undefined,
                canvasY: undefined
            };
            allTasksData.push(newTask);
            saveTasksToLocalStorage();
        }

        closeModal();
        renderMatrixView();
        renderAllTasksView();
        renderStickyWall(); // Ensure sticky wall is updated if tasks change
    });


    // --- Event Listeners ---

    // Modal Close
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Delete Task
    deleteTaskBtn.addEventListener('click', () => {
        if (taskIdInput.value) {
            deleteTask(taskIdInput.value);
            closeModal();
        }
    });

    // Add Task button listeners (in Matrix)
    document.querySelectorAll('.add-task').forEach(btn => {
        btn.addEventListener('click', (e) => {
            isCreatingNewTask = true;
            newTaskQuadrant = e.target.closest('.quadrant').getAttribute('data-quadrant');
            taskForm.reset();
            document.getElementById('task-quadrant').value = newTaskQuadrant;
            modal.style.display = 'block';
            deleteTaskBtn.style.display = 'none';
            taskTitleInput.focus();
        });
    });

    // View Switching Listeners
    if (todayMenuItem) {
        todayMenuItem.addEventListener('click', () => switchView('matrix'));
    }
    if (allTasksMenuItem) {
        allTasksMenuItem.addEventListener('click', () => switchView('all'));
    }
    if (stickyWallMenuItem) {
        stickyWallMenuItem.addEventListener('click', () => switchView('sticky'));
    }
    
    // Add Note Center Button Listener (Used when canvas is empty)
    if (addNoteCenterBtn) {
        addNoteCenterBtn.addEventListener('click', (e) => {
            setActiveTool('sticky-note');
        });
    }

    // --- Toolbar Event Listeners ---
    document.querySelectorAll('.sticky-toolbar .tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tool = e.currentTarget.getAttribute('data-tool');
            
            // Toggle sub-menu visibility for Sticky Note
            if (tool === 'sticky-note') {
                if (stickyNoteColorPicker.classList.contains('show')) {
                     stickyNoteColorPicker.classList.remove('show');
                     setActiveTool('select'); 
                } else {
                     setActiveTool('sticky-note'); 
                     stickyNoteColorPicker.classList.add('show');
                     stampRadialMenu.classList.remove('show'); 
                }
            } else if (tool === 'stamp') {
                // Toggle the stamp radial menu
                 if (stampRadialMenu.classList.contains('show')) {
                     stampRadialMenu.classList.remove('show');
                     setActiveTool('select');
                } else {
                     setActiveTool('select'); 
                     stampRadialMenu.classList.add('show');
                     stickyNoteColorPicker.classList.remove('show'); 
                }
            } else if (tool === 'drawing') {
                // Activate the drawing tool, which shows the secondary drawing toolbar
                setActiveTool('marker'); // Default to marker when selecting drawing
            } else {
                // For 'select' and 'hand'
                setActiveTool(tool);
            }
        });
    });

    // Secondary drawing toolbar listeners (for Marker, Highlighter, Eraser)
    document.querySelectorAll('#drawing-options-toolbar .tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setActiveTool(e.currentTarget.getAttribute('data-tool'));
        });
    });
    
    // Drawing Color Selection
    document.querySelectorAll('#drawing-options-toolbar .color-swatch-drawing').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            document.querySelectorAll('#drawing-options-toolbar .color-swatch-drawing').forEach(s => s.classList.remove('active'));
            const color = e.target.getAttribute('data-color');
            e.target.classList.add('active');
            currentDrawingColor = color; 
            
            // Keep the current drawing tool active
            if (activeTool === 'marker' || activeTool === 'highlighter' || activeTool === 'eraser') {
                setActiveTool(activeTool);
            } else {
                 // Should not happen, but default to marker if drawing tool is active
                 setActiveTool('marker');
            }
        });
    });

    // Sticky Note Color Picker Listeners
    document.addEventListener('click', (e) => {
         if (e.target.closest('#sticky-note-color-picker') && e.target.classList.contains('color-swatch')) {
            document.querySelectorAll('#sticky-note-color-picker .color-swatch').forEach(s => s.classList.remove('active'));
            const color = e.target.getAttribute('data-color');
            e.target.classList.add('active');
            currentStickyNoteColor = color;
            
            setActiveTool('sticky-note'); 
            stickyNoteColorPicker.classList.add('show');
         }
    });

    // Window Resize Listener (important for dynamic canvas size)
    window.addEventListener('resize', () => {
        if (document.getElementById('sticky-wall-container').style.display !== 'none') {
            resizeCanvas();
        }
    });


    // --- Initial Load ---
    if (allTasksData.length > 0) {
        allTasksData = allTasksData.map(task => ({
             ...task,
             completedDate: task.completedDate !== undefined ? task.completedDate : (task.completed ? task.date : null),
             stickyNoteColor: task.stickyNoteColor !== undefined ? task.stickyNoteColor : 'white',
             quadrant: task.quadrant !== undefined ? task.quadrant : (task.canvasX === undefined && task.canvasY === undefined ? 'do' : undefined),
             canvasX: task.canvasX !== undefined ? task.canvasX : undefined, 
             canvasY: task.canvasY !== undefined ? task.canvasY : undefined  
        }));

        const maxId = Math.max(...allTasksData.map(task => task.id));
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
    renderMatrixView();
    renderAllTasksView();
    switchView('matrix'); // Start with the matrix view by default
    setActiveTool('select'); // Default active tool on sticky wall
});