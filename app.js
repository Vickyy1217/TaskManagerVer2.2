document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    checkUpcomingDeadlines();
    populateCategoryFilter();
});

document.getElementById('task-form').addEventListener('submit', addTask);

document.querySelector('.bell-icon').addEventListener('click', () => {
    const notifications = document.getElementById('notifications');
    checkUpcomingDeadlines(); // Actualizar notificaciones al abrir
    notifications.classList.toggle('hidden');
});

const dueDateInput = document.getElementById('due-date');
dueDateInput.addEventListener('focus', () => {
    if ('showPicker' in HTMLInputElement.prototype) {
        dueDateInput.showPicker();
    } else {
        dueDateInput.type = 'date'; // Fallback para navegadores antiguos
    }
});

// Corregir el ID del botón (calendar-btn en lugar de calendar-icon)
document.getElementById('calendar-btn').addEventListener('click', () => {
    document.getElementById('calendar').classList.toggle('hidden');
});

// Corregir el ID del input (calendar-picker en lugar de calendar)
document.getElementById('calendar-picker').addEventListener('change', (e) => {
    showTasksForDate(e.target.value);
});

document.getElementById('filter-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('filter-container').classList.toggle('hidden');
});

document.getElementById('apply-filter').addEventListener('click', () => {
    filterTasks();
    document.getElementById('filter-container').classList.add('hidden');
});

document.getElementById('reset-filter').addEventListener('click', () => {
    document.getElementById('filter-priority').value = 'all';
    document.getElementById('filter-category').value = 'all';
    refreshTaskList();
    document.getElementById('filter-container').classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#filter-container') && !e.target.matches('#filter-btn')) {
        document.getElementById('filter-container').classList.add('hidden');
    }
});

function addTask(e) {
    e.preventDefault();

    const taskName = document.getElementById('task-name').value;
    const dueDate = document.getElementById('due-date').value;
    const project = document.getElementById('project').value;
    const priority = document.getElementById('priority').value;

    const id = Date.now(); // Identificador único
    const task = {
        id,
        taskName,
        dueDate,
        project,
        priority,
        completed: false,
        subtasks: []
    };

    storeTaskInLocalStorage(task);
    refreshTaskList();
    checkUpcomingDeadlines();
    document.getElementById('task-form').reset();
}

function showTasksForDate(selectedDate) {
    const tasks = getTasksFromLocalStorage().filter(task => task.dueDate === selectedDate);
    const taskDisplay = document.getElementById('calendar-tasks');
    taskDisplay.innerHTML = '';

    if (tasks.length === 0) {
        taskDisplay.innerHTML = '<p>No hay tareas programadas para esta fecha.</p>';
    } else {
        const ul = document.createElement('ul');
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.textContent = `${task.taskName} (${task.priority})`;
            ul.appendChild(li);
        });
        taskDisplay.appendChild(ul);
    }
}

// Agregar tarea al DOM
function addTaskToDOM(task) {
    if (task.completed) {
        return;
    }
    
    const taskRow = document.createElement('tr');
    taskRow.setAttribute('data-id', task.id);
    taskRow.classList.toggle('completed', task.completed);
    taskRow.classList.add(task.priority); // Aplica color de prioridad

    taskRow.innerHTML = `
        <td><input type="checkbox" class="complete-btn" ${task.completed ? 'checked' : ''}></td>
        <td>${task.taskName}</td>
        <td>${task.dueDate}</td>
        <td>${task.project}</td>
        <td>${task.priority}</td>
        <td>
            <button class="delete-btn">Eliminar</button>
            <button class="subtask-btn">Subtareas</button>
        </td>
    `;

    document.getElementById('task-list').appendChild(taskRow);
    addSubtasksToDOM(task);
}

// Delegación de eventos
const taskList = document.getElementById('task-list');
taskList.addEventListener('click', function (e) {
    const taskRow = e.target.closest('tr');
    const taskId = taskRow.getAttribute('data-id');

    if (e.target.classList.contains('delete-btn')) {
        // Eliminar la tarea y sus subtareas
        const subtaskContainer = document.querySelector(`.subtasks-container[data-task-id='${taskId}']`);
        if (subtaskContainer) {
            subtaskContainer.remove();
        }
        taskRow.remove();
        removeTaskFromLocalStorage(taskId);
    } else if (e.target.classList.contains('complete-btn')) {
        toggleTaskCompletion(taskId, taskRow);
    } else if (e.target.classList.contains('subtask-btn')) {
        toggleSubtaskView(taskId);
    }
});

