// Simple interactivity: Select task to highlight
const taskItems = document.querySelectorAll('.task-item');
taskItems.forEach(item => {
    item.addEventListener('click', () => {
        taskItems.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
    });
});
