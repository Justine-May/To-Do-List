// --- Custom Confirmation Dialog Implementation (From Matrix Script) ---
const confirmDialog = document.getElementById('custom-confirm-dialog');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

/**
 * Custom function to replace window.confirm().
 * @param {string} message The message to display.
 * @param {function(boolean): void} callback Function to call with true/false result.
 */
window.showConfirm = function(message, callback) {
    if (!confirmDialog) {
        callback(window.confirm(message));
        return;
    }
    confirmMessage.textContent = message;
    confirmDialog.classList.remove('hidden');

    const handleConfirm = (result) => {
        confirmDialog.classList.add('hidden');
        confirmCancelBtn.onclick = null;
        confirmDeleteBtn.onclick = null;
        callback(result);
    };

    confirmCancelBtn.onclick = () => handleConfirm(false);
    confirmDeleteBtn.onclick = () => handleConfirm(true);
};

// --- NEW: Event Coordinate Helpers ---

/**
 * Gets the clientX/Y coordinates from a mouse or touch event.
 * @param {Event} e The mouse or touch event.
 * @returns {{clientX: number, clientY: number}}
 */
function getPointerCoords(e) {
    let clientX, clientY;
    if (e.touches && e.touches.length) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length) {
        // Use changedTouches for touchend
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return { clientX, clientY };
}

/**
 * Gets the offsetX/Y coordinates from a mouse or touch event relative to a target.
 * @param {Event} e The mouse or touch event.
 * @param {HTMLElement} targetElement The element to calculate offset against.
 * @returns {{offsetX: number, offsetY: number}}
 */
function getOffsetCoords(e, targetElement) {
    const { clientX, clientY } = getPointerCoords(e);
    const rect = targetElement.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    return { offsetX, offsetY };
}


// --- GLOBAL STATE (Combined) ---
let tasks = [];
let taskIdCounter = 1;
let currentView = 'matrix'; // Default to matrix view

// Firestore references (if used)
let firestoreDB = null;
let firestoreAuth = null;
let firestoreUserId = null;
let firestoreAppId = null;

// Dedicated state for sticky notes (DECOUPLED)
let stickyNotes = [];
let stickyNoteIdCounter = 1;

// --- CONSTANTS ---
const STICKY_NOTE_BG_COLORS = {
    'white': '#FFFFFF',
    'yellow': '#fff9b0',
    'blue': '#a0d9ff',
    'green': '#baffc9',
    'pink': '#ffb3ba',
    'purple': '#e0b5ff'
};

// --- NEW CONSTANTS FOR FONT/SIZE DISPLAY ---
const FONT_DISPLAY_NAMES = {
    'inter': 'Inter',
    'roboto': 'Roboto',
    'marker': 'Marker',
};

const SIZE_DISPLAY_TEXT = {
    'small': 'Small',
    'medium': 'Medium',
    'large': 'Large',
};

function getFontSizeInPx(sizeKey) {
    switch (sizeKey) {
        case 'small': return '12px';
        case 'medium': return '16px';
        case 'large': return '20px';
        default: return '16px';
    }
}

// --- SELECTORS (Matrix & All Tasks) ---
const modal = document.getElementById('task-details-modal');
const closeButton = document.querySelector('.close-button');
const deleteTaskBtn = document.getElementById('delete-task-btn');
const taskForm = document.getElementById('task-form');
const quadrants = document.querySelectorAll('.quadrant');
const matrixContainer = document.getElementById('matrix-container');
const allTasksContainer = document.getElementById('all-tasks-container');
const allTasksList = document.getElementById('all-tasks-list');
const newTaskButton = document.getElementById('new-task-btn');

// Menu item selectors
const matrixMenuItem = document.getElementById('matrix-menu-item');
const allTasksMenuItem = document.getElementById('all-tasks-menu-item');
const stickyWallMenuItem = document.getElementById('sticky-wall-menu-item');

// --- SELECTORS (Sticky Wall) ---
const stickyWallContainer = document.getElementById('sticky-wall-container');
const corkboard = document.getElementById('corkboard');
const canvas = document.getElementById('annotation-canvas');
let ctx; // Context for the main canvas
let currentStickyNoteColor = 'yellow'; // Default color for new stickies

// Toolbar and Drawing Elements
const toolbar = document.getElementById('main-toolbar');
const noteFloatingToolbar = document.getElementById('note-floating-toolbar');
const noteColorMenu = document.getElementById('note-color-menu');
const noteFontMenu = document.getElementById('note-font-menu');
const noteSizeMenu = document.getElementById('note-size-menu');
const noteColorBtn = document.getElementById('note-color-btn');
const noteFontBtn = document.getElementById('note-font-btn');
const noteSizeBtn = document.getElementById('note-size-btn');
const currentFontDisplay = document.getElementById('current-font-display');
const currentSizeDisplay = document.getElementById('current-size-display');
const noteDrawToggleBtn = document.querySelector('.note-draw-toggle');

// Previously static washiPatternButtons/washiToolbar - we'll generate a floating washi toolbar dynamically
let floatingWashiToolbar = null;

// Drawing state (Main Canvas)
let drawing = false;
let currentTool = 'select';
let currentStrokeColor = 'black';
let currentStrokeWidth = 5;
let currentOpacity = 1;
let strokes = []; // Array to store all drawn strokes
let isMoving = false;
let lastX, lastY;
let activeDraggable = null;

// --- MODIFIED: NEW STATE FOR STROKE DRAGGING ---
let activeDraggableStroke = null; // The stroke object being dragged
let currentStroke = null; // The stroke currently being drawn

// Washi-specific state
let isWashiDrawing = false;
let washiStartX = 0, washiStartY = 0;
let currentWashiPattern = 'diagonal';
let currentWashiColor = '#ff6b6b'; // Default initial coral (neutral before pop)
let washiToolbarShownForStroke = null; // reference to the toolbar tied to current stroke

// Drawing state (Note Canvas)
let isDrawingOnNote = false;
let currentNoteCtx = null;
let activeNote = null; // Currently selected sticky note DOM element
const USERNAME = '@User';

// --- STROKE MANAGEMENT FUNCTIONS (New Section for Persistence) ---
function saveStrokes() {
    localStorage.setItem('strokes', JSON.stringify(strokes));
}

// --- MODIFIED: Ensure old strokes get bounds for dragging ---
function loadStrokes() {
    const savedStrokes = localStorage.getItem('strokes');
    if (savedStrokes) {
        // Load strokes and ensure the 'bounds' property is present for older strokes
        strokes = JSON.parse(savedStrokes).map(stroke => {
            if (!stroke.bounds && stroke.points && stroke.points.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                stroke.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
                stroke.bounds = { minX, minY, maxX, maxY };
            } else if (stroke.tool === 'washi-tape' && !stroke.bounds) {
                 stroke.bounds = {
                    minX: Math.min(stroke.start.x, stroke.end.x),
                    minY: Math.min(stroke.start.y, stroke.end.y),
                    maxX: Math.max(stroke.start.x, stroke.end.x),
                    maxY: Math.max(stroke.start.y, stroke.end.y)
                };
            }
            return stroke;
        });
    }
}


// --- TASK MANAGEMENT FUNCTIONS (Core) ---
function saveTask(taskData) {
    let task;
    if (taskData.id) {
        task = tasks.find(t => t.id === taskData.id);
        if (task) {
            task.title = taskData.title;
            task.description = taskData.description;
            task.dueDate = taskData.dueDate;
            task.quadrant = taskData.quadrant || 'do';
            task.completed = taskData.completed !== undefined ? taskData.completed : task.completed;
            task.subtasks = taskData.subtasks || task.subtasks;
        }
    } else {
        task = {
            id: taskIdCounter++,
            title: taskData.title,
            description: taskData.description,
            dueDate: taskData.dueDate,
            quadrant: taskData.quadrant || 'do',
            completed: false,
            subtasks: taskData.subtasks || [],
        };
        tasks.push(task);
    }
    localStorage.setItem('tasks', JSON.stringify(tasks));
    localStorage.setItem('taskIdCounter', taskIdCounter);
    renderAllViews();
    return task;
}

function deleteTask(id) {
    const initialLength = tasks.length;
    tasks = tasks.filter(t => t.id !== id);

    if (tasks.length < initialLength) {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        localStorage.setItem('taskIdCounter', taskIdCounter);
        renderAllViews();
        return true;
    }
    return false;
}

function toggleTaskCompletion(id, isCompleted) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = isCompleted;
        task.completedDate = isCompleted ? new Date().toISOString().split('T')[0] : null;
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderAllViews();
    }
}

// --- STICKY NOTE MANAGEMENT FUNCTIONS (Decoupled Core) ---
function saveStickyNote(noteData) {
    let note;
    if (noteData.id) {
        note = stickyNotes.find(n => n.id === noteData.id);
        if (note) {
            Object.assign(note, noteData);
        }
    } else {
        note = {
            id: stickyNoteIdCounter++,
            title: noteData.title || 'New Sticky Note',
            noteColor: noteData.noteColor || 'yellow',
            noteFont: noteData.noteFont || 'inter',
            noteSize: noteData.noteSize || 'medium',
            noteContent: noteData.noteContent || 'Click to add text...',
            canvasX: noteData.canvasX || 0,
            canvasY: noteData.canvasY || 0,
            noteWidth: noteData.noteWidth || 250,
            noteHeight: noteData.noteHeight || 250,
            noteCanvasData: noteData.noteCanvasData || null
        };
        stickyNotes.push(note);
    }

    localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
    localStorage.setItem('stickyNoteIdCounter', stickyNoteIdCounter);
    renderStickyWallNotes();
    return note;
}

