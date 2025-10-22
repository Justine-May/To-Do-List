document.addEventListener('DOMContentLoaded', () => {
    // --- Global Selectors ---
    const modal = document.getElementById('task-details-modal');
    const closeButton = document.querySelector('.close-button');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const quadrants = document.querySelectorAll('.quadrant');
    let draggedTask = null; // Variable to hold the task being dragged

    // --- Drag and Drop Handlers ---

    // 1. Setup listeners on all task items (including dynamically added ones)
    function setupDragAndDropListeners(taskElement) {
        taskElement.addEventListener('dragstart', handleDragStart);
        taskElement.addEventListener('dragend', handleDragEnd);
    }
    
    function handleDragStart(e) {
        draggedTask = this;
        // Set a slight delay to allow the opacity change to apply visually
        setTimeout(() => this.classList.add('is-dragging'), 0); 
        
        // Transfer the data (task ID) to the drop event
        e.dataTransfer.setData('text/plain', this.getAttribute('data-task-id'));
    }

    function handleDragEnd() {
        this.classList.remove('is-dragging');
        draggedTask = null;
    }

    // 2. Setup listeners on all quadrants (the drop targets)
    quadrants.forEach(quadrant => {
        const taskList = quadrant.querySelector('.task-list');

        // Allow dropping here (necessary to fire drop event)
        quadrant.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            quadrant.classList.add('drag-over');
        });

        // Clean up visual state when dragging leaves the quadrant
        quadrant.addEventListener('dragleave', () => {
            quadrant.classList.remove('drag-over');
        });
        
        // Handle the actual drop
        quadrant.addEventListener('drop', (e) => {
            e.preventDefault();
            quadrant.classList.remove('drag-over');

            if (draggedTask) {
                // Find the existing "Add new page" button to insert before it
                const addTaskButton = taskList.querySelector('.add-task');
                
                // Move the element
                if (addTaskButton) {
                    taskList.insertBefore(draggedTask, addTaskButton);
                } else {
                    // If somehow the button is missing, append to the end
                    taskList.appendChild(draggedTask);
                }
                
                // Optional: Update data based on new quadrant (e.g., urgency/importance flags)
                // console.log(`Task ${draggedTask.getAttribute('data-task-id')} moved to ${quadrant.getAttribute('data-quadrant')}`);
            }
        });
    });

    // --- Task Details Modal Logic (Simplified for brevity, keeping only essential parts) ---

    // Function to open the modal and populate data
    function openTaskDetails(taskElement) {
        // ... (existing logic to populate modal) ...
        const taskTitle = taskElement.textContent.trim().split('\n')[0].replace('✓', '').trim();
        const taskId = taskElement.getAttribute('data-task-id');
        const dueDate = taskElement.getAttribute('data-date'); 

        document.getElementById('current-task-id').value = taskId;
        document.getElementById('task-title').value = taskTitle;
        // ... (more detail logic omitted) ...
        modal.style.display = 'block';
    }

    function closeTaskDetails() {
        modal.style.display = 'none';
    }

    // Set up listeners for initial and future tasks
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

        // Checkbox toggle listener
        const checkbox = taskElement.querySelector('input[type="checkbox"]');
        if (checkbox) {
             checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    taskElement.style.textDecoration = 'line-through';
                    taskElement.style.opacity = '0.6';
                } else {
                    taskElement.style.textDecoration = 'none';
                    taskElement.style.opacity = '1';
                }
            });
        }
    }


    // 1. Setup existing tasks
    document.querySelectorAll('.task-item').forEach(task => {
        setupTaskListeners(task);
        setupDragAndDropListeners(task); // Attach drag listeners to existing tasks
    });


    // 2. Add New Task Functionality (Updated to include drag and drop setup)
    const addButtons = document.querySelectorAll('.add-task');
    let taskIdCounter = 5; 

    addButtons.forEach(button => {
        button.addEventListener('click', () => {
            const list = button.closest('.task-list');
            const taskText = prompt("Enter the new task description:");
            
            if (taskText) {
                const newTask = document.createElement('li');
                newTask.className = 'task-item';
                newTask.setAttribute('data-task-id', taskIdCounter++);
                newTask.setAttribute('data-date', 'Today'); 
                newTask.setAttribute('draggable', 'true'); // IMPORTANT for new tasks!

                const today = new Date();
                const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                newTask.innerHTML = `
                    <i class="fas fa-check"></i> ${taskText}
                    <span class="task-date">${dateString}</span>
                    <input type="checkbox">
                `;
                
                list.insertBefore(newTask, button);
                
                // Set up ALL listeners for the new task
                setupTaskListeners(newTask);
                setupDragAndDropListeners(newTask); 
            }
        });
    });

    // 3. Modal closing/action listeners
    closeButton.addEventListener('click', closeTaskDetails);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeTaskDetails();
        }
    });
    document.getElementById('task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Changes saved (Simulated Save)');
        closeTaskDetails();
    });
    deleteTaskBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this task?')) {
            alert('Task deleted. (Simulated Delete)');
            closeTaskDetails();
        }
    });

    // --- Sidebar Toggle ---
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed'); 
        });
    }
});