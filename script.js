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
    // Only proceed if the elements exist (handles case where this is used in an unmerged environment)
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


// --- GLOBAL STATE (Combined) ---
let tasks = [];
let taskIdCounter = 1;
let currentView = 'matrix'; // Default to matrix view

// [MODIFIED] Separate state for sticky notes, as requested
let stickyNotes = []; 
let stickyNoteIdCounter = 1; 

// Firestore references (if used)
let firestoreDB = null;
let firestoreAuth = null;
let firestoreUserId = null;
let firestoreAppId = null;

// --- CONSTANTS ---
const STICKY_NOTE_BG_COLORS = {
    'white': '#FFFFFF',
    'yellow': '#fff9b0',
    'blue': '#a0d9ff',
    'green': '#baffc9',
    'pink': '#ffb3ba',
    'purple': '#e0b5ff'
};

const QUADRANT_MAP = {
    'do': 'Do Now',
    'schedule': 'Schedule',
    'delegate': 'Delegate',
    'eliminate': 'Eliminate'
};

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
const stickyNoteSettings = document.getElementById('sticky-note-settings');
const stickyNoteColorPicker = document.getElementById('sticky-note-color-picker');
let currentStickyNoteColor = 'yellow'; // Default for new stickies

// Menu item selectors
const matrixMenuItem = document.getElementById('matrix-menu-item');
const allTasksMenuItem = document.getElementById('all-tasks-menu-item');
const stickyWallMenuItem = document.getElementById('sticky-wall-menu-item');

// --- SELECTORS (Sticky Wall) ---
const stickyWallContainer = document.getElementById('sticky-wall-container'); // Assuming a wrapper for the corkboard
const corkboard = document.getElementById('corkboard');
const canvas = document.getElementById('annotation-canvas');
let ctx; // Context for the main canvas, initialized when view switches

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
const noteToolbarButtons = noteFloatingToolbar ? noteFloatingToolbar.querySelectorAll('.note-tool-btn[data-text-style], #note-author-btn') : [];

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

// Drawing state (Note Canvas)
let isDrawingOnNote = false;
let currentNoteCtx = null;
let activeNote = null;
const USERNAME = '@User';

// --- TASK MANAGEMENT FUNCTIONS (Matrix/All Tasks Core) ---

// NOTE: Firestore functions are included as placeholders but rely on external firebase SDK
async function saveTasksToFirestore() {
    if (!firestoreDB || !firestoreUserId) return;
    // ... (Firestore serialization logic remains here) ...
}

async function loadTasksFromFirestore() {
    if (!firestoreDB || !firestoreUserId) return;
    // ... (Firestore deserialization logic remains here) ...
}


/** Adds or updates a task 
 * [MODIFIED] Only handles core task properties.
*/
function saveTask(taskData) {
    let task;
    if (taskData.id) {
        task = tasks.find(t => t.id === taskData.id);
        if (task) {
            // Only update core task properties, ignoring all sticky note properties
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
            // No sticky note properties here
        };
        tasks.push(task);
    }
    // saveTasksToFirestore(); // Uncomment if using Firestore
    localStorage.setItem('tasks', JSON.stringify(tasks)); // Using localStorage as fallback
    localStorage.setItem('taskIdCounter', taskIdCounter);
    renderAllViews();
    return task;
}

/** Adds or updates a sticky note 
 * [NEW] Dedicated function for sticky notes.
*/
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
            noteCanvasData: noteData.noteCanvasData 
        };
        stickyNotes.push(note);
    }
    
    localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes)); 
    localStorage.setItem('stickyNoteIdCounter', stickyNoteIdCounter);
    renderStickyWallNotes(); 
    return note;
}

/** Deletes a task by ID 
 * [MODIFIED] Removed sticky note DOM cleanup.
*/
function deleteTask(id) {
    const initialLength = tasks.length;
    tasks = tasks.filter(t => t.id !== id);
    
    // If the item was a sticky note, remove it from the DOM
    // NOTE: Sticky note deletion is now handled by deleteStickyNote(id) for decoupled behavior.
    
    if (tasks.length < initialLength) {
        // saveTasksToFirestore(); // Uncomment if using Firestore
        localStorage.setItem('tasks', JSON.stringify(tasks));
        localStorage.setItem('taskIdCounter', taskIdCounter);
        renderAllViews();
        return true;
    }
    return false;
}