function deleteStickyNote(id) {
    const initialLength = stickyNotes.length;
    stickyNotes = stickyNotes.filter(n => n.id !== id);

    const stickyNoteElement = document.querySelector(`.sticky-note[data-note-id="${id}"]`);
    if (stickyNoteElement) {
        stickyNoteElement.remove();
        activeNote = null;
        if (noteFloatingToolbar) noteFloatingToolbar.classList.add('hidden');
    }

    if (stickyNotes.length < initialLength) {
        localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
        return true;
    }
    return false;
}

// --- RENDERING & VIEW SWITCHING (Matrix/All Tasks logic omitted for brevity, but kept intact) ---
function createTaskCard(task) {
    const li = document.createElement('li');
    li.className = 'task-item-card';
    li.setAttribute('data-task-id', task.id);
    if (task.completed) {
        li.classList.add('completed');
    }

    li.setAttribute('draggable', 'true');
    li.addEventListener('dragstart', handleDragStart);

    li.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <span class="task-title-text">${task.title}</span>
    `;

    const checkbox = li.querySelector('.task-checkbox');
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleTaskCompletion(task.id, e.target.checked);
    });

    li.addEventListener('click', () => {
        openModal(task.id);
    });

    return li;
}

function renderMatrixView() {
    quadrants.forEach(quadrantEl => {
        const quadrantId = quadrantEl.getAttribute('data-quadrant');
        const listEl = quadrantEl.querySelector('.task-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const quadrantTasks = tasks
            .filter(t => t.quadrant === quadrantId)
            .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));

        quadrantTasks.forEach(task => {
            listEl.appendChild(createTaskCard(task));
        });
    });

    setupMatrixDragAndDrop();
}

function renderAllTasksView() {
    if (!allTasksList) return;
    allTasksList.innerHTML = '';
    const sortedTasks = tasks.slice().sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));

    sortedTasks.forEach(task => {
        allTasksList.appendChild(createTaskCard(task));
    });
}

function renderAllViews() {
    renderMatrixView();
    renderAllTasksView();
    renderStickyWallNotes();
}

function openModal(taskId = null, quadrant = 'do') {
    if (!modal) return;
    taskForm.reset();

    document.getElementById('current-task-id').value = taskId || '';

    const task = taskId ? tasks.find(t => t.id === taskId) : null;

    const initialQuadrant = task ? task.quadrant : quadrant;
    document.getElementById('task-priority').value = initialQuadrant;

    if (task) {
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description;
        document.getElementById('task-due-date').value = task.dueDate || '';
    }

    if (deleteTaskBtn) deleteTaskBtn.classList.toggle('hidden', !taskId);
    modal.style.display = 'flex';
}

function closeModal() {
    if (modal) modal.style.display = 'none';
}

function switchView(viewName) {
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('active'));

    if (toolbar) toolbar.classList.add('hidden');
    noteFloatingToolbar?.classList.add('hidden');
    if (activeNote) {
        activeNote.classList.remove('active-note');
        activeNote = null;
    }

    let activeMenu = null;
    if (viewName === 'matrix') {
        if (matrixContainer) matrixContainer.classList.add('active');
        activeMenu = matrixMenuItem;
    } else if (viewName === 'all-tasks') {
        if (allTasksContainer) allTasksContainer.classList.add('active');
        activeMenu = allTasksMenuItem;
    } else if (viewName === 'sticky-wall') {
        if (stickyWallContainer) stickyWallContainer.classList.add('active');
        if (toolbar) toolbar.classList.remove('hidden');
        initializeStickyWall();
        activeMenu = stickyWallMenuItem;
    }

    if (activeMenu) {
        activeMenu.classList.add('active');
    }

    currentView = viewName;
    renderAllViews();
}

// --- STICKY WALL CORE LOGIC ---

function createStickyNote(note) {
    const element = document.createElement('div');
    element.className = 'draggable sticky-note';
    element.setAttribute('data-note-id', note.id);
    element.setAttribute('data-font', note.noteFont || 'inter');
    element.setAttribute('data-size', note.noteSize || 'medium');
    element.style.backgroundColor = STICKY_NOTE_BG_COLORS[note.noteColor] || STICKY_NOTE_BG_COLORS.white;
    element.style.left = (note.canvasX || 0) + 'px';
    element.style.top = (note.canvasY || 0) + 'px';
    element.style.width = (note.noteWidth || 250) + 'px';
    element.style.height = (note.noteHeight || 250) + 'px';

    element.innerHTML = `
        <canvas class="note-canvas" width="${note.noteWidth || 250}" height="${note.noteHeight || 250}"></canvas>
        <div class="sticky-note-content" contenteditable="true">${note.noteContent}</div>
        <div class="resize-handle handle-tl"></div>
        <div class="resize-handle handle-tr"></div>
        <div class="resize-handle handle-bl"></div>
        <div class="resize-handle handle-br"></div>
    `;

    const content = element.querySelector('.sticky-note-content');

    if (note.noteCanvasData) {
        const noteCanvas = element.querySelector('.note-canvas');
        const noteCtx = noteCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            noteCtx.drawImage(img, 0, 0, noteCanvas.width, noteCanvas.height);
        };
        img.src = note.noteCanvasData;
    }

    if (corkboard) corkboard.appendChild(element);

    content.addEventListener('input', () => {
        const updatedNote = stickyNotes.find(n => n.id == note.id);
        if (updatedNote) {
            updatedNote.noteContent = content.innerHTML;
        }
    });
    content.addEventListener('blur', () => {
        const noteToSave = stickyNotes.find(n => n.id === note.id);
        if (noteToSave) {
            saveStickyNote(noteToSave);
        }
    });

    return element;
}

function renderStickyWallNotes() {
    if (!corkboard) return;

    const currentNoteEls = Array.from(document.querySelectorAll('.sticky-note'));

    currentNoteEls.forEach(noteEl => {
        const noteId = parseInt(noteEl.getAttribute('data-note-id'));
        if (!stickyNotes.some(n => n.id === noteId)) {
            noteEl.remove();
        }
    });

    stickyNotes.forEach(note => {
        let noteEl = document.querySelector(`.sticky-note[data-note-id="${note.id}"]`);
        if (!noteEl) {
            noteEl = createStickyNote(note);
        } else {
            noteEl.style.left = (note.canvasX || 0) + 'px';
            noteEl.style.top = (note.canvasY || 0) + 'px';
            noteEl.style.backgroundColor = STICKY_NOTE_BG_COLORS[note.noteColor] || STICKY_NOTE_BG_COLORS.white;
            noteEl.style.width = (note.noteWidth || 250) + 'px';
            noteEl.style.height = (note.noteHeight || 250) + 'px';
            noteEl.setAttribute('data-font', note.noteFont || 'inter');
            noteEl.setAttribute('data-size', note.noteSize || 'medium');

            const contentEl = noteEl.querySelector('.sticky-note-content');
            if (contentEl && document.activeElement !== contentEl && contentEl.innerHTML !== (note.noteContent || '')) {
                contentEl.innerHTML = note.noteContent || '';
            }
        }
    });
}

// --- Floating toolbar helpers (unchanged) ---
function updateTextStyleButtonStates() {
    if (!activeNote || isDrawingOnNote) return;

    const contentEl = activeNote.querySelector('.sticky-note-content');
    if (!contentEl || !contentEl.contains(document.getSelection()?.anchorNode)) {
        document.querySelectorAll('#note-floating-toolbar .note-tool-btn[data-text-style]').forEach(btn => {
            btn.classList.remove('active');
        });
        return;
    }

    document.querySelectorAll('#note-floating-toolbar .note-tool-btn[data-text-style]').forEach(btn => {
        const style = btn.dataset.textStyle;
        let command = style;
        if (command === 'strike') command = 'strikeThrough';
        if (command === 'unordered-list') command = 'insertUnorderedList';
        if (command === 'ordered-list') command = 'insertOrderedList';

        let isActive = false;
        try {
            isActive = document.queryCommandState(command);
        } catch (e) {}
        btn.classList.toggle('active', isActive);
    });
}

function updateNoteToolbarState() {
    if (!activeNote || !noteFloatingToolbar) return;

    const currentFont = activeNote.getAttribute('data-font') || 'inter';
    const currentSize = activeNote.getAttribute('data-size') || 'medium';

    const currentColor = activeNote.style.backgroundColor;
    const colorName = Object.keys(STICKY_NOTE_BG_COLORS).find(key => STICKY_NOTE_BG_COLORS[key].toLowerCase() === currentColor.toLowerCase());

    document.getElementById('current-note-color').style.color = STICKY_NOTE_BG_COLORS[colorName] || '#ccc';

    noteColorMenu.querySelectorAll('.note-color-option').forEach(opt => {
        opt.classList.toggle('active-color', opt.getAttribute('data-color') === colorName);
    });

    if (currentFontDisplay) {
        currentFontDisplay.textContent = FONT_DISPLAY_NAMES[currentFont];
        if (currentFont === 'marker') {
            currentFontDisplay.style.fontFamily = "'Permanent Marker', cursive";
        } else if (currentFont === 'roboto') {
            currentFontDisplay.style.fontFamily = "'Roboto', sans-serif";
        } else {
            currentFontDisplay.style.fontFamily = "'Inter', sans-serif";
        }
    }

    if (currentSizeDisplay) {
        currentSizeDisplay.textContent = SIZE_DISPLAY_TEXT[currentSize];
        currentSizeDisplay.style.fontSize = getFontSizeInPx(currentSize);
    }

    document.querySelectorAll('.note-font-option, .note-size-option').forEach(el => el.classList.remove('active'));
    document.querySelector(`.note-font-option[data-font="${currentFont}"]`)?.classList.add('active');
    document.querySelector(`.note-size-option[data-size="${currentSize}"]`)?.classList.add('active');

    noteDrawToggleBtn?.classList.toggle('active', isDrawingOnNote);
    updateTextStyleButtonStates();
}

function toggleDropdown(menu) {
    if (!menu) return;
    const isVisible = menu.classList.contains('visible');
    document.querySelectorAll('.note-dropdown-menu').forEach(m => m.classList.remove('visible'));
    if (!isVisible) {
        menu.classList.add('visible');
    }
}

function updateNoteToolbarPosition(note) {
    if (!note.parentNode || !noteFloatingToolbar) return;

    // Don't update position on mobile, as it's fixed to the bottom
    if (window.innerWidth <= 768) {
        return;
    }

    const noteX = parseInt(note.style.left) || 0;
    const noteY = parseInt(note.style.top) || 0;
    const noteWidth = note.offsetWidth;
    const toolbarRect = noteFloatingToolbar.getBoundingClientRect();

    let top = noteY - toolbarRect.height - 10;
    let left = noteX + (noteWidth / 2) - (toolbarRect.width / 2);

    top = Math.max(0, top);
    const corkboardWidth = corkboard.scrollWidth;
    left = Math.max(10, left);
    left = Math.min(left, corkboardWidth - toolbarRect.width - 10);

    noteFloatingToolbar.style.top = top + 'px';
    noteFloatingToolbar.style.left = left + 'px';
}

// --- Note drawing functions ---
function setNoteDrawMode(enable) {
    isDrawingOnNote = enable;
    if (corkboard) corkboard.setAttribute('data-tool', enable ? 'note-draw' : 'select');

    if (activeNote) {
        activeNote.setAttribute('data-drawing', enable);
        activeNote.style.cursor = enable ? 'crosshair' : 'grab';
        const contentEl = activeNote.querySelector('.sticky-note-content');
        if (contentEl) contentEl.contentEditable = !enable;

        if (enable) {
            const noteCanvas = activeNote.querySelector('.note-canvas');
            if (noteCanvas) currentNoteCtx = noteCanvas.getContext('2d');
        } else {
            currentNoteCtx = null;
            const noteCanvas = activeNote.querySelector('.note-canvas');
            const noteId = parseInt(activeNote.getAttribute('data-note-id'));
            const note = stickyNotes.find(n => n.id === noteId);
            if (note && noteCanvas) {
                note.noteCanvasData = noteCanvas.toDataURL();
                saveStickyNote(note);
            }
        }
    }
    updateNoteToolbarState();
}

let noteDrawing = false;
// MODIFIED: Accepts offsetX/Y directly
function startNoteDraw(offsetX, offsetY) {
    if (!isDrawingOnNote || !currentNoteCtx) return;
    noteDrawing = true;
    currentNoteCtx.beginPath();
    currentNoteCtx.moveTo(offsetX, offsetY);
    // e.stopPropagation() is removed, will be handled in main handler
}

// MODIFIED: Accepts offsetX/Y directly
function drawOnNote(offsetX, offsetY) {
    if (!noteDrawing || !currentNoteCtx) return;

    currentNoteCtx.strokeStyle = currentStrokeColor;
    currentNoteCtx.lineWidth = currentStrokeWidth * 0.5;
    currentNoteCtx.lineCap = 'round';

    if (currentTool === 'eraser') {
        currentNoteCtx.globalCompositeOperation = 'destination-out';
        currentNoteCtx.globalAlpha = 1.0;
    } else if (currentTool === 'highlight') {
        currentNoteCtx.globalCompositeOperation = 'multiply';
        currentNoteCtx.globalAlpha = currentOpacity;
    } else {
        currentNoteCtx.globalCompositeOperation = 'source-over';
        currentNoteCtx.globalAlpha = currentOpacity;
    }

    currentNoteCtx.lineTo(offsetX, offsetY);
    currentNoteCtx.stroke();
    // e.stopPropagation() is removed
}

function endNoteDraw() {
    if (noteDrawing) {
        noteDrawing = false;
        currentNoteCtx.closePath();
        currentNoteCtx.globalCompositeOperation = 'source-over';
    }
}

// --- NEW: STROKE HIT TESTING ---
/**
 * Performs a simple bounding box hit test to find a draggable stroke under the cursor.
 * @param {number} x Canvas X coordinate.
 * @param {number} y Canvas Y coordinate.
 * @returns {object|null} The found stroke object or null.
 */
function getStrokeUnderCursor(x, y) {
    // Iterate from the latest stroke (top-most) backward
    for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i];
        
        // Only look at tools we want to be draggable/selectable
        if (!['marker', 'highlight', 'washi-tape'].includes(stroke.tool)) continue; 
        
        // Skip strokes without bounds (shouldn't happen with updated drawing, but as a safeguard)
        if (!stroke.bounds) continue; 

        // CRITICAL CHANGE: Use a generous buffer for easy clicking, minimum 15 pixels.
        // This makes the bounding box feel like a click target.
        const buffer = Math.max(15, stroke.width); 

        // Check if cursor (x, y) is within the stroke's bounds + buffer
        if (x >= stroke.bounds.minX - buffer && x <= stroke.bounds.maxX + buffer &&
            y >= stroke.bounds.minY - buffer && y <= stroke.bounds.maxY + buffer) {
            
            return stroke;
        }
    }
    return null;
}


// --- MODIFIED: Mouse/Drag Handlers (Combined) ---
let isResizing = false;
let activeHandle = null;
let initialNoteWidth, initialNoteHeight, initialMouseX, initialMouseY, initialNoteX, initialNoteY;

// MODIFIED: Handles both mouse and touch
function startDragOrResize(e) {
    // MODIFIED: Check for button only on mouse events
    if (!e.touches && e.button !== 0) return;
    if (!corkboard) return;

    if (!e.target.closest('#note-floating-toolbar')) {
        document.querySelectorAll('.note-dropdown-menu').forEach(m => m.classList.remove('visible'));
    }

    const clickedNote = e.target.closest('.sticky-note');
    const pointerCoords = getPointerCoords(e); // Get unified coords

    // Resizing check
    if (e.target.classList.contains('resize-handle')) {
        isResizing = true;
        activeHandle = e.target;
        activeNote = clickedNote;

        initialNoteWidth = activeNote.offsetWidth;
        initialNoteHeight = activeNote.offsetHeight;
        initialNoteX = parseInt(activeNote.style.left) || 0;
        initialNoteY = parseInt(activeNote.style.top) || 0;
        // MODIFIED: Use pointerCoords
        initialMouseX = pointerCoords.clientX;
        initialMouseY = pointerCoords.clientY;

        document.querySelectorAll('.sticky-note').forEach(n => n.style.zIndex = '50');
        activeNote.style.zIndex = '100';
        noteFloatingToolbar?.classList.add('hidden');

        e.preventDefault();
        return;
    }

    // Note Drawing start check
    if (isDrawingOnNote && clickedNote === activeNote && e.target.classList.contains('note-canvas')) {
        // MODIFIED: Calculate offset and pass to handler
        const noteCanvas = activeNote.querySelector('.note-canvas');
        const { offsetX, offsetY } = getOffsetCoords(e, noteCanvas);
        startNoteDraw(offsetX, offsetY);
        e.stopPropagation(); // Stop prop here
        return;
    }
    
    // --- STROKE DRAGGING CHECK ---
    if (currentView === 'sticky-wall' && currentTool === 'select' && e.target === canvas) {
        // MODIFIED: Use getOffsetCoords
        const { offsetX, offsetY } = getOffsetCoords(e, canvas);

        activeDraggableStroke = getStrokeUnderCursor(offsetX, offsetY); // Use offset coords

        if (activeDraggableStroke) {
            isMoving = true;
            // MODIFIED: Use pointerCoords
            lastX = pointerCoords.clientX;
            lastY = pointerCoords.clientY;
            e.preventDefault();
            
            // Bring the stroke to the front by moving it to the end of the array
            const index = strokes.indexOf(activeDraggableStroke);
            if (index > -1) {
                strokes.splice(index, 1);
                strokes.push(activeDraggableStroke);
            }
            redrawAllStrokes();
            return;
        }
    }

    // Dragging check (Sticky Note)
    if (clickedNote && currentTool === 'select' && !isDrawingOnNote) {
        const contentArea = clickedNote.querySelector('.sticky-note-content');
        if (contentArea.contains(e.target)) {
            if (document.activeElement === contentArea) {
                return;
            }
        }

        activeDraggable = clickedNote;
        isMoving = true;
        // MODIFIED: Use pointerCoords
        lastX = pointerCoords.clientX;
        lastY = pointerCoords.clientY;

        document.querySelectorAll('.sticky-note').forEach(n => n.classList.remove('active-note'));
        activeDraggable.classList.add('active-note');
        activeDraggable.classList.add('is-moving');
        activeNote = activeDraggable;

        updateNoteToolbarState();
        updateNoteToolbarPosition(activeNote);
        noteFloatingToolbar?.classList.remove('hidden');

        document.querySelectorAll('.sticky-note').forEach(n => n.style.zIndex = '50');
        activeNote.style.zIndex = '100';

        e.preventDefault();
        return;
    }

    // Main Canvas Drawing: special-case for Washi Tape (straight line)
    if (currentTool === 'washi-tape' && !isDrawingOnNote && e.target === canvas) {
        isWashiDrawing = true;
        // MODIFIED: Use getOffsetCoords
        const { offsetX, offsetY } = getOffsetCoords(e, canvas);
        washiStartX = offsetX;
        washiStartY = offsetY;

        // show or create the floating washi toolbar at starting point
        showFloatingWashiToolbarAt(washiStartX, washiStartY);

        e.preventDefault();
        return;
    }

    // Main Canvas Drawing: other continuous tools (marker/highlighter/eraser)
    if (currentTool !== 'select' && currentTool !== 'washi-tape' && !isDrawingOnNote && e.target === canvas) {
        drawing = true;
        // MODIFIED: Use getOffsetCoords
        const { offsetX, offsetY } = getOffsetCoords(e, canvas);
        
        // --- MODIFIED: Initialize currentStroke with bounds
        currentStroke = {
            tool: currentTool,
            color: currentStrokeColor,
            width: currentStrokeWidth,
            opacity: currentTool === 'highlight' ? 0.3 : currentOpacity,
            points: [{ x: offsetX, y: offsetY }],
            bounds: { minX: offsetX, minY: offsetY, maxX: offsetX, maxY: offsetY } // Add bounds
        };
        strokes.push(currentStroke);

        ctx.strokeStyle = currentStroke.color;
        ctx.lineWidth = currentStroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (currentTool === 'highlight') {
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = currentStroke.opacity;
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = currentStroke.opacity;
        }

        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        e.preventDefault();
        return;
    }

    // Clicked outside
    if (activeNote && !e.target.closest('.sticky-note') && !e.target.closest('#note-floating-toolbar')) {
        activeNote.classList.remove('active-note');
        noteFloatingToolbar?.classList.add('hidden');
        activeNote = null;
        setNoteDrawMode(false);
    }
}

// MODIFIED: Handles both mouse and touch
function dragOrResize(e) {
    // MODIFIED: Add preventDefault for touch scrolling
    if (isResizing || isMoving || drawing || noteDrawing || isWashiDrawing) {
        e.preventDefault();
    }
    
    if (!corkboard) return;
    
    const pointerCoords = getPointerCoords(e); // Get unified coords

    // Resizing Logic
    if (isResizing && activeNote) {
        // e.preventDefault(); // Already done
        // MODIFIED: Use pointerCoords
        const dx = pointerCoords.clientX - initialMouseX;
        const dy = pointerCoords.clientY - initialMouseY;
        let newWidth = initialNoteWidth;
        let newHeight = initialNoteHeight;
        let newLeft = initialNoteX;
        let newTop = initialNoteY;

        const minSize = 150;

        if (activeHandle.classList.contains('handle-br')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx);
            newHeight = Math.max(minSize, initialNoteHeight + dy);
        } else if (activeHandle.classList.contains('handle-tl')) {
            newWidth = Math.max(minSize, initialNoteWidth - dx);
            newLeft = initialNoteX + (initialNoteWidth - newWidth);
            newHeight = Math.max(minSize, initialNoteHeight - dy);
            newTop = initialNoteY + (initialNoteHeight - newHeight);
        } else if (activeHandle.classList.contains('handle-tr')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx);
            newHeight = Math.max(minSize, initialNoteHeight - dy);
            newTop = initialNoteY + (initialNoteHeight - newHeight);
        } else if (activeHandle.classList.contains('handle-bl')) {
            newWidth = Math.max(minSize, initialNoteWidth - dx);
            newLeft = initialNoteX + (initialNoteWidth - newWidth);
            newHeight = Math.max(minSize, initialNoteHeight + dy);
        }

        activeNote.style.width = newWidth + 'px';
        activeNote.style.height = newHeight + 'px';
        activeNote.style.left = newLeft + 'px';
        activeNote.style.top = newTop + 'px';

        const noteCanvas = activeNote.querySelector('.note-canvas');
        if (noteCanvas) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = noteCanvas.width;
            tempCanvas.height = noteCanvas.height;
            tempCtx.drawImage(noteCanvas, 0, 0);

            noteCanvas.width = newWidth;
            noteCanvas.height = newHeight;
            noteCanvas.getContext('2d').drawImage(tempCanvas, 0, 0, newWidth, newHeight);
        }

        return;
    }

    // --- STROKE DRAGGING LOGIC ---
    if (isMoving && activeDraggableStroke) {
        // e.preventDefault(); // Already done
        // MODIFIED: Use pointerCoords
        const dx = pointerCoords.clientX - lastX;
        const dy = pointerCoords.clientY - lastY;

        // Move all points (marker/highlight/washi)
        activeDraggableStroke.points.forEach(point => {
            point.x += dx;
            point.y += dy;
        });

        // Washi tape needs its start/end updated too
        if (activeDraggableStroke.tool === 'washi-tape') {
            activeDraggableStroke.start.x += dx;
            activeDraggableStroke.start.y += dy;
            activeDraggableStroke.end.x += dx;
            activeDraggableStroke.end.y += dy;
        }

        // Update bounds
        activeDraggableStroke.bounds.minX += dx;
        activeDraggableStroke.bounds.minY += dy;
        activeDraggableStroke.bounds.maxX += dx;
        activeDraggableStroke.bounds.maxY += dy;

        redrawAllStrokes();

        // MODIFIED: Use pointerCoords
        lastX = pointerCoords.clientX;
        lastY = pointerCoords.clientY;
        return;
    }

    // Dragging Logic (Sticky Note)
    if (isMoving && activeDraggable) {
        // e.preventDefault(); // Already done
        // MODIFIED: Use pointerCoords
        const dx = pointerCoords.clientX - lastX;
        const dy = pointerCoords.clientY - lastY;

        let newLeft = activeDraggable.offsetLeft + dx;
        let newTop = activeDraggable.offsetTop + dy;

        newLeft = Math.max(0, newLeft);
        newTop = Math.max(0, newTop);
        newLeft = Math.min(newLeft, corkboard.scrollWidth - activeDraggable.offsetWidth);
        newTop = Math.min(newTop, corkboard.scrollHeight - activeDraggable.offsetHeight);

        activeDraggable.style.left = newLeft + 'px';
        activeDraggable.style.top = newTop + 'px';

        // MODIFIED: Use pointerCoords
        lastX = pointerCoords.clientX;
        lastY = pointerCoords.clientY;

        updateNoteToolbarPosition(activeDraggable);
        return;
    }

    // Main Canvas Drawing Logic (continuous)
    if (drawing && e.target === canvas) {
        // e.preventDefault(); // Already done
        const currentStroke = strokes[strokes.length - 1]; 
        
        ctx.strokeStyle = currentStroke.color;
        ctx.lineWidth = currentStroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (currentStroke.tool === 'highlight') {
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = currentStroke.opacity;
        } else if (currentStroke.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = currentStroke.opacity;
        }

        // MODIFIED: Use getOffsetCoords
        const { offsetX, offsetY } = getOffsetCoords(e, canvas);

        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();

        const newPoint = { x: offsetX, y: offsetY };
        currentStroke.points.push(newPoint);
        
        // --- MODIFIED: Update bounds for continuous drawing
        currentStroke.bounds.minX = Math.min(currentStroke.bounds.minX, newPoint.x);
        currentStroke.bounds.minY = Math.min(currentStroke.bounds.minY, newPoint.y);
        currentStroke.bounds.maxX = Math.max(currentStroke.bounds.maxX, newPoint.x);
        currentStroke.bounds.maxY = Math.max(currentStroke.bounds.maxY, newPoint.y);

        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);

        return;
    }

    // Note Drawing Logic
    if (noteDrawing && activeNote) {
        // e.preventDefault(); // Already done
        // MODIFIED: Use getOffsetCoords and pass to handler
        const noteCanvas = activeNote.querySelector('.note-canvas');
        const { offsetX, offsetY } = getOffsetCoords(e, noteCanvas);
        drawOnNote(offsetX, offsetY);
        e.stopPropagation(); // Stop prop here
    }
}

// MODIFIED: Handles both mouse and touch
function endDragOrResize(e) {
    if (!corkboard) return;
    
    // const pointerCoords = getPointerCoords(e); // Get unified coords for touchend

    // Resizing End
    if (isResizing && activeNote) {
        isResizing = false;
        activeHandle = null;
        updateNoteToolbarPosition(activeNote);
        noteFloatingToolbar?.classList.remove('hidden');

        const noteId = parseInt(activeNote.getAttribute('data-note-id'));
        const note = stickyNotes.find(n => n.id === noteId);
        if (note) {
            note.canvasX = parseInt(activeNote.style.left) || 0;
            note.canvasY = parseInt(activeNote.style.top) || 0;
            note.noteWidth = activeNote.offsetWidth;
            note.noteHeight = activeNote.offsetHeight;

            const noteCanvas = activeNote.querySelector('.note-canvas');
            if (noteCanvas) note.noteCanvasData = noteCanvas.toDataURL();

            saveStickyNote(note);
        }
    }

    // --- MODIFIED: Dragging End (Handles both notes and strokes) ---
    if (isMoving) {
        if (activeDraggable) {
            // Sticky Note Save
            isMoving = false;
            activeDraggable.classList.remove('is-moving');

            const noteId = parseInt(activeDraggable.getAttribute('data-note-id'));
            const note = stickyNotes.find(n => n.id === noteId);
            if (note) {
                note.canvasX = parseInt(activeDraggable.style.left) || 0;
                note.canvasY = parseInt(activeDraggable.style.top) || 0;
                saveStickyNote(note);
            }
            activeDraggable = null;

            if (activeNote) {
                updateNoteToolbarState();
                noteFloatingToolbar?.classList.remove('hidden');
            }
        }
        // --- NEW: STROKE DRAGGING END ---
        else if (activeDraggableStroke) {
            isMoving = false;
            saveStrokes(); // Persist the new coordinates
            activeDraggableStroke = null;
        }
    }

    // Main Canvas Drawing End (continuous tools)
    if (drawing) {
        drawing = false;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        redrawAllStrokes();
        saveStrokes(); // Save marker/highlight stroke
    }

    // Washi Tape end (straight-line)
    if (isWashiDrawing && e.target === canvas) {
        isWashiDrawing = false;
        // MODIFIED: Use getOffsetCoords
        const { offsetX, offsetY } = getOffsetCoords(e, canvas);
        const endX = offsetX;
        const endY = offsetY;

        // sudden "color pop": convert neutral currentWashiColor to vibrant immediately on placement
        const vibrant = makeColorVibrant(currentWashiColor);

        // --- MODIFIED: Create washi stroke object with vibrant color AND bounds/points
        const washiStroke = {
            tool: 'washi-tape',
            color: vibrant,
            width: currentStrokeWidth,
            opacity: 1.0,
            pattern: currentWashiPattern,
            start: { x: washiStartX, y: washiStartY },
            end: { x: endX, y: endY },
            // Add points/bounds for dragging
            points: [{ x: washiStartX, y: washiStartY }, { x: endX, y: endY }], 
            bounds: {
                minX: Math.min(washiStartX, endX),
                minY: Math.min(washiStartY, endY),
                maxX: Math.max(washiStartX, endX),
                maxY: Math.max(washiStartY, endY)
            }
        };

        strokes.push(washiStroke);
        redrawAllStrokes();
        saveStrokes(); // Save washi stroke

        // hide floating toolbar once placed
        hideFloatingWashiToolbar();
    }

    // Note Drawing End
    if (noteDrawing) {
        endNoteDraw();
    }
}

// --- Toolbar Handlers ---
function handleToolClick(e) {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;

    const tool = btn.getAttribute('data-tool');
    if (!tool) return;

    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));

    if (tool !== 'add-note') {
        btn.classList.add('active');
        currentTool = tool;
        if (corkboard) corkboard.setAttribute('data-tool', tool);
    } else {
        document.querySelector('.tool-btn[data-tool="select"]')?.classList.add('active');
        currentTool = 'select';
        if (corkboard) corkboard.setAttribute('data-tool', 'select');
    }

    if (tool === 'marker') {
        currentStrokeColor = document.getElementById('stroke-color-input')?.value || currentStrokeColor;
        currentOpacity = parseFloat(document.getElementById('opacity-slider')?.value || currentOpacity);
    } else if (tool === 'highlight') {
        currentOpacity = 0.3;
    } else if (tool === 'eraser') {
        currentOpacity = 1.0;
    }

    // Show/hide washi toolbar (we now create a floating toolbar)
    if (tool === 'washi-tape') {
        // ensure default values when user selects the tool
        currentWashiColor = '#ff6b6b'; // neutral coral default
        currentWashiPattern = 'diagonal';
        // show minimal floating toolbar near center top of corkboard (until user starts drawing)
        showFloatingWashiToolbarAt(corkboard.clientWidth / 2, 60);
    } else {
        // hide toolbar when leaving washi
        hideFloatingWashiToolbar();
    }

    if (tool !== 'select' && activeNote) {
        activeNote.classList.remove('active-note');
        noteFloatingToolbar?.classList.add('hidden');
        activeNote = null;
        setNoteDrawMode(false);
    }

    if (tool === 'add-note') {
        const centerX = corkboard.scrollLeft + (corkboard.clientWidth / 2);
        const centerY = corkboard.scrollTop + (corkboard.clientHeight / 2);

        const newNoteX = centerX - 125;
        const newNoteY = centerY - 125;

        const newNoteData = {
            title: 'New Sticky Note',
            noteColor: currentStickyNoteColor,
            noteFont: 'inter',
            noteSize: 'medium',
            noteContent: 'Click to add text...',
            canvasX: newNoteX,
            canvasY: newNoteY,
            noteWidth: 250,
            noteHeight: 250,
            noteCanvasData: null
        };

        saveStickyNote(newNoteData);
    }
}

function handleToolbarClicks(e) {
    const target = e.target.closest('.note-tool-btn, .note-color-option, .note-font-option, .note-size-option');
    if (!target || !activeNote) return;

    e.stopPropagation();
    e.preventDefault();

    const noteId = parseInt(activeNote.getAttribute('data-note-id'));
    const note = stickyNotes.find(n => n.id === noteId);
    const contentEl = activeNote.querySelector('.sticky-note-content');

    if (!note || !contentEl) return;

    if (target.classList.contains('note-delete-btn')) {
        window.showConfirm("Are you sure you want to delete this sticky note?", (result) => {
            if (result) {
                deleteStickyNote(noteId);
            }
        });
    } else if (target.classList.contains('note-draw-toggle')) {
        setNoteDrawMode(!isDrawingOnNote);
    } else if (target.dataset.textStyle) {
        contentEl.focus();

        let command = target.dataset.textStyle;
        if (command === 'strike') command = 'strikeThrough';

        if (command === 'unordered-list' || command === 'ordered-list') {
            if (document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')) {
                document.execCommand('outdent', false, null);
            } else {
                document.execCommand(command === 'unordered-list' ? 'insertUnorderedList' : 'insertOrderedList', false, null);
            }
        } else {
            document.execCommand(command, false, null);
        }

        updateTextStyleButtonStates();
        note.noteContent = contentEl.innerHTML;
        saveStickyNote(note);

    } else if (target.id === 'note-author-btn') {
        contentEl.focus();
        document.execCommand('insertText', false, USERNAME + ' ');
        note.noteContent = contentEl.innerHTML;
        saveStickyNote(note);
    } else {
        let noteUpdate = {};
        let needsUpdate = false;

        if (target.classList.contains('note-color-option')) {
            const colorName = target.getAttribute('data-color');
            activeNote.style.backgroundColor = STICKY_NOTE_BG_COLORS[colorName];
            noteUpdate.noteColor = colorName;
            needsUpdate = true;
            toggleDropdown(noteColorMenu);
        } else if (target.classList.contains('note-font-option')) {
            const fontName = target.getAttribute('data-font');
            activeNote.setAttribute('data-font', fontName);
            noteUpdate.noteFont = fontName;
            needsUpdate = true;
            toggleDropdown(noteFontMenu);
        } else if (target.classList.contains('note-size-option')) {
            const sizeName = target.getAttribute('data-size');
            activeNote.setAttribute('data-size', sizeName);
            noteUpdate.noteSize = sizeName;
            needsUpdate = true;
            toggleDropdown(noteSizeMenu);
        }

        if (needsUpdate) {
            Object.assign(note, noteUpdate);
            saveStickyNote(note);
            updateNoteToolbarState();
            updateNoteToolbarPosition(activeNote);
        }
    }
}

// --- Canvas utilities (including washi pattern and ripped torn edge effect) ---

/**
 * Safe helper to create a pattern from a small pattern-canvas using the main ctx when available.
 * Returns a CanvasPattern or a fallback color string.
 */
function createPatternSafe(patternCanvas) {
    try {
        const mainCtx = ctx || (canvas ? canvas.getContext('2d') : null);
        if (!mainCtx) return '#fdfdfd';
        return mainCtx.createPattern(patternCanvas, 'repeat');
    } catch (e) {
        return '#fdfdfd';
    }
}

/**
 * Create a small repeating pattern canvas for washi.
 * Accepts an optional color (hex) that will be used for strokes/dots in the preview/tape.
 */
function makePatternForWashi(patternName, color = '#b7b0ac') {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const pctx = patternCanvas.getContext('2d');

    // subtle paper base (off-white)
    pctx.fillStyle = '#fbfaf6';
    pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

    if (patternName === 'diagonal') {
        pctx.strokeStyle = color;
        pctx.lineWidth = 2;
        pctx.beginPath();
        pctx.moveTo(0, patternCanvas.height);
        pctx.lineTo(patternCanvas.width, 0);
        pctx.stroke();
    } else if (patternName === 'dots') {
        pctx.fillStyle = color;
        for (let y = 5; y < patternCanvas.height; y += 10) {
            for (let x = 5; x < patternCanvas.width; x += 10) {
                pctx.beginPath();
                pctx.arc(x, y, 1.6, 0, Math.PI * 2);
                pctx.fill();
            }
        }
    } else if (patternName === 'grid') {
        pctx.strokeStyle = color;
        pctx.lineWidth = 1;
        for (let i = 0; i < patternCanvas.width; i += 5) {
            pctx.beginPath();
            pctx.moveTo(i, 0);
            pctx.lineTo(i, patternCanvas.height);
            pctx.moveTo(0, i);
            pctx.lineTo(patternCanvas.width, i);
            pctx.stroke();
        }
    } else { // plain - leave base
    }

    return createPatternSafe(patternCanvas);
}

/**
 * Make a color "vibrant" by increasing lightness or saturation.
 * Simple HSL conversion to boost saturation and/or lightness quickly.
 */
function makeColorVibrant(hex) {
    // convert hex to HSL, boost saturation/lightness, return hex
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    let [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
    s = Math.min(1, s * 1.35 + 0.05);
    l = Math.min(1, l * 1.08 + 0.03);
    const rgb2 = hslToRgb(h, s, l);
    return rgbToHex(Math.round(rgb2.r), Math.round(rgb2.g), Math.round(rgb2.b));
}

/* Color helpers */
function hexToRgb(hex) {
    if (!hex) return null;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) r = g = b = l;
    else {
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
}

/**
 * Create ripped/torn mask on an offscreen context near the edges (destination-out).
 * Reused by drawWashiOnMain.
 */
function cutRippedEdge(offCtx, cornerX, cornerY, angle, maxLength) {
    offCtx.save();
    offCtx.translate(cornerX, cornerY);
    offCtx.rotate(angle);

    offCtx.globalCompositeOperation = 'destination-out';
    offCtx.fillStyle = 'rgba(0,0,0,1)';

    const slices = 6;
    const step = Math.max(2, Math.floor(maxLength / slices));
    for (let i = 0; i < maxLength; i += step) {
        const r = 2 + Math.random() * (step * 0.9);
        const ox = i + (Math.random() - 0.5) * step;
        const oy = (Math.random() - 0.5) * step * 0.6;
        offCtx.beginPath();
        offCtx.ellipse(ox, oy, r, r * (0.6 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2);
        offCtx.fill();
    }

    offCtx.globalCompositeOperation = 'destination-out';
    offCtx.beginPath();
    offCtx.moveTo(0, 0);
    offCtx.lineTo(maxLength, -maxLength * 0.15);
    offCtx.lineTo(maxLength, maxLength * 0.15);
    offCtx.closePath();
    offCtx.fill();

    offCtx.restore();
}

/**
 * Draws a washi tape segment with pattern + vibrant overlay + ripped ends.
 * Uses offscreen canvas to create proper transparency and texture.
 */
function drawWashiOnMain(stroke) {
    if (!ctx || !canvas) return;

    const sx = stroke.start.x, sy = stroke.start.y;
    const ex = stroke.end.x, ey = stroke.end.y;
    const dx = ex - sx, dy = ey - sy;
    const length = Math.sqrt(dx*dx + dy*dy);
    if (length < 2) return;

    const angle = Math.atan2(dy, dx);
    const padding = Math.ceil(stroke.width * 2);
    const offW = Math.ceil(length + padding * 2);
    const offH = Math.ceil(stroke.width + padding * 2);

    const off = document.createElement('canvas');
    off.width = offW;
    off.height = offH;
    const offCtx = off.getContext('2d');

    // Move origin to padding, mid-line
    offCtx.translate(padding, offH / 2);

    // create pattern using the stroke color for previews and final tape
    const pattern = makePatternForWashi(stroke.pattern || 'diagonal', stroke.color);

    // 1) fill a thick line with pattern
    offCtx.save();
    offCtx.beginPath();
    offCtx.lineCap = 'butt';
    offCtx.lineJoin = 'miter';
    offCtx.strokeStyle = pattern;
    offCtx.lineWidth = stroke.width;
    offCtx.moveTo(0, 0);
    offCtx.lineTo(length, 0);
    offCtx.stroke();
    offCtx.restore();

    // 2) vibrant base overlay (solid color at 100% opacity to make it visible)
    offCtx.save();
    offCtx.globalAlpha = 1.0; // 100% opacity per request
    offCtx.strokeStyle = stroke.color || '#ff6b6b';
    offCtx.lineWidth = stroke.width * 0.6; // smaller base to keep pattern visible
    offCtx.beginPath();
    offCtx.moveTo(0, 0);
    offCtx.lineTo(length, 0);
    offCtx.stroke();
    offCtx.restore();

    // 3) create ripped edges by cutting shapes at start & end using destination-out
    const tearLen = Math.min(28, Math.max(12, stroke.width * 1.6));
    cutRippedEdge(offCtx, 0, 0, Math.PI, tearLen);
    cutRippedEdge(offCtx, length, 0, 0, tearLen);

    // 4) subtle shadow under tape to lift it visually
    offCtx.save();
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.fillStyle = 'rgba(0,0,0,0.06)';
    offCtx.beginPath();
    offCtx.rect(0, stroke.width / 2 + 2, length, 2);
    offCtx.fill();
    offCtx.restore();

    // 5) draw offscreen onto main canvas with rotation & position
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.drawImage(off, -padding, -offH/2);
    ctx.restore();
}

// --- Main canvas redraw (handles washi strokes too) ---
function redrawAllStrokes() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw non-washi strokes first
    strokes.forEach(stroke => {
        if (stroke.tool === 'washi-tape') return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.tool === 'highlight') {
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = stroke.opacity;
        } else if (stroke.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = stroke.opacity;
        }

        if (!stroke.points || stroke.points.length < 2) {
            if (stroke.points && stroke.points.length === 1) {
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y + 0.1);
            }
        } else {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
        }
        ctx.stroke();
    });

    // Then draw washi strokes on top
    for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        if (stroke.tool === 'washi-tape') {
            drawWashiOnMain(stroke);
        }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
}

// --- Floating Washi Toolbar (Dynamically generated) ---
// Minimalist UI: small rounded container, soft shadow, small previews & color swatches
const WASHI_PATTERNS = ['diagonal', 'dots', 'grid', 'plain'];
const WASHI_COLOR_SWATCHES = [
    '#ff6b6b', // coral default
    '#ff9472',
    '#6bc7ff',
    '#ffd56b',
    '#7dff9b',
    '#d38bff',
    '#ffb3d1'
];

function createFloatingWashiToolbar() {
    if (floatingWashiToolbar) return floatingWashiToolbar;

    const wrapper = document.createElement('div');
    wrapper.id = 'floating-washi-toolbar';
    // base styles (minimalist)
    Object.assign(wrapper.style, {
        position: 'absolute',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
        padding: '8px',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        alignItems: 'center',
        transform: 'translate(-50%, -120%)', // place above the start point by default
        pointerEvents: 'auto',
        userSelect: 'none',
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px'
    });

    // Patterns group (small previews)
    const patternsGroup = document.createElement('div');
    patternsGroup.style.display = 'flex';
    patternsGroup.style.gap = '6px';
    patternsGroup.style.alignItems = 'center';

    WASHI_PATTERNS.forEach(patt => {
        const btn = document.createElement('button');
        btn.className = 'washi-pattern-btn';
        btn.setAttribute('data-pattern', patt);
        Object.assign(btn.style, {
            width: '36px',
            height: '28px',
            borderRadius: '6px',
            padding: '4px',
            border: 'none',
            cursor: 'pointer',
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });

        // create small preview canvas
        const preview = document.createElement('canvas');
        preview.width = 28;
        preview.height = 20;
        preview.style.width = '28px';
        preview.style.height = '20px';
        preview.style.borderRadius = '4px';
        preview.style.display = 'block';

        // draw preview using currentWashiColor
        const pctx = preview.getContext('2d');
        // fill base
        pctx.fillStyle = '#fbfaf6';
        pctx.fillRect(0,0,preview.width,preview.height);
        // pattern (use a small scale, pass current color)
        drawPatternPreviewOnCtx(pctx, patt, currentWashiColor, preview.width, preview.height);

        btn.appendChild(preview);
        patternsGroup.appendChild(btn);

        btn.addEventListener('click', (ev) => {
            currentWashiPattern = patt;
            // mark active visually
            patternsGroup.querySelectorAll('.washi-pattern-btn').forEach(b => b.style.outline = 'none');
            btn.style.outline = '2px solid rgba(106,64,225,0.12)';
            btn.style.borderRadius = '6px';
            // update live previews (if needed) - no extra action required
        });
    });

    // Colors group (small circular swatches)
    const colorsGroup = document.createElement('div');
    colorsGroup.style.display = 'flex';
    colorsGroup.style.gap = '6px';
    colorsGroup.style.alignItems = 'center';

    WASHI_COLOR_SWATCHES.forEach(col => {
        const sw = document.createElement('button');
        sw.className = 'washi-color-swatch';
        sw.setAttribute('data-color', col);
        Object.assign(sw.style, {
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: '2px solid rgba(0,0,0,0.06)',
            background: col,
            cursor: 'pointer',
            padding: '0'
        });

        sw.addEventListener('click', () => {
            currentWashiColor = col;
            // update all pattern previews to reflect new color
            patternsGroup.querySelectorAll('canvas').forEach(canvasEl => {
                const patt = canvasEl.parentElement.getAttribute('data-pattern');
                const pctx = canvasEl.getContext('2d');
                pctx.clearRect(0,0,canvasEl.width,canvasEl.height);
                pctx.fillStyle = '#fbfaf6';
                pctx.fillRect(0,0,canvasEl.width,canvasEl.height);
                drawPatternPreviewOnCtx(pctx, patt, currentWashiColor, canvasEl.width, canvasEl.height);
            });
            // highlight selected swatch
            colorsGroup.querySelectorAll('.washi-color-swatch').forEach(b => b.style.boxShadow = 'none');
            sw.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.04)';
        });
        colorsGroup.appendChild(sw);
    });

    // small close button
    const closeBtn = document.createElement('button');
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '&times;';
    Object.assign(closeBtn.style, {
        marginLeft: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '18px',
        color: '#666'
    });
    closeBtn.addEventListener('click', () => {
        hideFloatingWashiToolbar();
        // switch tool back to select visually
        document.querySelector('.tool-btn[data-tool="select"]')?.classList.add('active');
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => { if (b.getAttribute('data-tool') === 'washi-tape') b.classList.remove('active'); });
        currentTool = 'select';
        if (corkboard) corkboard.setAttribute('data-tool', 'select');
    });

    // assemble
    wrapper.appendChild(patternsGroup);
    // divider
    const divider = document.createElement('div');
    Object.assign(divider.style, { width: '1px', height: '28px', background: 'rgba(0,0,0,0.04)', borderRadius: '2px' });
    wrapper.appendChild(divider);
    wrapper.appendChild(colorsGroup);
    wrapper.appendChild(closeBtn);

    // insert into corkboard for proper absolute positioning relative to corkboard
    if (corkboard) corkboard.appendChild(wrapper);
    floatingWashiToolbar = wrapper;
    // initially hidden
    wrapper.style.display = 'none';
    return wrapper;
}

function drawPatternPreviewOnCtx(pctx, patternName, colorHex, w, h) {
    // tiny preview drawing logic (not using createPattern to keep preview crisp)
    pctx.fillStyle = '#fbfaf6';
    pctx.fillRect(0,0,w,h);
    pctx.save();
    pctx.strokeStyle = colorHex;
    pctx.fillStyle = colorHex;
    if (patternName === 'diagonal') {
        pctx.lineWidth = 2;
        pctx.beginPath();
        pctx.moveTo(0, h);
        pctx.lineTo(w, 0);
        pctx.stroke();
    } else if (patternName === 'dots') {
        const step = Math.max(6, Math.floor(w / 3));
        for (let y = step/2; y < h; y += step) {
            for (let x = step/2; x < w; x += step) {
                pctx.beginPath();
                pctx.arc(x, y, 1.6, 0, Math.PI*2);
                pctx.fill();
            }
        }
    } else if (patternName === 'grid') {
        pctx.lineWidth = 1;
        for (let i = 0; i < w; i += 5) {
            pctx.beginPath();
            pctx.moveTo(i, 0);
            pctx.lineTo(i, h);
            pctx.stroke();
        }
        for (let j = 0; j < h; j += 5) {
            pctx.beginPath();
            pctx.moveTo(0, j);
            pctx.lineTo(w, j);
            pctx.stroke();
        }
    } else {
        // plain: small colored rect
        pctx.fillStyle = colorHex;
        pctx.globalAlpha = 0.12;
        pctx.fillRect(0, 0, w, h);
    }
    pctx.restore();
}

/**
 * Position and display the floating washi toolbar at corkboard coordinates (x,y).
 * The toolbar is positioned relative to corkboard; it will stay at the tape starting point.
 */
function showFloatingWashiToolbarAt(x, y) {
    const toolbar = createFloatingWashiToolbar();
    // update previews to current color/pattern
    toolbar.querySelectorAll('.washi-pattern-btn canvas').forEach(canvasEl => {
        const patt = canvasEl.parentElement.getAttribute('data-pattern');
        const pctx = canvasEl.getContext('2d');
        pctx.clearRect(0,0,canvasEl.width,canvasEl.height);
        pctx.fillStyle = '#fbfaf6';
        pctx.fillRect(0,0,canvasEl.width,canvasEl.height);
        drawPatternPreviewOnCtx(pctx, patt, currentWashiColor, canvasEl.width, canvasEl.height);
    });
    // highlight the active pattern button
    toolbar.querySelectorAll('.washi-pattern-btn').forEach(b => {
        b.style.outline = (b.getAttribute('data-pattern') === currentWashiPattern) ? '2px solid rgba(106,64,225,0.12)' : 'none';
    });
    // highlight the selected color
    toolbar.querySelectorAll('.washi-color-swatch').forEach(sw => {
        sw.style.boxShadow = (sw.getAttribute('data-color') === currentWashiColor) ? '0 0 0 3px rgba(0,0,0,0.04)' : 'none';
    });

    // position (ensure within corkboard bounds)
    const corkRect = corkboard.getBoundingClientRect();
    const localLeft = x + corkRect.left - corkboard.scrollLeft;
    const localTop = y + corkRect.top - corkboard.scrollTop;

    // Position toolbar using absolute coordinates relative to corkboard
    const toolbarWidth = 250; // approx - wrapper width may vary; we center using translate
    toolbar.style.left = (x) + 'px';
    toolbar.style.top = (y) + 'px';
    toolbar.style.display = 'flex';
}

/**
 * Hide & remove the floating washi toolbar
 */
function hideFloatingWashiToolbar() {
    if (!floatingWashiToolbar) return;
    floatingWashiToolbar.style.display = 'none';
}

// --- Sticky Wall Initialization ---
function initializeStickyWall() {
    if (!canvas || !corkboard) return;

    function fitCanvasToBoard() {
        // size the canvas to corkboard scrollable area
        canvas.width = corkboard.scrollWidth;
        canvas.height = corkboard.scrollHeight;
        redrawAllStrokes();
    }
    fitCanvasToBoard();
    window.addEventListener('resize', fitCanvasToBoard);

    ctx = canvas.getContext('2d');
    redrawAllStrokes();
    renderStickyWallNotes();
}

// --- Drag and Drop (Matrix View) ---
let draggedTaskId = null;
let draggedElement = null;

function handleDragStart(e) {
    draggedTaskId = e.target.getAttribute('data-task-id');
    e.dataTransfer.setData('text/plain', draggedTaskId);
    e.target.classList.add('dragging');
}

function handleDragEnter(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const sourceTaskId = e.dataTransfer.getData('text/plain');
    const targetQuadrantEl = e.currentTarget;
    const newQuadrantId = targetQuadrantEl.getAttribute('data-quadrant');

    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (sourceTaskId && newQuadrantId) {
        const taskId = parseInt(sourceTaskId);
        const task = tasks.find(t => t.id === taskId);

        if (task && task.quadrant !== newQuadrantId) {
            task.quadrant = newQuadrantId;
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderMatrixView();
        }
    }
}

function setupMatrixDragAndDrop() {
    quadrants.forEach(quadrantEl => {
        quadrantEl.removeEventListener('dragover', (e) => e.preventDefault());
        quadrantEl.removeEventListener('dragenter', handleDragEnter);
        quadrantEl.removeEventListener('dragleave', handleDragLeave);
        quadrantEl.removeEventListener('drop', handleDrop);

        quadrantEl.addEventListener('dragover', (e) => e.preventDefault());
        quadrantEl.addEventListener('dragenter', handleDragEnter);
        quadrantEl.addEventListener('dragleave', handleDragLeave);
        quadrantEl.addEventListener('drop', handleDrop);
    });
}

// --- DOMContentLoaded: Wire up events and load state ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.quadrant-add-btn').forEach(button => {
        button.addEventListener('click', () => {
            const quadrant = button.getAttribute('data-quadrant');
            openModal(null, quadrant);
        });
    });

    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
        taskIdCounter = parseInt(localStorage.getItem('taskIdCounter')) || (tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1);
    }

    const storedNotes = localStorage.getItem('stickyNotes');
    if (storedNotes) {
        stickyNotes = JSON.parse(storedNotes);
        stickyNoteIdCounter = parseInt(localStorage.getItem('stickyNoteIdCounter')) || (stickyNotes.length > 0 ? Math.max(...stickyNotes.map(n => n.id)) + 1 : 1);
    }
    
    // --- MODIFIED: Load persisted strokes
    loadStrokes();

    if (canvas && corkboard) initializeStickyWall();

    quadrants.forEach(q => {
        q.querySelector('.quadrant-add-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const quadrant = e.currentTarget.getAttribute('data-quadrant');
            openModal(null, quadrant);
        });
    });

    closeButton?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    newTaskButton?.addEventListener('click', () => openModal(null, 'do'));

    taskForm?.addEventListener('submit', (e) => {
        e.preventDefault();

        const taskId = document.getElementById('current-task-id').value ? parseInt(document.getElementById('current-task-id').value) : null;
        const taskTitle = document.getElementById('task-title').value;
        const taskDescription = document.getElementById('task-description').value;
        const taskDueDate = document.getElementById('task-due-date').value;
        const taskQuadrant = document.getElementById('task-priority').value;

        const existingTask = tasks.find(t => t.id === taskId);

        const taskData = {
            id: taskId,
            title: taskTitle,
            description: taskDescription,
            dueDate: taskDueDate,
            quadrant: taskQuadrant,
            completed: existingTask?.completed,
            subtasks: existingTask?.subtasks || []
        };

        saveTask(taskData);
        closeModal();
    });

    deleteTaskBtn?.addEventListener('click', () => {
        const taskId = parseInt(document.getElementById('current-task-id').value);
        window.showConfirm("Are you sure you want to delete this task? This action cannot be undone.", (result) => {
            if (result) {
                deleteTask(taskId);
                closeModal();
            }
        });
    });

    // --- UPDATED: Sidebar Toggle and Navigation Logic ---
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const overlay = document.querySelector('.overlay');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            const isCollapsing = !sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed');
            
            // Show/hide overlay only on mobile
            if (window.innerWidth <= 768) {
                if (isCollapsing) {
                    overlay.classList.remove('active');
                } else {
                    overlay.classList.add('active');
                }
            }
        });
    }
    
    if (overlay && sidebar) {
        overlay.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
            overlay.classList.remove('active'); // Hide overlay when clicked
        });
    }

    // Also, close sidebar when a view is clicked on mobile
    document.querySelectorAll('.sidebar .task-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if (view) {
                switchView(view);
                // Auto-close sidebar on mobile after selection
                if (window.innerWidth <= 768) {
                    sidebar.classList.add('collapsed');
                    overlay.classList.remove('active'); // Hide overlay
                }
            }
        });
    });

    // Check initial state on load
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    }
    // --- END UPDATED SECTION ---

    // MODIFIED: Add touch events
    document.addEventListener('mousedown', startDragOrResize);
    document.addEventListener('touchstart', startDragOrResize, { passive: false });
    
    document.addEventListener('mousemove', dragOrResize);
    document.addEventListener('touchmove', dragOrResize, { passive: false });

    document.addEventListener('mouseup', endDragOrResize);
    document.addEventListener('touchend', endDragOrResize);
    document.addEventListener('touchcancel', endDragOrResize); // Added for robustness

    document.addEventListener('dragend', () => {
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    document.addEventListener('selectionchange', () => {
        if (activeNote && !isDrawingOnNote) updateTextStyleButtonStates();
    });

    toolbar?.addEventListener('click', handleToolClick);
    noteFloatingToolbar?.addEventListener('click', handleToolbarClicks);

    noteColorBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteColorMenu); });
    noteFontBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteFontMenu); });
    noteSizeBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteSizeMenu); });

    document.getElementById('stroke-width-slider')?.addEventListener('input', (e) => {
        currentStrokeWidth = parseFloat(e.target.value);
    });
    document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
        currentOpacity = parseFloat(e.target.value);
        if (currentTool !== 'marker') {
            handleToolClick({ target: document.querySelector('.tool-btn[data-tool="marker"]') });
        }
    });

    document.getElementById('current-color-indicator')?.addEventListener('click', () => {
        document.getElementById('stroke-color-input')?.click();
    });
    document.getElementById('stroke-color-input')?.addEventListener('input', (e) => {
        currentStrokeColor = e.target.value;
        document.getElementById('current-color-indicator').style.backgroundColor = currentStrokeColor;
        if (currentTool !== 'marker') {
            handleToolClick({ target: document.querySelector('.tool-btn[data-tool="marker"]') });
        }
    });

    document.getElementById('undo-btn')?.addEventListener('click', () => {
        strokes.pop();
        redrawAllStrokes();
        saveStrokes();
    });
    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
        strokes = [];
        redrawAllStrokes();
        saveStrokes();
    });

    // initial creation of the floating washi toolbar (hidden)
    createFloatingWashiToolbar();

    // MODIFIED SIGN OUT BUTTON LOGIC (now integrated with Firebase)
    document.getElementById('sign-out-btn')?.addEventListener('click', () => {
        window.showConfirm("Are you sure you want to sign out? This will clear all local data.", (result) => {
            if (result) {
                // This will trigger the auth state listener
                firebase.auth().signOut()
                    .then(() => {
                        console.log('User signed out.');
                        // Clear all local data upon sign-out
                        localStorage.removeItem('tasks');
                        localStorage.removeItem('taskIdCounter');
                        localStorage.removeItem('stickyNotes');
                        localStorage.removeItem('stickyNoteIdCounter');
                        localStorage.removeItem('strokes');
                        
                        // Reload the page to apply the empty state
                        location.reload();
                    })
                    .catch((error) => {
                        console.error('Sign out error', error);
                        alert(`Could not sign out: ${error.message}`);
                    });
            }
        });
    });

    renderAllViews();
    switchView('matrix');
});


// ####################################################################
// #################### NEW FIREBASE AUTH LOGIC #####################
// ####################################################################

// 🟢 STEP 1: PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 🟢 STEP 2: This code will initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  if (!/firebase.*already exists/.test(e.message)) {
    console.error('Firebase initialization error:', e.stack);
  }
}

// Get auth instance
const auth = firebase.auth();

document.addEventListener("DOMContentLoaded", () => {
  // --- Account Modal Element Selectors ---
  const accountBtn = document.getElementById("account-btn");
  const signOutBtn = document.getElementById("sign-out-btn");
  const accountModal = document.getElementById("account-modal");
  const closeAccountModal = document.getElementById("close-account-modal");

  // Form containers
  const loginFormContainer = document.getElementById("login-form-container");
  const signupFormContainer = document.getElementById("signup-form-container");

  // Form toggles
  const showSignupFormLink = document.getElementById("show-signup-form");
  const showLoginFormLink = document.getElementById("show-login-form-link");

  // Forms
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  // Error messages
  const loginError = document.getElementById("login-error");
  const signupError = document.getElementById("signup-error");

  // Google Button
  const googleLoginBtn = document.getElementById("google-login-btn");

  // --- Modal Visibility ---
  if (accountBtn) {
    accountBtn.addEventListener("click", () => {
      // Reset forms
      loginForm.reset();
      signupForm.reset();
      loginError.classList.add("hidden");
      signupError.classList.add("hidden");
      // Show login form by default
      loginFormContainer.classList.remove("hidden");
      signupFormContainer.classList.add("hidden");
      accountModal.classList.add("active");
    });
  }

  function closeAuthModal() {
    accountModal.classList.remove("active");
  }

  if (closeAccountModal) {
    closeAccountModal.addEventListener("click", closeAuthModal);
  }

  if (accountModal) {
    accountModal.addEventListener("click", (e) => {
      if (e.target === accountModal) {
        closeAuthModal();
      }
    });
  }

  // --- Form Toggling ---
  if (showSignupFormLink) {
    showSignupFormLink.addEventListener("click", (e) => {
      e.preventDefault();
      loginFormContainer.classList.add("hidden");
      signupFormContainer.classList.remove("hidden");
    });
  }

  if (showLoginFormLink) {
    showLoginFormLink.addEventListener("click", (e) => {
      e.preventDefault();
      loginFormContainer.classList.remove("hidden");
      signupFormContainer.classList.add("hidden");
    });
  }

  // --- Firebase Auth Handlers ---

  // 1. Sign Up
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;

      signupError.classList.add("hidden"); // Hide old errors

      auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // Signed in
          console.log("User created:", userCredential.user);
          alert("Account created successfully! You are now logged in.");
          closeAuthModal();
        })
        .catch((error) => {
          signupError.textContent = error.message;
          signupError.classList.remove("hidden");
        });
    });
  }

  // 2. Login
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      loginError.classList.add("hidden"); // Hide old errors

      auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // Signed in
          console.log("User logged in:", userCredential.user);
          closeAuthModal();
        })
        .catch((error) => {
          loginError.textContent = error.message;
          loginError.classList.remove("hidden");
        });
    });
  }

  // 3. Google Sign-In
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      
      auth.signInWithPopup(provider)
        .then((result) => {
          console.log("Google sign-in successful:", result.user);
          closeAuthModal();
        })
        .catch((error) => {
          loginError.textContent = `Google Error: ${error.message}`;
          loginError.classList.remove("hidden");
        });
    });
  }

  // 4. Auth State Listener (Manages UI)
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      console.log("Auth state changed: Logged in as", user.email);
      if (accountBtn) {
        // Change "Sign In" button to show user's email (or a generic message)
        accountBtn.innerHTML = `<i class="fas fa-user-check"></i> ${user.email}`;
        accountBtn.style.pointerEvents = "none"; // Disable clicking it
      }
      if (signOutBtn) {
        signOutBtn.style.display = "block"; // Show the "Sign Out" button
      }
    } else {
      // User is signed out
      console.log("Auth state changed: Logged out");
      if (accountBtn) {
        accountBtn.innerHTML = `<i class="fas fa-user-circle"></i> Sign In / Create Account`;
        accountBtn.style.pointerEvents = "auto"; // Re-enable clicking it
      }
      if (signOutBtn) {
        signOutBtn.style.display = "none"; // Hide the "Sign Out" button
      }
      
      // IMPORTANT: When a user logs out, we clear the local-only data.
      // The sign-out button itself already handles this, but this is a good
      // place to ensure the UI is clean.
      // We will reload all data from scratch (which is currently empty)
      tasks = [];
      stickyNotes = [];
      strokes = [];
      renderAllViews();
    }
  });

});