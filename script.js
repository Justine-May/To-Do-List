// Simple interactivity: Select task to highlight
const taskItems = document.querySelectorAll('.task-item');
taskItems.forEach(item => {
    item.addEventListener('click', () => {
        taskItems.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
    });
});
<<<<<<< HEAD
=======

// 3. Function to add a new task
function addTask() {
    const taskText = taskInput.value.trim();

    // Check if input is empty
    if (taskText === '') {
        alert('Please enter a task!');
        return;
    }

    // Create new list item (li)
    const listItem = document.createElement('li');
    listItem.innerHTML = `
        <span>${taskText}</span>
        <button class="delete-btn">🗑️</button>
    `;

    // 4. Add functionality for 'Mark as Done' (toggle 'done' class)
    const taskSpan = listItem.querySelector('span');
    taskSpan.addEventListener('click', function() {
        listItem.classList.toggle('done');
    });

    // 5. Add functionality for 'Delete'
    const deleteButton = listItem.querySelector('.delete-btn');
    deleteButton.addEventListener('click', function() {
        todoList.removeChild(listItem);
    });

    // Append the new task to the list
    todoList.appendChild(listItem);

    // Clear the input field
    taskInput.value = '';
    taskInput.focus(); // Keep focus on input for quick additions
}
>>>>>>> parent of b5bc49b (adding a checkbox functionality)
