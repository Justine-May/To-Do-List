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

// Washi toolbar (optional — script is defensive if toolbar is not present)
const washiToolbar = document.getElementById('washi-toolbar'); // existing (static) toolbar if any
const washiPatternButtons = document.querySelectorAll('.pattern-option'); // existing buttons (if HTML had them)

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

// Washi-specific state
let isWashiDrawing = false;
let washiStartX = 0, washiStartY = 0;
let currentWashiPattern = (washiPatternButtons[0]?.dataset.pattern) || 'diagonal';

// Floating washi toolbar DOM (dynamically created)
let floatingWashiToolbar = null;

// Drawing state (Note Canvas)
let isDrawingOnNote = false;
let currentNoteCtx = null;
let activeNote = null; // Currently selected sticky note DOM element
const USERNAME = '@User';

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
    hideFloatingWashiToolbar();
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
function startNoteDraw(e) {
    if (!isDrawingOnNote || !currentNoteCtx) return;
    noteDrawing = true;
    currentNoteCtx.beginPath();
    currentNoteCtx.moveTo(e.offsetX, e.offsetY);
    e.stopPropagation();
}

function drawOnNote(e) {
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

    currentNoteCtx.lineTo(e.offsetX, e.offsetY);
    currentNoteCtx.stroke();
    e.stopPropagation();
}

function endNoteDraw() {
    if (noteDrawing) {
        noteDrawing = false;
        currentNoteCtx.closePath();
        currentNoteCtx.globalCompositeOperation = 'source-over';
    }
}

// --- Mouse/Drag Handlers (Combined) ---
let isResizing = false;
let activeHandle = null;
let initialNoteWidth, initialNoteHeight, initialMouseX, initialMouseY, initialNoteX, initialNoteY;

