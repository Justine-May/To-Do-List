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
    'x-large': 'X-Large'
};

/** Converts a size key (small, medium, etc.) to a pixel value for toolbar preview */
function getFontSizeInPx(sizeKey) {
    switch (sizeKey) {
        case 'small': return '12px';
        case 'medium': return '16px';
        case 'large': return '20px';
        case 'x-large': return '24px';
        default: return '16px';
    }
}
// --- END NEW CONSTANTS ---

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
let activeNote = null; // Currently selected sticky note DOM element
const USERNAME = '@User';

// --- TASK MANAGEMENT FUNCTIONS (Core) ---

/** Adds or updates a task (DECOUPLED) */
function saveTask(taskData) {
    let task;
    if (taskData.id) {
        task = tasks.find(t => t.id === taskData.id);
        if (task) {
            // Only update core task properties
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

/** Deletes a task by ID (DECOUPLED) */
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

/** Toggles task completion status */
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

/** Adds or updates a sticky note (DECOUPLED) */
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

/** Deletes a sticky note by ID (DECOUPLED) */
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

// --- RENDERING & VIEW SWITCHING (Matrix/All Tasks logic omitted for brevity, see provided code for full implementation) ---

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

/** Renders both matrix and all-tasks views and notes */
function renderAllViews() {
    renderMatrixView();
    renderAllTasksView();
    renderStickyWallNotes(); 
}

/** Opens the modal for a new or existing task (CLEANED) */
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
    
    if (stickyNoteSettings) {
        stickyNoteSettings.classList.add('hidden');
    }

    if(deleteTaskBtn) deleteTaskBtn.classList.toggle('hidden', !taskId);
    modal.style.display = 'flex';
}

/** Closes the modal */
function closeModal() {
    if (modal) modal.style.display = 'none';
}


function switchView(viewName) {
    // Deactivate all containers and menu items
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('active'));
    
    // Hide sticky wall main toolbar by default
    if(toolbar) toolbar.classList.add('hidden');
    
    // Hide floating note toolbar
    noteFloatingToolbar?.classList.add('hidden');
    if (activeNote) {
        activeNote.classList.remove('active-note');
        activeNote = null;
    }


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
        activeMenu = stickyWallMenuItem;
    }
    
    if (activeMenu) {
        activeMenu.classList.add('active');
    }
    
    currentView = viewName;
    renderAllViews();
}


// --- STICKY WALL CORE LOGIC ---

// --- Sticky Note DOM Management ---
/** Creates the HTML card for a sticky note */
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
        const updatedNote = stickyNotes.find(n => n.id === note.id);
        if (updatedNote) {
            updatedNote.noteContent = content.innerHTML;
        }
    });
    content.addEventListener('blur', () => {
        // Save note on blur to ensure content is up-to-date
        saveStickyNote(stickyNotes.find(n => n.id === note.id));
    });

    return element;
}