/** Deletes a sticky note by ID 
 * [NEW] Dedicated function for sticky notes.
*/
function deleteStickyNote(id) {
    const initialLength = stickyNotes.length;
    stickyNotes = stickyNotes.filter(n => n.id !== id);
    
    // Remove it from the DOM
    const stickyNoteElement = document.querySelector(`.sticky-note[data-note-id="${id}"]`);
    if (stickyNoteElement) {
        stickyNoteElement.remove();
        activeNote = null;
        if(noteFloatingToolbar) noteFloatingToolbar.classList.add('hidden');
    }
    
    if (stickyNotes.length < initialLength) {
        localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
        return true;
    }
    return false;
}

/** Toggles task completion status */
function toggleTaskCompletion(id, isCompleted) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = isCompleted;
        task.completedDate = isCompleted ? new Date().toISOString().split('T')[0] : null;
        // saveTasksToFirestore(); // Uncomment if using Firestore
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderAllViews();
    }
}

// --- DRAG AND DROP FUNCTIONS (Matrix) ---

let draggedTaskId = null;

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
            // saveTasksToFirestore(); // Uncomment if using Firestore
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderMatrixView(); 
        }
    }
}

function setupMatrixDragAndDrop() {
    quadrants.forEach(quadrantEl => {
        // Clear previous listeners to avoid duplicates on re-render
        quadrantEl.removeEventListener('dragover', handleDragEnter);
        quadrantEl.removeEventListener('dragenter', handleDragEnter);
        quadrantEl.removeEventListener('dragleave', handleDragLeave);
        quadrantEl.removeEventListener('drop', handleDrop);
        
        // Add new listeners
        quadrantEl.addEventListener('dragover', handleDragEnter); 
        quadrantEl.addEventListener('dragenter', handleDragEnter);
        quadrantEl.addEventListener('dragleave', handleDragLeave);
        quadrantEl.addEventListener('drop', handleDrop);
    });
}

document.addEventListener('dragend', (e) => {
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
});


// --- RENDERING FUNCTIONS (Matrix & All Tasks) ---

/** Creates the HTML card for a task */
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

/** Renders the Matrix View */
function renderMatrixView() {
    quadrants.forEach(quadrantEl => {
        const quadrantId = quadrantEl.getAttribute('data-quadrant');
        const listEl = quadrantEl.querySelector('.task-list');
        if (!listEl) return;
        listEl.innerHTML = ''; 

        const quadrantTasks = tasks
            .filter(t => t.quadrant === quadrantId)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        quadrantTasks.forEach(task => {
            listEl.appendChild(createTaskCard(task));
        });
    });
    
    setupMatrixDragAndDrop();
}

/** Renders the All Tasks View */
function renderAllTasksView() {
    if (!allTasksList) return;
    allTasksList.innerHTML = '';
    const sortedTasks = tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    sortedTasks.forEach(task => {
        allTasksList.appendChild(createTaskCard(task));
    });
}

/** Renders both matrix and all-tasks views */
function renderAllViews() {
    renderMatrixView();
    renderAllTasksView();
    renderStickyWallNotes(); // Update sticky notes on the wall
}

// --- MODAL FUNCTIONS ---

/** Opens the modal for a new or existing task 
 * [MODIFIED] Removed all sticky note related logic.
*/
function openModal(taskId = null, quadrant = 'do', noteData = null) {
    if (!modal) return;
    taskForm.reset();
    
    document.getElementById('current-task-id').value = taskId || ''; 

    const task = taskId ? tasks.find(t => t.id === taskId) : null;
    
    // Set default quadrant for new task
    const initialQuadrant = task ? task.quadrant : quadrant;
    document.getElementById('task-priority').value = initialQuadrant;

    // Handle Task Data Display
    if (task) {
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description;
        document.getElementById('task-due-date').value = task.dueDate || '';
    }
    
    // Since tasks and sticky notes are decoupled, sticky note settings are always hidden here.
    if (stickyNoteSettings) {
        stickyNoteSettings.classList.add('hidden');
    }

    if(deleteTaskBtn) deleteTaskBtn.classList.toggle('hidden', !taskId);
    modal.style.display = 'flex';
}