function startDragOrResize(e) {
    if (e.button !== 0 || !corkboard) return;

    if (!e.target.closest('#note-floating-toolbar')) {
        document.querySelectorAll('.note-dropdown-menu').forEach(m => m.classList.remove('visible'));
    }

    const clickedNote = e.target.closest('.sticky-note');

    // Resizing check
    if (e.target.classList.contains('resize-handle')) {
        isResizing = true;
        activeHandle = e.target;
        activeNote = clickedNote;

        initialNoteWidth = activeNote.offsetWidth;
        initialNoteHeight = activeNote.offsetHeight;
        initialNoteX = parseInt(activeNote.style.left) || 0;
        initialNoteY = parseInt(activeNote.style.top) || 0;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;

        document.querySelectorAll('.sticky-note').forEach(n => n.style.zIndex = '50');
        activeNote.style.zIndex = '100';
        noteFloatingToolbar?.classList.add('hidden');

        e.preventDefault();
        return;
    }

    // Note Drawing start check
    if (isDrawingOnNote && clickedNote === activeNote && e.target.classList.contains('note-canvas')) {
        startNoteDraw(e);
        return;
    }

    // Dragging check
    if (clickedNote && currentTool === 'select' && !isDrawingOnNote) {
        const contentArea = clickedNote.querySelector('.sticky-note-content');
        if (contentArea.contains(e.target)) {
            if (document.activeElement === contentArea) {
                return;
            }
        }

        activeDraggable = clickedNote;
        isMoving = true;
        lastX = e.clientX;
        lastY = e.clientY;

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
        const rect = canvas.getBoundingClientRect();
        washiStartX = e.clientX - rect.left + canvas.scrollLeft;
        washiStartY = e.clientY - rect.top + canvas.scrollTop;

        // Show floating washi toolbar anchored to start
        showFloatingWashiToolbar(washiStartX, washiStartY);

        e.preventDefault();
        return;
    }

    // Main Canvas Drawing: other continuous tools (marker/highlighter/eraser)
    if (currentTool !== 'select' && currentTool !== 'washi-tape' && !isDrawingOnNote && e.target === canvas) {
        drawing = true;
        const newStroke = {
            tool: currentTool,
            color: currentStrokeColor,
            width: currentStrokeWidth,
            opacity: currentTool === 'highlight' ? 0.3 : currentOpacity,
            points: [{ x: e.offsetX, y: e.offsetY }]
        };
        strokes.push(newStroke);

        ctx.strokeStyle = newStroke.color;
        ctx.lineWidth = newStroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (currentTool === 'highlight') {
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = newStroke.opacity;
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = newStroke.opacity;
        }

        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
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

function dragOrResize(e) {
    if (!corkboard) return;

    // Resizing Logic
    if (isResizing && activeNote) {
        e.preventDefault();
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

    // Dragging Logic
    if (isMoving && activeDraggable) {
        e.preventDefault();
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        let newLeft = activeDraggable.offsetLeft + dx;
        let newTop = activeDraggable.offsetTop + dy;

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

    // Main Canvas Drawing Logic (continuous)
    if (drawing && e.target === canvas) {
        e.preventDefault();
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

        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();

        const newPoint = { x: e.offsetX, y: e.offsetY };
        currentStroke.points.push(newPoint);

        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);

        return;
    }

    // Note Drawing Logic
    if (noteDrawing && activeNote) {
        e.preventDefault();
        drawOnNote(e);
    }
}

function endDragOrResize(e) {
    if (!corkboard) return;

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

    // Dragging End
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

        if (activeNote) {
            updateNoteToolbarState();
            noteFloatingToolbar?.classList.remove('hidden');
        }
    }

    // Main Canvas Drawing End (continuous tools)
    if (drawing) {
        drawing = false;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        redrawAllStrokes();
    }

    // Washi Tape end (straight-line)
    if (isWashiDrawing && e.target === canvas) {
        isWashiDrawing = false;
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left + canvas.scrollLeft;
        const endY = e.clientY - rect.top + canvas.scrollTop;

        // Create washi stroke object
        const washiStroke = {
            tool: 'washi-tape',
            color: currentStrokeColor,
            width: currentStrokeWidth,
            opacity: currentOpacity,
            pattern: currentWashiPattern,
            start: { x: washiStartX, y: washiStartY },
            end: { x: endX, y: endY }
        };

        strokes.push(washiStroke);
        redrawAllStrokes();

        // Keep floating toolbar visible (anchored to start) while tool stays active.
        // If you'd prefer the toolbar to hide after placing a tape, uncomment hideFloatingWashiToolbar();
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

    // Show/hide washi toolbar (static) and our dynamic floating toolbar
    if (tool === 'washi-tape') {
        // Show static toolbar if present
        if (washiToolbar) washiToolbar.classList.remove('hidden');

        // If we know the last start point, show the floating toolbar anchored there.
        const rect = canvas?.getBoundingClientRect();
        if (rect) {
            // If a previous start exists, use it; otherwise position near center for immediate visibility
            const sx = washiStartX || Math.floor(canvas.width / 2);
            const sy = washiStartY || Math.floor(canvas.height / 4);
            showFloatingWashiToolbar(sx, sy);
        }
    } else {
        if (washiToolbar) washiToolbar.classList.add('hidden');
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
 * Creates a small pattern-canvas for the washi pattern and returns it (not a CanvasPattern).
 * This function is used for:
 *  - building the pattern for the main offscreen drawing (makePatternForWashi will call createPatternSafe on this)
 *  - creating a swatch preview without depending on main ctx
 */
function makePatternCanvas(patternName) {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const pctx = patternCanvas.getContext('2d');

    // subtle paper base (off-white)
    pctx.fillStyle = '#fbfaf6';
    pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

    if (patternName === 'diagonal') {
        pctx.strokeStyle = '#b7b0ac';
        pctx.lineWidth = 2;
        pctx.beginPath();
        pctx.moveTo(0, patternCanvas.height);
        pctx.lineTo(patternCanvas.width, 0);
        pctx.stroke();
    } else if (patternName === 'dots') {
        pctx.fillStyle = '#b7b0ac';
        for (let y = 5; y < patternCanvas.height; y += 10) {
            for (let x = 5; x < patternCanvas.width; x += 10) {
                pctx.beginPath();
                pctx.arc(x, y, 1.5, 0, Math.PI * 2);
                pctx.fill();
            }
        }
    } else if (patternName === 'grid') {
        pctx.strokeStyle = '#d0cfcf';
        pctx.lineWidth = 1;
        for (let i = 0; i < patternCanvas.width; i += 5) {
            pctx.beginPath();
            pctx.moveTo(i, 0);
            pctx.lineTo(i, patternCanvas.height);
            pctx.moveTo(0, i);
            pctx.lineTo(patternCanvas.width, i);
            pctx.stroke();
        }
    } else { // plain: we keep the subtle paper base
        // nothing extra
    }

    return patternCanvas;
}

function makePatternForWashi(patternName) {
    const patternCanvas = makePatternCanvas(patternName);
    return createPatternSafe(patternCanvas);
}

/**
 * Create a ripped/torn mask on an offscreen context near the edges.
 * We'll 'cut' into the tape to produce transparent jagged edges using destination-out.
 *
 * offCtx: offscreen ctx
 * length: length of jagged cut (in px)
 * cornerX, cornerY: coordinates in offscreen canvas where the torn cut should be drawn
 * angle: angle in radians of the tape direction (so torn aligns)
 */
function cutRippedEdge(offCtx, cornerX, cornerY, angle, maxLength) {
    offCtx.save();
    offCtx.translate(cornerX, cornerY);
    offCtx.rotate(angle);

    // draw several overlapping small semicircles / jagged shapes and use destination-out to subtract
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

    // add a feathered semi-transparent removal to soften
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
 * Draws a washi tape segment with pattern + base color overlay + ripped ends.
 * Implementation uses an offscreen canvas where we draw rotated horizontal tape and then blit to main ctx.
 */
function drawWashiOnMain(stroke) {
    if (!ctx || !canvas) return;

    // Calculate vector
    const sx = stroke.start.x, sy = stroke.start.y;
    const ex = stroke.end.x, ey = stroke.end.y;
    const dx = ex - sx, dy = ey - sy;
    const length = Math.sqrt(dx*dx + dy*dy);
    if (length < 2) return;

    const angle = Math.atan2(dy, dx);

    const padding = Math.ceil(stroke.width * 2); // padding around tape for torn edges
    const offW = Math.ceil(length + padding * 2);
    const offH = Math.ceil(stroke.width + padding * 2);

    // Offscreen canvas
    const off = document.createElement('canvas');
    off.width = offW;
    off.height = offH;
    const offCtx = off.getContext('2d');

    // Move origin to padding, mid-line
    offCtx.translate(padding, offH / 2);

    // create pattern (CanvasPattern) using main-safe helper
    const patternCanvas = makePatternCanvas(stroke.pattern || 'diagonal');
    const pattern = offCtx.createPattern(patternCanvas, 'repeat');

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

    // 2) subtle translucent base overlay to give paper look
    offCtx.save();
    offCtx.globalAlpha = 0.12;
    offCtx.strokeStyle = stroke.color || '#000';
    offCtx.lineWidth = stroke.width;
    offCtx.beginPath();
    offCtx.moveTo(0, 0);
    offCtx.lineTo(length, 0);
    offCtx.stroke();
    offCtx.restore();

    // 3) create ripped edges by cutting (destination-out) small jagged shapes at start & end
    const tearLen = Math.min(28, Math.max(12, stroke.width * 1.6));
    // cut at start (angle reversed because in offscreen space horizontal line goes +x)
    cutRippedEdge(offCtx, 0, 0, Math.PI, tearLen);
    // cut at end
    cutRippedEdge(offCtx, length, 0, 0, tearLen);

    // 4) apply a subtle shadow along bottom to lift the tape
    offCtx.save();
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.fillStyle = 'rgba(0,0,0,0.06)';
    offCtx.beginPath();
    // small rectangle under tape area
    offCtx.rect(0, stroke.width / 2 + 2, length, 2);
    offCtx.fill();
    offCtx.restore();

    // 5) Draw the offscreen canvas onto main canvas with rotation and positioning
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

    // Draw non-washi strokes first (so washi can overlap them if needed)
    strokes.forEach(stroke => {
        if (stroke.tool === 'washi-tape') return; // skip here
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
            // single point
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

    // Then draw washi strokes (so they appear on top)
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
// Minimalist, light theme, rounded corners, soft shadow.
// Anchored to canvas coordinates (washi start point). Appended to corkboard.

const WASHI_PATTERNS = [
    { key: 'diagonal', label: 'Diagonal' },
    { key: 'dots', label: 'Dots' },
    { key: 'grid', label: 'Grid' },
    { key: 'plain', label: 'Plain' }
];

function createFloatingWashiToolbar() {
    if (!corkboard) return null;
    if (floatingWashiToolbar) return floatingWashiToolbar;

    const toolbarEl = document.createElement('div');
    toolbarEl.id = 'floating-washi-toolbar';
    // basic inline minimalist styles (you can move to CSS file if desired)
    Object.assign(toolbarEl.style, {
        position: 'absolute',
        display: 'flex',
        gap: '8px',
        padding: '8px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.98)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        zIndex: 9999,
        alignItems: 'center',
        transition: 'opacity 0.12s ease, transform 0.12s ease',
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        userSelect: 'none',
    });

    // label
    const label = document.createElement('div');
    label.textContent = 'Pattern';
    Object.assign(label.style, {
        color: '#333',
        fontWeight: 600,
        marginRight: '6px',
        opacity: 0.9
    });
    toolbarEl.appendChild(label);

    // create pattern buttons with tiny canvas preview icons
    WASHI_PATTERNS.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'floating-washi-btn';
        btn.dataset.pattern = p.key;
        Object.assign(btn.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '6px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            minWidth: '54px'
        });

        // create small swatch canvas
        const sw = document.createElement('canvas');
        const swSize = 40;
        sw.width = swSize;
        sw.height = swSize;
        sw.style.width = swSize + 'px';
        sw.style.height = swSize + 'px';
        sw.style.borderRadius = '6px';
        sw.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8)';
        drawPatternSwatchToCanvas(p.key, sw, '#000', 0.12); // draws subtle swatch

        const txt = document.createElement('div');
        txt.textContent = p.label;
        Object.assign(txt.style, {
            color: '#444',
            fontSize: '11px',
            lineHeight: '12px'
        });

        btn.appendChild(sw);
        btn.appendChild(txt);

        // click handler to select pattern
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            setCurrentWashiPattern(p.key);
            // visual state
            toolbarEl.querySelectorAll('.floating-washi-btn').forEach(b => {
                b.style.background = 'transparent';
                b.style.boxShadow = 'none';
            });
            btn.style.background = '#6a40e1';
            btn.style.color = 'white';
            btn.style.boxShadow = '0 4px 10px rgba(106,64,225,0.12)';
        });

        toolbarEl.appendChild(btn);
    });

    // add a small close button on the right
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&#10005;'; // x
    Object.assign(closeBtn.style, {
        marginLeft: '6px',
        padding: '6px 8px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: '#777',
        fontSize: '12px'
    });
    closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        hideFloatingWashiToolbar();
        // also switch tool back to select for convenience
        document.querySelector('.tool-btn[data-tool="select"]')?.click();
    });
    toolbarEl.appendChild(closeBtn);

    corkboard.appendChild(toolbarEl);
    floatingWashiToolbar = toolbarEl;

    // keep toolbar hidden initially
    toolbarEl.style.opacity = '0';
    toolbarEl.style.pointerEvents = 'auto';
    return toolbarEl;
}

/**
 * Draws a pattern swatch to the provided canvas element.
 * color & alpha for overlay are optional; swatch is subtle.
 */
function drawPatternSwatchToCanvas(patternName, swCanvas, overlayColor = '#000', overlayAlpha = 0.12) {
    const pctx = swCanvas.getContext('2d');
    const w = swCanvas.width;
    const h = swCanvas.height;
    // base
    pctx.clearRect(0,0,w,h);
    pctx.fillStyle = '#fbfaf6';
    pctx.fillRect(0,0,w,h);

    // pattern scaled to swatch
    if (patternName === 'diagonal') {
        pctx.strokeStyle = '#b7b0ac';
        pctx.lineWidth = 3;
        pctx.beginPath();
        pctx.moveTo(0, h);
        pctx.lineTo(w, 0);
        pctx.stroke();
    } else if (patternName === 'dots') {
        pctx.fillStyle = '#b7b0ac';
        const gap = 12;
        for (let y = gap/2; y < h; y += gap) {
            for (let x = gap/2; x < w; x += gap) {
                pctx.beginPath();
                pctx.arc(x, y, 2, 0, Math.PI*2);
                pctx.fill();
            }
        }
    } else if (patternName === 'grid') {
        pctx.strokeStyle = '#d0cfcf';
        pctx.lineWidth = 1.5;
        for (let i = 0; i < w; i += 6) {
            pctx.beginPath();
            pctx.moveTo(i, 0);
            pctx.lineTo(i, h);
            pctx.stroke();
        }
        for (let j = 0; j < h; j += 6) {
            pctx.beginPath();
            pctx.moveTo(0, j);
            pctx.lineTo(w, j);
            pctx.stroke();
        }
    } else {
        // plain: base already drawn
    }

    // translucent overlay to show color/opacity effect
    pctx.globalAlpha = overlayAlpha;
    pctx.fillStyle = overlayColor;
    pctx.fillRect(0,0,w,h);
    pctx.globalAlpha = 1.0;

    // subtle rounded mask stroke for nicer preview
    pctx.strokeStyle = 'rgba(0,0,0,0.04)';
    pctx.lineWidth = 1;
    roundRectStroke(pctx, 0.5, 0.5, w-1, h-1, 6);
}

/** small helper to stroke rounded rect */
function roundRectStroke(pctx, x, y, w, h, r) {
    pctx.beginPath();
    pctx.moveTo(x + r, y);
    pctx.arcTo(x + w, y, x + w, y + h, r);
    pctx.arcTo(x + w, y + h, x, y + h, r);
    pctx.arcTo(x, y + h, x, y, r);
    pctx.arcTo(x, y, x + w, y, r);
    pctx.closePath();
    pctx.stroke();
}

/**
 * Position and show the floating washi toolbar anchored to canvas coords (sx, sy).
 * sx/sy are in canvas coordinate space (pixels).
 */
function showFloatingWashiToolbar(sx, sy) {
    if (!corkboard) return;
    const toolbarEl = createFloatingWashiToolbar();
    if (!toolbarEl) return;

    // Wait a tick to ensure sizes measured correctly
    requestAnimationFrame(() => {
        // sewing: canvas coordinates are relative to canvas/corkboard content; corkboard is positioned relative
        // clamp inside corkboard
        const tbRect = toolbarEl.getBoundingClientRect();
        const corkW = corkboard.scrollWidth;
        const corkH = corkboard.scrollHeight;

        // compute left/top so toolbar sits above the start point
        let left = Math.round(sx - (tbRect.width / 2));
        let top = Math.round(sy - tbRect.height - 12); // 12px gap above the start point

        // clamp edges
        left = Math.max(6, left);
        top = Math.max(6, top);
        left = Math.min(left, corkW - tbRect.width - 6);
        top = Math.min(top, corkH - tbRect.height - 6);

        toolbarEl.style.left = left + 'px';
        toolbarEl.style.top = top + 'px';
        toolbarEl.style.opacity = '1';
        toolbarEl.style.transform = 'translateY(0)';
    });

    // mark currently active pattern visually
    toolbarEl.querySelectorAll('.floating-washi-btn').forEach(b => {
        if (b.dataset.pattern === currentWashiPattern) {
            b.style.background = '#6a40e1';
            b.style.color = 'white';
            b.style.boxShadow = '0 4px 10px rgba(106,64,225,0.12)';
        } else {
            b.style.background = 'transparent';
            b.style.color = '';
            b.style.boxShadow = 'none';
        }
    });
}

function hideFloatingWashiToolbar() {
    if (!floatingWashiToolbar) return;
    floatingWashiToolbar.style.opacity = '0';
    // keep in DOM but hide visually to preserve position next time
    // optionally we could remove it: corkboard.removeChild(floatingWashiToolbar); floatingWashiToolbar = null;
}

/** External setter to change pattern programatically and sync to any existing static controls */
function setCurrentWashiPattern(patternKey) {
    currentWashiPattern = patternKey;
    // sync static buttons if any
    washiPatternButtons.forEach(b => {
        if (b.dataset.pattern === patternKey) b.classList.add('active');
        else b.classList.remove('active');
    });
}

// --- Sticky Wall Initialization ---
function initializeStickyWall() {
    if (!canvas || !corkboard) return;

    function fitCanvasToBoard() {
        // size canvas to corkboard's scrollable area (keeps drawing consistent)
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

    document.querySelectorAll('.sidebar .task-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if (view) switchView(view);
        });
    });

    document.addEventListener('mousedown', startDragOrResize);
    document.addEventListener('mousemove', dragOrResize);
    document.addEventListener('mouseup', endDragOrResize);
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
    });
    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
        strokes = [];
        redrawAllStrokes();
    });

    // Washi pattern controls (if present)
    washiPatternButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            washiPatternButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentWashiPattern = btn.dataset.pattern;
            // sync floating toolbar if visible
            if (floatingWashiToolbar) {
                floatingWashiToolbar.querySelectorAll('.floating-washi-btn').forEach(b => {
                    if (b.dataset.pattern === currentWashiPattern) {
                        b.style.background = '#6a40e1';
                        b.style.color = 'white';
                        b.style.boxShadow = '0 4px 10px rgba(106,64,225,0.12)';
                    } else {
                        b.style.background = 'transparent';
                        b.style.color = '';
                        b.style.boxShadow = 'none';
                    }
                });
            }
        });
    });

    // create floating toolbar early (but hidden) so it's ready when user picks washi tool
    createFloatingWashiToolbar();

    renderAllViews();
    switchView('matrix');
});