/** Renders or updates sticky notes on the corkboard */
function renderStickyWallNotes() {
    if (!corkboard) return;
    
    // Get current sticky note elements on the board
    const currentNoteEls = Array.from(document.querySelectorAll('.sticky-note'));
    
    // 1. Remove notes that no longer exist in the state
    currentNoteEls.forEach(noteEl => {
        const noteId = parseInt(noteEl.getAttribute('data-note-id')); 
        if (!stickyNotes.some(n => n.id === noteId)) {
            noteEl.remove();
        }
    });
    
    // 2. Add or update notes from the state
    stickyNotes.forEach(note => { 
        let noteEl = document.querySelector(`.sticky-note[data-note-id="${note.id}"]`); 
        if (!noteEl) {
            noteEl = createStickyNote(note); 
        } else {
            // Update existing note properties 
            noteEl.style.left = (note.canvasX || 0) + 'px';
            noteEl.style.top = (note.canvasY || 0) + 'px';
            noteEl.style.backgroundColor = STICKY_NOTE_BG_COLORS[note.noteColor] || STICKY_NOTE_BG_COLORS.white;
            noteEl.style.width = (note.noteWidth || 250) + 'px';
            noteEl.style.height = (note.noteHeight || 250) + 'px';
            // Update the data attributes that CSS depends on
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

/** * Checks the current selection state in the active note's contenteditable 
 * area and updates the active class on the text style buttons.
 */
function updateTextStyleButtonStates() {
    if (!activeNote || isDrawingOnNote) return;

    const contentEl = activeNote.querySelector('.sticky-note-content');
    if (!contentEl) return;

    // Must focus the contenteditable area for queryCommandState to work
    // Note: Focusing here can interfere with selection, but is necessary for queryCommandState
    // contentEl.focus(); 

    document.querySelectorAll('#note-floating-toolbar .note-tool-btn[data-text-style]').forEach(btn => {
        const style = btn.dataset.textStyle;
        let command = style;
        
        // Map data-text-style to execCommand names
        if (command === 'strike') command = 'strikeThrough';
        if (command === 'unordered-list') command = 'insertUnorderedList';
        if (command === 'ordered-list') command = 'insertOrderedList';

        let isActive = false;
        try {
            isActive = document.queryCommandState(command);
        } catch (e) {
            // Ignore commands that might not be supported/fail
        }

        btn.classList.toggle('active', isActive);
    });
}

/**
 * Updates the floating toolbar buttons (Color, Font, and Size display)
 * and the active state of the dropdown options for the selected note.
 */
function updateNoteToolbarState() {
    if (!activeNote || !noteFloatingToolbar) return;

    // 1. Get current font and size from activeNote data attributes
    const currentFont = activeNote.getAttribute('data-font') || 'inter';
    const currentSize = activeNote.getAttribute('data-size') || 'medium';

    // 2. Update Color indicator/menu state
    const currentColor = activeNote.style.backgroundColor;
    const colorName = Object.keys(STICKY_NOTE_BG_COLORS).find(key => STICKY_NOTE_BG_COLORS[key].toLowerCase() === currentColor.toLowerCase());

    document.getElementById('current-note-color').style.color = STICKY_NOTE_BG_COLORS[colorName] || '#ccc';

    noteColorMenu.querySelectorAll('.note-color-option').forEach(opt => {
        opt.classList.toggle('active-color', opt.getAttribute('data-color') === colorName);
    });
    
    // 3. Update Font Button Display
    if (currentFontDisplay) {
        currentFontDisplay.textContent = FONT_DISPLAY_NAMES[currentFont];
        // Apply the font to the button text itself for a visual preview
        if (currentFont === 'marker') {
            currentFontDisplay.style.fontFamily = "'Permanent Marker', cursive";
        } else if (currentFont === 'roboto') {
            currentFontDisplay.style.fontFamily = "'Roboto', sans-serif";
        } else {
            currentFontDisplay.style.fontFamily = "'Inter', sans-serif";
        }
    }
    
    // 4. Update Size Button Display
    if (currentSizeDisplay) {
        currentSizeDisplay.textContent = SIZE_DISPLAY_TEXT[currentSize];
        // Use the actual size for the button text itself for a size preview
        currentSizeDisplay.style.fontSize = getFontSizeInPx(currentSize);
    }
    
    // 5. Update the active state for font/size dropdown options
    document.querySelectorAll('.note-font-option, .note-size-option').forEach(el => el.classList.remove('active'));
    document.querySelector(`.note-font-option[data-font="${currentFont}"]`)?.classList.add('active');
    document.querySelector(`.note-size-option[data-size="${currentSize}"]`)?.classList.add('active');
    
    // 6. Hide all dropdowns (will be shown on explicit click)
    // document.querySelectorAll('.note-dropdown-menu').forEach(m => m.classList.remove('visible'));

    // 7. Update drawing toggle button state
    noteDrawToggleBtn?.classList.toggle('active', isDrawingOnNote);

    // 8. Update text style buttons (B, I, U, L)
    updateTextStyleButtonStates();
}

function toggleDropdown(menu) {
    if (!menu) return;
    const isVisible = menu.classList.contains('visible');
    // Hide all menus
    document.querySelectorAll('.note-dropdown-menu').forEach(m => m.classList.remove('visible'));
    // Show only the requested menu
    if (!isVisible) {
        menu.classList.add('visible');
    }
}

/**
 * Calculates and sets the position of the floating toolbar 10px above the active sticky note.
 */
function updateNoteToolbarPosition(note) {
    if (!note.parentNode || !noteFloatingToolbar) return;

    // Get note's current absolute position and dimensions
    const noteX = parseInt(note.style.left) || 0;
    const noteY = parseInt(note.style.top) || 0;
    const noteWidth = note.offsetWidth;
    // We need getBoundingClientRect here to get the toolbar's dimensions
    const toolbarRect = noteFloatingToolbar.getBoundingClientRect(); 

    // The toolbar is also absolutely positioned within the corkboard.
    
    // Target position (TOP): 10px above the note (NoteY - toolbarHeight - margin)
    let top = noteY - toolbarRect.height - 10;
    // Target position (LEFT): centered horizontally above the note
    let left = noteX + (noteWidth / 2) - (toolbarRect.width / 2);

    // Clamp the top position to prevent it from going above the corkboard's top edge (0px)
    top = Math.max(0, top);

    // Keep left position reasonable
    const corkboardWidth = corkboard.scrollWidth;
    left = Math.max(10, left);
    left = Math.min(left, corkboardWidth - toolbarRect.width - 10);
    
    noteFloatingToolbar.style.top = top + 'px';
    noteFloatingToolbar.style.left = left + 'px';
}

// --- Sticky Wall Drawing Logic (On Note) ---
function setNoteDrawMode(enable) {
    isDrawingOnNote = enable;
    if(corkboard) corkboard.setAttribute('data-tool', enable ? 'note-draw' : 'select');
    
    if (activeNote) {
        activeNote.setAttribute('data-drawing', enable);
        activeNote.style.cursor = enable ? 'crosshair' : 'grab';
        const contentEl = activeNote.querySelector('.sticky-note-content');
        if(contentEl) contentEl.contentEditable = !enable;
        
        if (enable) {
            const noteCanvas = activeNote.querySelector('.note-canvas');
            if(noteCanvas) currentNoteCtx = noteCanvas.getContext('2d');
        } else {
            currentNoteCtx = null;
            
            // Save the drawing to the note data as base64
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
function startNoteDraw(e) {
    if (!isDrawingOnNote || !currentNoteCtx) return;
    noteDrawing = true;
    currentNoteCtx.beginPath();
    currentNoteCtx.moveTo(e.offsetX, e.offsetY); 
    e.stopPropagation();
}

function drawOnNote(e) {
    if (!noteDrawing || !currentNoteCtx) return;
    
    currentNoteCtx.strokeStyle = currentStrokeColor; // Use main toolbar's color
    currentNoteCtx.lineWidth = currentStrokeWidth * 0.5; // Smaller stroke for notes
    currentNoteCtx.lineCap = 'round';
    currentNoteCtx.globalAlpha = 1;
    
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

// --- Mouse/Drag Handlers (Combined) ---
let isResizing = false;
let activeHandle = null;
let initialNoteWidth, initialNoteHeight, initialMouseX, initialMouseY, initialNoteX, initialNoteY;

function startDragOrResize(e) {
    if (e.button !== 0 || drawing || !corkboard) return; 
    
    // Handle dismissal of dropdowns if clicking outside
    if (!e.target.closest('#note-floating-toolbar')) {
        document.querySelectorAll('.note-dropdown-menu').forEach(m => m.classList.remove('visible'));
    }
    
    // NOTE: Keep toolbar visible until dragging/resizing is confirmed to be starting
    // noteFloatingToolbar?.classList.add('hidden'); 

    // 1. Resizing check
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
        noteFloatingToolbar?.classList.add('hidden'); // Hide toolbar when resizing starts
        
        e.preventDefault();
        return;
    }
    
    // 2. Note Drawing start check
    const clickedNote = e.target.closest('.sticky-note');
    if (isDrawingOnNote && clickedNote === activeNote && e.target.classList.contains('note-canvas')) {
        startNoteDraw(e);
        return;
    }
    
    // 3. Dragging check (on the note or its content/handles if not drawing)
    if (clickedNote && currentTool === 'select' && !isDrawingOnNote) {
        
        // --- FIX: Force ContentEditable to Blur for reliable dragging ---
        const contentArea = clickedNote.querySelector('.sticky-note-content');
        if (contentArea) {
            // Check if the click originated from within the content area
            if (contentArea.contains(e.target)) {
                // If the click is on the text content, blur it to stop text selection/editing
                contentArea.blur(); 
            }
        }
        // --- END FIX ---

        activeDraggable = clickedNote;
        isMoving = true;
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Set active note state
        document.querySelectorAll('.sticky-note').forEach(n => n.classList.remove('active-note'));
        activeDraggable.classList.add('active-note');
        activeDraggable.classList.add('is-moving'); 
        activeNote = activeDraggable;
        
        // Show floating toolbar
        updateNoteToolbarState();
        updateNoteToolbarPosition(activeNote);
        noteFloatingToolbar?.classList.remove('hidden');

        // Bring to front
        document.querySelectorAll('.sticky-note').forEach(n => n.style.zIndex = '50');
        activeNote.style.zIndex = '100';

        e.preventDefault();
        return;
    }
    
    // 4. Main Canvas Drawing (Marker/Highlighter)
    if ((currentTool === 'marker' || currentTool === 'highlight') && e.target === canvas) {
        drawing = true;
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
    if (activeNote && !e.target.closest('.sticky-note') && !e.target.closest('#note-floating-toolbar')) {
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

        if (activeHandle.classList.contains('handle-br')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx);
            newHeight = Math.max(minSize, initialNoteHeight + dy);
        }
        else if (activeHandle.classList.contains('handle-tl')) {
            newWidth = Math.max(minSize, initialNoteWidth - dx);
            newLeft = initialNoteX + (initialNoteWidth - newWidth);
            newHeight = Math.max(minSize, initialNoteHeight - dy);
            newTop = initialNoteY + (initialNoteHeight - newHeight);
        }
        else if (activeHandle.classList.contains('handle-tr')) {
            newWidth = Math.max(minSize, initialNoteWidth + dx);
            newHeight = Math.max(minSize, initialNoteHeight - dy);
            newTop = initialNoteY + (initialNoteHeight - newHeight);
        }
        else if (activeHandle.classList.contains('handle-bl')) {
            newWidth = Math.max(minSize, initialNoteWidth - dx);
            newLeft = initialNoteX + (initialNoteWidth - newWidth);
            newHeight = Math.max(minSize, initialNoteHeight + dy);
        }

        // Apply new styles
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
        currentStroke.points.push({ x: e.offsetX, y: e.offsetY }); 
        // Redrawing logic is assumed to be handled elsewhere (redrawAllStrokes)
        // ... (drawing logic) ...
        return;
    }
    
    // 4. Note Drawing Logic
    if (noteDrawing && activeNote) {
        drawOnNote(e);
    }
}

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
        activeDraggable.classList.remove('is-moving'); 
        
        const noteId = parseInt(activeDraggable.getAttribute('data-note-id'));
        const note = stickyNotes.find(n => n.id === noteId);
        if (note) {
            note.canvasX = parseInt(activeDraggable.style.left) || 0;
            note.canvasY = parseInt(activeDraggable.style.top) || 0;
            saveStickyNote(note);
        }
        activeDraggable = null;
        
        // Ensure toolbar remains open and updated after drag
        if (activeNote) {
            updateNoteToolbarState();
            noteFloatingToolbar?.classList.remove('hidden');
        }
    }
    
    // 3. Main Canvas Drawing End
    if (drawing) {
        drawing = false;
        // Save strokes logic here
    }
    
    // 4. Note Drawing End
    if (noteDrawing) {
        endNoteDraw();
    }
}

// --- Sticky Wall Toolbar Event Handlers ---

/** Handles clicks on the main corkboard toolbar */
function handleToolClick(e) {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;

    const tool = btn.getAttribute('data-tool');
    if (!tool) return;
    
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentTool = tool;
    
    // Remove selection and hide toolbar if switching tools
    if (tool !== 'select' && activeNote) {
        activeNote.classList.remove('active-note');
        noteFloatingToolbar?.classList.add('hidden');
        activeNote = null;
        setNoteDrawMode(false); // Disable note drawing mode
    }
    
    // Add new sticky note
    if (tool === 'add-note') {
        // Calculate center of current scroll view
        const centerX = corkboard.scrollLeft + (corkboard.clientWidth / 2);
        const centerY = corkboard.scrollTop + (corkboard.clientHeight / 2);
        
        const newNoteX = centerX - 125; // 125px is half of 250px note width
        const newNoteY = centerY - 125; // 125px is half of 250px note height
        
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
        
        saveStickyNote(newNoteData); 
    }
}


/** Handles clicks on the floating sticky note toolbar */
function handleToolbarClicks(e) {
    const target = e.target.closest('.note-tool-btn, .note-color-option, .note-font-option, .note-size-option');
    if (!target || !activeNote) return;
    
    // Prevent note drawing logic from interrupting toolbar interaction
    e.stopPropagation();
    e.preventDefault(); 
    
    // Find the note data in the state
    const noteId = parseInt(activeNote.getAttribute('data-note-id'));
    const note = stickyNotes.find(n => n.id === noteId);
    const contentEl = activeNote.querySelector('.sticky-note-content');

    if (!note || !contentEl) return;
    
    // 1. Delete Button
    if (target.classList.contains('note-delete-btn')) {
        window.showConfirm("Are you sure you want to delete this sticky note?", (result) => {
            if (result) {
                deleteStickyNote(noteId); 
            }
        });
    } 
    
    // 2. Drawing Toggle (Draw/Hide User)
    else if (target.classList.contains('note-draw-toggle')) {
        setNoteDrawMode(!isDrawingOnNote);
    }
    
    // 3. Text Formatting (Bold, Strike, List)
    else if (target.dataset.textStyle) {
        // *** CRITICAL FIX: Must focus the contenteditable area before calling execCommand ***
        contentEl.focus(); 
        
        let command = target.dataset.textStyle;
        if (command === 'strike') command = 'strikeThrough';
        
        if (command === 'unordered-list' || command === 'ordered-list') {
            // Check if any list is active, if so, outdent/remove list first
            if (document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')) {
                 document.execCommand('outdent', false, null);
            } else {
                 document.execCommand(command === 'unordered-list' ? 'insertUnorderedList' : 'insertOrderedList', false, null);
            }
        } else {
            document.execCommand(command, false, null);
        }

        // Update button states and save the new HTML content
        updateTextStyleButtonStates();
        note.noteContent = contentEl.innerHTML;
        saveStickyNote(note);

    } 
    
    // 4. Author Stamp (Show/Hide User)
    else if (target.id === 'note-author-btn') {
        // *** CRITICAL FIX: Must focus the contenteditable area before calling execCommand ***
        contentEl.focus();
        
        document.execCommand('insertText', false, USERNAME + ' ');
        note.noteContent = contentEl.innerHTML;
        saveStickyNote(note);
    }
    
    // 5. Color/Font/Size Selection Logic
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
            activeNote.setAttribute('data-font', fontName); // Update DOM attribute
            noteUpdate.noteFont = fontName;
            needsUpdate = true;
            toggleDropdown(noteFontMenu);
        } else if (target.classList.contains('note-size-option')) {
            const sizeName = target.getAttribute('data-size');
            activeNote.setAttribute('data-size', sizeName); // Update DOM attribute
            noteUpdate.noteSize = sizeName;
            needsUpdate = true;
            toggleDropdown(noteSizeMenu);
        }
        
        if (needsUpdate) {
            // Save the data and trigger render update (which mainly updates non-active notes)
            Object.assign(note, noteUpdate);
            saveStickyNote(note); 
            // Update the toolbar display for the active note
            updateNoteToolbarState();
            updateNoteToolbarPosition(activeNote);
        }
    }
}

// --- Sticky Wall Initialization ---
function initializeStickyWall() {
    if (!canvas || !corkboard) return;
    
    // Set up main canvas context and dimensions
    // Ensure corkboard can be scrolled and canvas covers the scrollable area
    canvas.width = corkboard.scrollWidth; 
    canvas.height = corkboard.scrollHeight;
    ctx = canvas.getContext('2d');
    
    // Redraw strokes logic here (placeholder)
    
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
        // Use a flag or check if the listener is already attached to prevent duplicates
        // For simplicity and robustness, we re-apply all listeners here:
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

// --- Main Event Listeners (Setup on DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.quadrant-add-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Get the quadrant ID from the button's data-quadrant attribute 
        // (e.g., 'do', 'schedule', 'delegate', 'eliminate')
        const quadrant = button.getAttribute('data-quadrant'); 
        
        // Open the modal for a new task.
        // We pass 'null' for the taskId (indicating a new task) 
        // and the correct 'quadrant' to pre-select the priority in the modal.
        openModal(null, quadrant);
    });
});
    // Load initial data from localStorage
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
        taskIdCounter = parseInt(localStorage.getItem('taskIdCounter')) || 1;
    }
    
    // [DECOUPLED] Load sticky notes from localStorage
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
    document.addEventListener('dragend', (e) => {
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    
    // Listen for selection changes to update B/I/U/L button states
    document.addEventListener('selectionchange', () => {
        if (activeNote && !isDrawingOnNote) {
            updateTextStyleButtonStates();
        }
    });

    // Main Tool Bar clicks
    toolbar?.addEventListener('click', handleToolClick);

    // Sticky Note Floating Toolbar clicks (uses event delegation for menu options)
    noteFloatingToolbar?.addEventListener('click', handleToolbarClicks);
    
    // Dropdown button clicks (to toggle menus)
    noteColorBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteColorMenu); });
    noteFontBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteFontMenu); });
    noteSizeBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(noteSizeMenu); });

    // Drawing options (for main toolbar)
    document.getElementById('stroke-width-slider')?.addEventListener('input', (e) => {
        currentStrokeWidth = parseFloat(e.target.value);
    });
    document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
        currentOpacity = parseFloat(e.target.value);
    });
    document.getElementById('stroke-color-input')?.addEventListener('input', (e) => {
        currentStrokeColor = e.target.value;
    });

    // Initial render and view set
    renderAllViews();
    switchView('matrix');
});