// Alternar estado de tarea completada
function toggleTaskCompletion(taskId, taskRow) {
    let tasks = getTasksFromLocalStorage();
    tasks = tasks.map(task => {
        if (task.id === parseInt(taskId)) {
            task.completed = !task.completed;
            taskRow.classList.toggle('completed', task.completed);
            if (task.completed) {
                taskRow.style.backgroundColor = '#d3d3d3'; // Gris claro
            } else {
                taskRow.style.backgroundColor = ''; // Restaurar color original
            }
        }
        return task;
    });
    saveTasksToLocalStorage(tasks);
    refreshTaskList();
}

function addSubtasksToDOM(task) {
    const taskRow = document.querySelector(`[data-id='${task.id}']`);
    const subtaskContainer = document.createElement('tr');
    subtaskContainer.classList.add('subtasks-container');
    subtaskContainer.setAttribute('data-task-id', task.id);
    subtaskContainer.innerHTML = `
        <td colspan="6">
            <ul class="subtask-list"></ul>
            <form class="subtask-form">
                <input type="text" class="subtask-input" placeholder="New subtask" required>
                <button type="submit">Add</button>
            </form>
        </td>
    `;

    taskRow.after(subtaskContainer);

    const subtaskList = subtaskContainer.querySelector('.subtask-list');
    task.subtasks.forEach(subtask => {
        const li = document.createElement('li');
        li.innerHTML = `
            ${subtask.name} 
            <button class="delete-subtask" data-id="${subtask.id}" data-task-id="${task.id}">❌</button>
        `;
        subtaskList.appendChild(li);
    });

    // Manejar el evento de clic para eliminar subtareas
    subtaskList.addEventListener('click', function (e) {
        if (e.target.classList.contains('delete-subtask')) {
            const subtaskId = e.target.getAttribute('data-id');
            const taskId = e.target.getAttribute('data-task-id');
            removeSubtask(taskId, subtaskId);
        }
    });

    // Manejar el evento de agregar subtareas
    subtaskContainer.querySelector('.subtask-form').addEventListener('submit', function (e) {
        e.preventDefault();
        addSubtask(task.id, this.querySelector('.subtask-input').value);
        this.reset();
    });
}

// Alternar la vista de subtareas
function toggleSubtaskView(taskId) {
    const subtaskContainer = document.querySelector(`.subtasks-container[data-task-id='${taskId}']`);
    if (subtaskContainer) {
        subtaskContainer.classList.toggle('hidden');
    }
}

// Agregar subtarea
function addSubtask(taskId, subtaskName) {
    let tasks = getTasksFromLocalStorage();
    tasks = tasks.map(task => {
        if (task.id === parseInt(taskId)) {
            task.subtasks.push({ id: Date.now(), name: subtaskName });
        }
        return task;
    });
    saveTasksToLocalStorage(tasks);
    refreshTaskList();
}

function checkUpcomingDeadlines() {
    // Obtener la fecha y hora actual en la zona horaria de la Ciudad de México
    const now = new Date();
    const timeZone = 'America/Mexico_City'; // Zona horaria de la Ciudad de México

    // Convertir la fecha y hora actual a la zona horaria de la Ciudad de México
    const nowInMexico = new Date(now.toLocaleString('en-US', { timeZone }));

    // Calcular la fecha y hora en 24 horas en la zona horaria de la Ciudad de México
    const en24HorasMexico = new Date(nowInMexico.getTime() + 24 * 60 * 60 * 1000);

    let tasks = getTasksFromLocalStorage(); // Obtener las tareas almacenadas en el localStorage
    const notifications = document.getElementById('notifications'); // Contenedor de notificaciones
    notifications.innerHTML = ''; // Limpiar notificaciones anteriores

    tasks.forEach(task => {
        // Convertir la fecha de vencimiento de la tarea a la zona horaria de la Ciudad de México
        const taskDueDate = new Date(task.dueDate + 'T00:00:00'); // Asegurar que la hora sea 00:00:00
        const taskDueDateInMexico = new Date(taskDueDate.toLocaleString('en-US', { timeZone }));

        // console.log(`Tarea: ${task.taskName}, Fecha de vencimiento (Ciudad de México): ${taskDueDateInMexico}`);

        // Si la tarea vence en las próximas 24 horas (Ciudad de México) y no está completada
        if (taskDueDateInMexico > nowInMexico && taskDueDateInMexico <= en24HorasMexico && !task.completed) {
            const notification = document.createElement('div'); // Crear un elemento de notificación
            notification.classList.add('notification'); // Agregar clase de notificación
            notification.textContent = `Tarea próxima a vencer: ${task.taskName} - ${task.dueDate}`; // Texto de la notificación
            notifications.appendChild(notification); // Agregar la notificación al contenedor
        }
    });
}