/** Populates the sticky note color picker in the modal 
 * NOTE: This function is currently unused in the decoupled flow but is kept for context.
*/
function populateStickyNoteColorPicker(activeColorName) {
    if (!stickyNoteColorPicker) return;
    stickyNoteColorPicker.innerHTML = '';
    Object.keys(STICKY_NOTE_BG_COLORS).forEach(colorName => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch w-8 h-8 rounded-full border-2 cursor-pointer transition-all';
        swatch.setAttribute('data-color', colorName);
        swatch.style.backgroundColor = STICKY_NOTE_BG_COLORS[colorName];
        
        if (colorName === activeColorName) {
            swatch.classList.add('border-purple-600', 'shadow-lg');
        } else {
            swatch.classList.add('border-gray-300', 'hover:border-gray-500');
        }
        
        swatch.onclick = () => {
            currentStickyNoteColor = colorName;
            populateStickyNoteColorPicker(colorName);
        };
        stickyNoteColorPicker.appendChild(swatch);
    });
}

/** Closes the modal */
function closeModal() {
    if (modal) modal.style.display = 'none';
}


// --- VIEW SWITCHING ---
function switchView(viewName) {
    // Deactivate all containers and menu items
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('active'));
    
    // Hide sticky wall main toolbar by default
    if(toolbar) toolbar.classList.add('hidden');

    // Activate the selected view and menu item
    let activeMenu = null;
    if (viewName === 'matrix') {
        if(matrixContainer) matrixContainer.classList.add('active');
        activeMenu = matrixMenuItem;
    } else if (viewName === 'all-tasks') {
        if(allTasksContainer) allTasksContainer.classList.add('active');
        activeMenu = allTasksMenuItem;
    } else if (viewName === 'sticky-wall') {
        if(stickyWallContainer) stickyWallContainer.classList.add('active');
        if(toolbar) toolbar.classList.remove('hidden'); // Show sticky wall toolbar
        initializeStickyWall();
    }
    
    if (activeMenu) {
        activeMenu.classList.add('active');
    }
    
    currentView = viewName;
    renderAllViews();
}

// --- STICKY WALL CORE LOGIC (Combined/Refined) ---

// --- Drawing Helper Functions (Main Canvas) ---
function updateDrawState() {
    if (currentTool === 'marker' || currentTool === 'highlight') {
        if(corkboard) corkboard.style.cursor = 'crosshair';
    } else if (currentTool === 'add-note' || currentTool === 'washi-tape') {
        if(corkboard) corkboard.style.cursor = 'pointer';
    } else {
        if(corkboard) corkboard.style.cursor = 'default';
    }
}

function drawStroke(stroke) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.globalAlpha = stroke.opacity;
    
    for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1; // Reset opacity
}

function redrawAllStrokes() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(drawStroke);
}