// Cargar tareas ordenadas por fecha límite
function loadTasks() {
    refreshTaskList();
}

function refreshTaskList() {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    let tasks = getTasksFromLocalStorage();

    tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    tasks.forEach(task => addTaskToDOM(task));
}

function storeTaskInLocalStorage(task) {
    let tasks = getTasksFromLocalStorage();
    tasks.push(task);
    saveTasksToLocalStorage(tasks);
}

function removeTaskFromLocalStorage(taskId) {
    let tasks = getTasksFromLocalStorage();
    tasks = tasks.filter(task => task.id !== parseInt(taskId));
    saveTasksToLocalStorage(tasks);
}

function getTasksFromLocalStorage() {
    return JSON.parse(localStorage.getItem('tasks')) || [];
}

function saveTasksToLocalStorage(tasks) {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Función para eliminar subtarea
function removeSubtask(taskId, subtaskId) {
    let tasks = getTasksFromLocalStorage();
    tasks = tasks.map(task => {
        if (task.id === parseInt(taskId)) {
            // Filtrar las subtareas para eliminar la subtarea con el ID correspondiente
            task.subtasks = task.subtasks.filter(subtask => subtask.id !== parseInt(subtaskId));
        }
        return task;
    });
    saveTasksToLocalStorage(tasks);
    refreshTaskList(); // Recargar la lista de tareas y subtareas en la interfaz
}

// Nuevo evento para el botón de tareas completadas (agrega esto en el DOMContentLoaded)
document.getElementById('completed-tasks-btn').addEventListener('click', showCompletedTasks);

// Evento para el botón de volver
document.getElementById('back-to-main').addEventListener('click', () => {
    document.getElementById('completed-tasks-container').classList.add('hidden');
    document.querySelector('.container').classList.remove('hidden');
});

// Función para mostrar tareas completadas y estadísticas
function showCompletedTasks() {
    const container = document.getElementById('completed-tasks-container');
    const taskList = document.getElementById('completed-tasks-list');
    const statsContainer = document.getElementById('effectiveness-stats');
    
    // Ocultar la vista principal
    document.querySelector('.container').classList.add('hidden');
    container.classList.remove('hidden');

    // Obtener y filtrar tareas
    const allTasks = getTasksFromLocalStorage();
    const completedTasks = allTasks.filter(task => task.completed);
    
    // Mostrar estadísticas
    const completionRate = Math.round((completedTasks.length / allTasks.length) * 100) || 0;
    statsContainer.innerHTML = `
        <h3>📊 Efectividad</h3>
        <p>Tareas completadas: ${completedTasks.length}/${allTasks.length}</p>
        <p>Tasa de completado: ${completionRate}%</p>
    `;

    // Mostrar tareas completadas
    taskList.innerHTML = '';
    completedTasks.forEach(task => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'completed-task-item';
        taskDiv.innerHTML = `
            <span>${task.taskName}</span>
            <div>
                <small>${task.dueDate}</small>
                <span class="priority-tag ${task.priority}">${task.priority}</span>
            </div>
        `;
        taskList.appendChild(taskDiv);
    });
}

// Llenar categorías dinámicamente
function populateCategoryFilter() {
    const tasks = getTasksFromLocalStorage();
    const categories = [...new Set(tasks.map(task => task.project))];
    const filterCategory = document.getElementById('filter-category');
    
    categories.forEach(category => {
        if (category) { // Evitar valores vacíos
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterCategory.appendChild(option);
        }
    });
}

// Función de filtrado
function filterTasks() {
    const priority = document.getElementById('filter-priority').value;
    const category = document.getElementById('filter-category').value;
    
    let tasks = getTasksFromLocalStorage().filter(task => !task.completed);

    if (priority !== 'all') {
        tasks = tasks.filter(task => task.priority === priority);
    }
    
    if (category !== 'all') {
        tasks = tasks.filter(task => task.project === category);
    }

    refreshTaskList(tasks); // Modificaremos esta función
}

// Modificar refreshTaskList para aceptar filtros
function refreshTaskList(tasks = null) {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    
    const tasksToShow = tasks || getTasksFromLocalStorage();
    tasksToShow.forEach(task => addTaskToDOM(task));
}