// --- Sticky Note DOM Management ---
/** * [MODIFIED] Uses a separate 'note' object and 'data-note-id' attribute. 
 * This is now fully decoupled from the 'task' object.
*/
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
        <div class="sticky-note-content" contenteditable="true">${note.noteContent || note.title}</div>
        <div class="resize-handle handle-tl"></div>
        <div class="resize-handle handle-tr"></div>
        <div class="resize-handle handle-bl"></div>
        <div class="resize-handle handle-br"></div>
    `;
    
    const content = element.querySelector('.sticky-note-content');
    
    // Restore drawing if data exists
    if (note.noteCanvasData) {
        const noteCanvas = element.querySelector('.note-canvas');
        const noteCtx = noteCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            noteCtx.drawImage(img, 0, 0, noteCanvas.width, noteCanvas.height);
        };
        img.src = note.noteCanvasData;
    }
    
    if(corkboard) corkboard.appendChild(element);

    // Update note in state when content changes
    content.addEventListener('input', () => {
        const updatedNote = stickyNotes.find(n => n.id === note.id); // Use stickyNotes
        if (updatedNote) {
            updatedNote.noteContent = content.innerHTML;
        }
    });
    content.addEventListener('blur', () => {
        // saveTasksToFirestore(); // Uncomment if using Firestore
        localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes)); // Save to new storage key
    });

    return element;
}

/** Renders or updates sticky notes on the corkboard 
 * [MODIFIED] Iterates over the 'stickyNotes' array instead of filtering 'tasks'.
*/
function renderStickyWallNotes() {
    if (!corkboard) return;
    // Remove all existing stickies that are no longer notes
    document.querySelectorAll('.sticky-note').forEach(noteEl => {
        const noteId = noteEl.getAttribute('data-note-id'); // Use note-id
        if (!noteId || !stickyNotes.some(n => n.id === parseInt(noteId))) { // Use stickyNotes
            noteEl.remove();
        }
    });
    
    // Iterate over sticky notes array
    stickyNotes.forEach(note => { 
        let noteEl = document.querySelector(`.sticky-note[data-note-id="${note.id}"]`); // Use note-id
        if (!noteEl) {
            // Create new note if it doesn't exist
            noteEl = createStickyNote(note); 
        } else {
            // Update existing note properties
            noteEl.style.left = (note.canvasX || 0) + 'px';
            noteEl.style.top = (note.canvasY || 0) + 'px';
            noteEl.style.backgroundColor = STICKY_NOTE_BG_COLORS[note.noteColor] || STICKY_NOTE_BG_COLORS.white;
            noteEl.style.width = (note.noteWidth || 250) + 'px';
            noteEl.style.height = (note.noteHeight || 250) + 'px';
            noteEl.setAttribute('data-font', note.noteFont || 'inter');
            noteEl.setAttribute('data-size', note.noteSize || 'medium');
            
            const contentEl = noteEl.querySelector('.sticky-note-content');
            if (contentEl && contentEl.innerHTML !== (note.noteContent || note.title)) {
                 contentEl.innerHTML = note.noteContent || note.title;
            }
        }
    });
}

// --- Sticky Note Floating Toolbar Functions ---

function updateNoteToolbarState() {
    if (!activeNote || !noteFloatingToolbar) return;

    // Update color indicator/menu state
    const colorName = Object.keys(STICKY_NOTE_BG_COLORS).find(key => STICKY_NOTE_BG_COLORS[key].toLowerCase() === activeNote.style.backgroundColor.toLowerCase()) || 'white';
    noteColorMenu.querySelectorAll('.note-color-option').forEach(opt => {
        opt.classList.toggle('active-color', opt.getAttribute('data-color') === colorName);
    });
    
    // Update font display
    const currentFont = activeNote.getAttribute('data-font') || 'inter';
    currentFontDisplay.textContent = currentFont.charAt(0).toUpperCase() + currentFont.slice(1);
    
    // Update size display
    const currentSize = activeNote.getAttribute('data-size') || 'medium';
    currentSizeDisplay.textContent = currentSize.charAt(0).toUpperCase() + currentSize.slice(1);
}

function toggleDropdown(menu) {
    if (!menu) return;
    const isVisible = menu.classList.contains('visible');
    document.querySelectorAll('.note-dropdown-menu').forEach(m => m.classList.remove('visible'));
    if (!isVisible) {
        menu.classList.add('visible');
    } else {
        menu.classList.remove('visible');
    }
}

// --- Sticky Wall Drawing Logic ---

function setNoteDrawMode(enable) {
    isDrawingOnNote = enable;
    if(corkboard) corkboard.setAttribute('data-tool', enable ? 'note-draw' : 'select');
    
    if (activeNote) {
        activeNote.setAttribute('data-drawing', enable);
        activeNote.style.cursor = enable ? 'crosshair' : 'grab';
        const contentEl = activeNote.querySelector('.sticky-note-content');
        if(contentEl) contentEl.contentEditable = !enable;
        if(noteDrawToggleBtn) noteDrawToggleBtn.classList.toggle('active', enable);
        
        if (enable) {
            const noteCanvas = activeNote.querySelector('.note-canvas');
            if(noteCanvas) currentNoteCtx = noteCanvas.getContext('2d');
        } else {
            currentNoteCtx = null;
            // Save the drawing to the note data as base64
            const noteCanvas = activeNote.querySelector('.note-canvas');
            const noteId = parseInt(activeNote.getAttribute('data-note-id')); // Use note-id
            const note = stickyNotes.find(n => n.id === noteId); // Use stickyNotes
            if (note && noteCanvas) {
                note.noteCanvasData = noteCanvas.toDataURL();
                saveStickyNote(note); // Save note data
            }
        }
    }
}

let noteDrawing = false;
function startNoteDraw(e) {
    if (!isDrawingOnNote || !currentNoteCtx) return;
    noteDrawing = true;
    currentNoteCtx.beginPath();
    
    // Coordinates are relative to the note's canvas
    currentNoteCtx.moveTo(e.offsetX, e.offsetY); 
    e.stopPropagation();
}

function drawOnNote(e) {
    if (!noteDrawing || !currentNoteCtx) return;
    
    currentNoteCtx.strokeStyle = currentStrokeColor;
    currentNoteCtx.lineWidth = currentStrokeWidth * 0.5; // Smaller stroke for notes
    currentNoteCtx.lineCap = 'round';
    currentNoteCtx.globalAlpha = 1;
    
    // Coordinates are relative to the note's canvas
    currentNoteCtx.lineTo(e.offsetX, e.offsetY);
    currentNoteCtx.stroke();
    e.stopPropagation();
}

function endNoteDraw() {
    if (noteDrawing) {
        noteDrawing = false;
        currentNoteCtx.closePath();
    }
}

// --- Sticky Note Drag and Resize Handlers ---

let isResizing = false;
let activeHandle = null;
let initialNoteWidth, initialNoteHeight, initialMouseX, initialMouseY, initialNoteX, initialNoteY;

function startDragOrResize(e) {
    if (e.button !== 0 || drawing || !corkboard) return; 
    
    noteFloatingToolbar?.classList.add('hidden'); // Hide toolbar initially

    // 1. Check if a handle was clicked (for resizing)
    if (e.target.classList.contains('resize-handle')) {
        isResizing = true;
        activeHandle = e.target;
        activeNote = e.target.closest('.sticky-note');
        
        initialNoteWidth = activeNote.offsetWidth;
        initialNoteHeight = activeNote.offsetHeight;
        initialNoteX = parseInt(activeNote.style.left) || 0;
        initialNoteY = parseInt(activeNote.style.top) || 0;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        
        document.querySelectorAll('.sticky-note').forEach(n => n.style.zIndex = '50');
        activeNote.style.zIndex = '100';
        
        e.preventDefault();
        return;
    }
    
    // 2. Check for Note Drawing start
    if (isDrawingOnNote && e.target.closest('.sticky-note') === activeNote) {
        startNoteDraw(e);
        return;
    }
    
    // 3. Check if the note itself or the content was clicked (for dragging)
    const clickedNote = e.target.closest('.sticky-note');
    if (clickedNote && currentTool === 'select' && !isDrawingOnNote) {
        activeDraggable = clickedNote;
        isMoving = true;
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Set active note state
        document.querySelectorAll('.sticky-note').forEach(n => n.classList.remove('active-note'));
        activeDraggable.classList.add('active-note');
        activeNote = activeDraggable;
        
        // Show floating toolbar
        updateNoteToolbarState();
        updateNoteToolbarPosition(activeNote);
        noteFloatingToolbar?.classList.remove('hidden');

        e.preventDefault();
        return;
    }
    
    // 4. Main Canvas Drawing (Marker/Highlighter)
    if ((currentTool === 'marker' || currentTool === 'highlight') && e.target === canvas) {
        drawing = true;
        // FIX: Use e.offsetX/Y for drawing relative to the canvas element
        const newStroke = {
            tool: currentTool,
            color: currentStrokeColor,
            width: currentStrokeWidth,
            opacity: currentOpacity,
            points: [{ x: e.offsetX, y: e.offsetY }]
        };
        strokes.push(newStroke);
        e.preventDefault();
        return;
    }

    // 5. Clicked outside any active element - deselect
    if (activeNote) {
        activeNote.classList.remove('active-note');
        noteFloatingToolbar?.classList.add('hidden');
        activeNote = null;
        setNoteDrawMode(false); // Disable note drawing mode
    }
}

function dragOrResize(e) {
    if (!corkboard) return;
    e.preventDefault();
    
    // 1. Resizing Logic
    if (isResizing && activeNote) {
        const dx = e.clientX - initialMouseX;
        const dy = e.clientY - initialMouseY;
        let newWidth = initialNoteWidth;
        let newHeight = initialNoteHeight;
        let newLeft = initialNoteX;
        let newTop = initialNoteY;

        const minSize = 150; 

        if (activeHandle.classList.contains('handle-tr')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx);
            newHeight = Math.max(minSize, initialNoteHeight + dy * -1);
            newTop = initialNoteY + (initialNoteHeight - newHeight); 
        } else if (activeHandle.classList.contains('handle-tl')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx * -1);
            newLeft = initialNoteX + (initialNoteWidth - newWidth);
            newHeight = Math.max(minSize, initialNoteHeight + dy * -1);
            newTop = initialNoteY + (initialNoteHeight - newHeight);
        } else if (activeHandle.classList.contains('handle-bl')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx * -1);
            newLeft = initialNoteX + (initialNoteWidth - newWidth);
            newHeight = Math.max(minSize, initialNoteHeight + dy);
        } else if (activeHandle.classList.contains('handle-br')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx);
            newHeight = Math.max(minSize, initialNoteHeight + dy);
        }

        // Apply new styles and boundary checks
        newLeft = Math.max(0, newLeft);
        newTop = Math.max(0, newTop);

        activeNote.style.width = newWidth + 'px';
        activeNote.style.height = newHeight + 'px';
        activeNote.style.left = newLeft + 'px';
        activeNote.style.top = newTop + 'px';


        // Resize internal canvas (critical to avoid distortion on subsequent drawing)
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

    // 2. Dragging Logic
    if (isMoving && activeDraggable) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        let newLeft = activeDraggable.offsetLeft + dx;
        let newTop = activeDraggable.offsetTop + dy;
        
        // Keep the draggable within the corkboard bounds
        newLeft = Math.max(0, newLeft);
        newTop = Math.max(0, newTop);
        newLeft = Math.min(newLeft, corkboard.scrollWidth - activeDraggable.offsetWidth);
        newTop = Math.min(newTop, corkboard.scrollHeight - activeDraggable.offsetHeight);
        
        activeDraggable.style.left = newLeft + 'px';
        activeDraggable.style.top = newTop + 'px';
        
        lastX = e.clientX;
        lastY = e.clientY;
        
        updateNoteToolbarPosition(activeDraggable);
        return;
    }
    
    // 3. Main Canvas Drawing Logic
    if (drawing && e.target === canvas) {
        const currentStroke = strokes[strokes.length - 1];
        // FIX: Using offsetX/Y here which is relative to the canvas element itself
        currentStroke.points.push({ x: e.offsetX, y: e.offsetY }); 
        redrawAllStrokes();
        return;
    }
    
    // 4. Note Drawing Logic
    if (noteDrawing && activeNote) {
        drawOnNote(e);
    }
}

/** * [MODIFIED] Uses 'stickyNotes' and 'data-note-id' to persist changes via 'saveStickyNote'.
*/
function endDragOrResize(e) {
    if (!corkboard) return;
    
    // 1. Resizing End
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
            if(noteCanvas) note.noteCanvasData = noteCanvas.toDataURL();
            
            saveStickyNote(note); 
        }
    }
    
    // 2. Dragging End
    if (isMoving && activeDraggable) {
        isMoving = false;
        const noteId = parseInt(activeDraggable.getAttribute('data-note-id'));
        const note = stickyNotes.find(n => n.id === noteId);
        if (note) {
            note.canvasX = parseInt(activeDraggable.style.left) || 0;
            note.canvasY = parseInt(activeDraggable.style.top) || 0;
            saveStickyNote(note);
        }
        activeDraggable = null;
    }
    
    // 3. Main Canvas Drawing End
    if (drawing) {
        drawing = false;
        // In a real app, strokes would be saved to persistent storage here
    }
    
    // 4. Note Drawing End
    if (noteDrawing) {
        endNoteDraw();
    }
}

function updateNoteToolbarPosition(note) {
    if (!note.parentNode || !noteFloatingToolbar) return;
    
    const rect = note.getBoundingClientRect();
    const toolbarRect = noteFloatingToolbar.getBoundingClientRect();
    const mainRect = document.querySelector('main')?.getBoundingClientRect(); // Adjust based on your layout

    if (!mainRect) return;
    
    let top = rect.top - toolbarRect.height - 10;
    let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);
    
    top -= mainRect.top;
    left -= mainRect.left;

    if (top < 10) {
        top = rect.bottom - mainRect.top + 10; 
    }
    
    noteFloatingToolbar.style.top = top + 'px';
    noteFloatingToolbar.style.left = left + 'px';
}

// --- Sticky Wall Toolbar Event Handlers ---

/** * [MODIFIED] Calls 'saveStickyNote' to create a new decoupled note entity.
*/
function handleToolClick(e) {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;

    const tool = btn.getAttribute('data-tool');
    if (!tool) return;
    
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentTool = tool;
    updateDrawState();

    if (tool === 'add-note') {
        const newNoteX = (corkboard.scrollWidth / 2) - 125;
        const newNoteY = (corkboard.scrollHeight / 2) - 125;
        
        const newNoteData = {
            title: 'New Sticky Note',
            noteColor: currentStickyNoteColor,
            noteFont: 'inter',
            noteSize: 'medium',
            noteContent: 'Click to add text...',
            canvasX: newNoteX,
            canvasY: newNoteY,
            noteWidth: 250,
            noteHeight: 250
        };
        
        saveStickyNote(newNoteData); // Save to stickyNotes array
    }
    
    if (tool !== 'select' && activeNote) {
        activeNote.classList.remove('active-note');
        noteFloatingToolbar?.classList.add('hidden');
        activeNote = null;
        setNoteDrawMode(false); 
    }
}

/** * [MODIFIED] Uses 'stickyNotes' and 'deleteStickyNote' for persistence.
*/
function handleToolbarClicks(e) {
    const target = e.target.closest('.note-tool-btn, .note-color-option, .note-font-option, .note-size-option');
    if (!target || !activeNote) return;
    
    // Prevent note drawing logic from interrupting toolbar interaction
    if (isDrawingOnNote) {
        e.stopPropagation();
        e.preventDefault();
    }
    
    // Delete Button
    if (target.classList.contains('note-delete-btn')) {
        window.showConfirm("Are you sure you want to delete this sticky note?", (result) => {
            if (result) {
                const noteId = parseInt(activeNote.getAttribute('data-note-id'));
                deleteStickyNote(noteId); // Use dedicated note deletion
            }
        });
        e.preventDefault();
        return;
    } 
    
    // Drawing Toggle
    else if (target.classList.contains('note-draw-toggle')) {
        setNoteDrawMode(!isDrawingOnNote);
        e.preventDefault();
        return;
    }
    
    // Text Formatting
    else if (target.dataset.textStyle) {
        // Use standard execCommand for text formatting
        document.execCommand(target.dataset.textStyle, false, null);
        updateNoteToolbarState();
        e.preventDefault();
    } 
    
    // Author Stamp
    else if (target.id === 'note-author-btn') {
        document.execCommand('insertText', false, USERNAME + ' ');
        e.preventDefault();
    }
    
    // Color/Font/Size Selection Logic (Updates note data and visual style)
    else {
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
            const noteId = parseInt(activeNote.getAttribute('data-note-id'));
            const note = stickyNotes.find(n => n.id === noteId);
            if (note) {
                Object.assign(note, noteUpdate);
                saveStickyNote(note); // Use dedicated note save
            }
            updateNoteToolbarState();
            updateNoteToolbarPosition(activeNote);
        }
    }
}

// --- Sticky Wall Initialization (called when view switches) ---
function initializeStickyWall() {
    if (!canvas || !corkboard) return;
    
    // Set up main canvas context and dimensions
    canvas.width = corkboard.scrollWidth; 
    canvas.height = corkboard.scrollHeight;
    ctx = canvas.getContext('2d');
    
    redrawAllStrokes();
    renderStickyWallNotes();
}

// --- Main Event Listeners (Setup on DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data from localStorage
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
        taskIdCounter = parseInt(localStorage.getItem('taskIdCounter')) || 1;
    }
    
    // [NEW] Load sticky notes from localStorage
    const storedNotes = localStorage.getItem('stickyNotes');
    if (storedNotes) {
        stickyNotes = JSON.parse(storedNotes);
        stickyNoteIdCounter = parseInt(localStorage.getItem('stickyNoteIdCounter')) || 1;
    }

    // Set up initial sticky wall context
    if (canvas && corkboard) {
        initializeStickyWall();
    }

    // --- Matrix Core Event Listeners ---
    // Quadrant Add Button Listener
    quadrants.forEach(q => {
        q.querySelector('.quadrant-add-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const quadrant = e.currentTarget.getAttribute('data-quadrant');
            openModal(null, quadrant);
        });
    });

    // Modal Close Listeners
    closeButton?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // New Task Button (All Tasks View)
    newTaskButton?.addEventListener('click', () => {
        openModal(null, 'do');
    });

    // Task Form Submission
    taskForm?.addEventListener('submit', (e) => {
        e.preventDefault();

        const taskId = document.getElementById('current-task-id').value ? parseInt(document.getElementById('current-task-id').value) : null;
        const taskTitle = document.getElementById('task-title').value;
        const taskDescription = document.getElementById('task-description').value;
        const taskDueDate = document.getElementById('task-due-date').value;
        const taskQuadrant = document.getElementById('task-priority').value;

        // NOTE: Since sticky notes are decoupled, existingTask is only used to preserve 
        // core task fields like completion status and subtasks, which are handled in saveTask.
        
        const taskData = {
            id: taskId,
            title: taskTitle,
            description: taskDescription,
            dueDate: taskDueDate,
            quadrant: taskQuadrant,
            // Only passing core task properties to saveTask
        };

        saveTask(taskData);
        closeModal();
    });

    // Task Delete Button
    deleteTaskBtn?.addEventListener('click', () => {
        const taskId = parseInt(document.getElementById('current-task-id').value);
        window.showConfirm("Are you sure you want to delete this task? This action cannot be undone.", (result) => {
            if (result) {
                deleteTask(taskId);
                closeModal();
            }
        });
    });

    // Menu Click Listeners
    document.querySelectorAll('.sidebar .task-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if (view) {
                switchView(view);
            }
        });
    });
    
    // --- Sticky Wall Global Mouse Handlers ---
    document.addEventListener('mousedown', startDragOrResize);
    document.addEventListener('mousemove', dragOrResize);
    document.addEventListener('mouseup', endDragOrResize);
    // Note: Mousedown on sticky note elements should call startNoteDraw

    // Main Tool Bar clicks
    toolbar?.addEventListener('click', handleToolClick);

    // Sticky Note Floating Toolbar clicks
    noteFloatingToolbar?.addEventListener('click', handleToolbarClicks);
    noteColorBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteColorMenu); });
    noteFontBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteFontMenu); });
    noteSizeBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteSizeMenu); });

    // Drawing options (placeholders for real sliders/buttons)
    document.getElementById('stroke-width-slider')?.addEventListener('input', (e) => {
        currentStrokeWidth = parseFloat(e.target.value);
    });
    document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
        currentOpacity = parseFloat(e.target.value);
    });
    document.getElementById('stroke-color-input')?.addEventListener('input', (e) => {
        currentStrokeColor = e.target.value;
    });

    // Undo and Clear buttons (placeholders)
    document.getElementById('undo-btn')?.addEventListener('click', () => {
        if (strokes.length > 0) {
            strokes.pop();
            redrawAllStrokes();
        }
    });

    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
        window.showConfirm("Are you sure you want to clear ALL drawings from the board?", (result) => {
            if (result) {
                strokes = [];
                redrawAllStrokes();
            }
        });
    });
    
    // Initialize sticky wall on window resize
    window.addEventListener('resize', () => {
        if (currentView === 'sticky-wall') {
            initializeStickyWall(); 
        }
    });

    // Initial render and view set
    renderAllViews();
    switchView('matrix');
});