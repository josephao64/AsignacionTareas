// checklist.js
import { db } from '../firebase-config.js';
import { 
    collection, addDoc, getDocs, onSnapshot, updateDoc, deleteDoc, doc, query, where 
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    // **Variables y Elementos del DOM**
    const checklistModal = document.getElementById('checklistModal');
    const openChecklistModalBtn = document.getElementById('openChecklistModal');
    const closeChecklistModalBtn = document.getElementById('closeChecklistModal');
    const checklistForm = document.getElementById('checklistForm');
    const checklistTareasDiv = document.getElementById('checklistTareas');
    const checklistResponsablesSelect = document.getElementById('checklistResponsables');
    const checklistTableBody = document.getElementById('checklistTable').querySelector('tbody');

    const viewChecklistModal = document.getElementById('viewChecklistModal');
    const closeViewChecklistModalBtn = document.getElementById('closeViewChecklistModal');
    const viewChecklistTitulo = document.getElementById('viewChecklistTitulo');
    const viewChecklistFecha = document.getElementById('viewChecklistFecha');
    const viewChecklistResponsables = document.getElementById('viewChecklistResponsables');
    const viewChecklistForm = document.getElementById('viewChecklistForm');
    const viewChecklistTareasList = document.getElementById('viewChecklistTareas');
    const viewProgressBar = document.getElementById('viewProgressBar');
    const viewProgressText = document.getElementById('viewProgressText');

    let checklists = [];
    let tareasDisponibles = [];
    let responsables = [];

    let isEditMode = false;
    let currentEditChecklistId = null;

    // **Funciones para Manejar el Modal de Crear/Editar Checklist**
    openChecklistModalBtn.addEventListener('click', function() {
        isEditMode = false;
        currentEditChecklistId = null;
        checklistForm.reset();
        checklistResponsablesSelect.selectedIndex = -1;
        checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
        cargarResponsables();
        document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
        checklistModal.style.display = 'block';
    });

    closeChecklistModalBtn.addEventListener('click', function() {
        checklistModal.style.display = 'none';
        checklistForm.reset();
        // Reiniciar los selects y checkboxes
        checklistResponsablesSelect.selectedIndex = -1;
        checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
        isEditMode = false;
        currentEditChecklistId = null;
        document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
    });

    closeViewChecklistModalBtn.addEventListener('click', function() {
        viewChecklistModal.style.display = 'none';
    });

    // Cerrar los modales al hacer clic fuera de ellos
    window.addEventListener('click', function(event) {
        if (event.target == checklistModal) {
            checklistModal.style.display = 'none';
            checklistForm.reset();
            checklistResponsablesSelect.selectedIndex = -1;
            checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
            isEditMode = false;
            currentEditChecklistId = null;
            document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
        }
        if (event.target == viewChecklistModal) {
            viewChecklistModal.style.display = 'none';
        }
    });

    // **Cargar Responsables Existentes**
    async function cargarResponsables() {
        try {
            const tareasRef = collection(db, "tareas");
            const snapshot = await getDocs(tareasRef);
            const responsablesSet = new Set();

            snapshot.forEach(docu => {
                const tarea = docu.data();
                if (Array.isArray(tarea.responsable)) {
                    tarea.responsable.forEach(responsable => responsablesSet.add(responsable));
                }
            });

            responsables = Array.from(responsablesSet);

            // Llenar el select de responsables
            checklistResponsablesSelect.innerHTML = ''; // Limpiar opciones
            responsables.forEach(responsable => {
                const option = document.createElement('option');
                option.value = responsable;
                option.textContent = responsable;
                checklistResponsablesSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error al cargar responsables:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar los responsables.',
            });
        }
    }

    cargarResponsables();

    // **Cargar Tareas Disponibles Filtradas por Responsables Seleccionados**
    async function cargarTareasDisponibles(responsablesSeleccionados) {
        try {
            const tareasRef = collection(db, "tareas");
            // Crear una consulta donde 'responsable' contiene cualquiera de los seleccionados
            const q = query(tareasRef, where("responsable", "array-contains-any", responsablesSeleccionados));
            const snapshot = await getDocs(q);
            tareasDisponibles = [];
            snapshot.forEach(docu => {
                const tarea = docu.data();
                tarea.id = docu.id;
                // Solo incluir tareas que no están completadas ni en revisión
                if (tarea.estado !== "Revisión" && tarea.estado !== "Completado") {
                    tareasDisponibles.push(tarea);
                }
            });

            // Llenar el div de tareas con checkboxes
            checklistTareasDiv.innerHTML = ''; // Limpiar contenido

            if (tareasDisponibles.length === 0) {
                checklistTareasDiv.innerHTML = '<p class="info-message">No hay tareas disponibles para los responsables seleccionados</p>';
                return;
            }

            tareasDisponibles.forEach(tarea => {
                const label = document.createElement('label');
                label.style.display = 'block';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = tarea.id;
                checkbox.name = 'tareas';
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${tarea.tipo}: ${tarea.descripcion}`));
                checklistTareasDiv.appendChild(label);
            });
        } catch (error) {
            console.error("Error al cargar tareas disponibles:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar las tareas disponibles.',
            });
        }
    }

    // **Manejar Cambio de Responsables en el Formulario de Checklist**
    checklistResponsablesSelect.addEventListener('change', function() {
        const selectedOptions = Array.from(this.selectedOptions).map(option => option.value);
        if (selectedOptions.length > 0) {
            cargarTareasDisponibles(selectedOptions);
            escucharCambiosTareas(selectedOptions);
        } else {
            checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
        }
    });

    // **Manejar el Envío del Formulario de Checklist**
    checklistForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const titulo = document.getElementById('checklistTitulo').value.trim();
        const fecha = document.getElementById('checklistFecha').value;
        const responsablesSeleccionados = Array.from(checklistResponsablesSelect.selectedOptions).map(option => option.value);
        const tareasSeleccionadas = Array.from(document.querySelectorAll('input[name="tareas"]:checked')).map(checkbox => checkbox.value);

        // Validaciones
        if (!titulo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El título del checklist no puede estar vacío.',
            });
            return;
        }

        if (!fecha) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona una fecha.',
            });
            return;
        }

        if (responsablesSeleccionados.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos un responsable.',
            });
            return;
        }

        if (tareasSeleccionadas.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos una tarea.',
            });
            return;
        }

        // Crear el objeto del checklist
        const checklistData = {
            titulo,
            fecha,
            responsables: responsablesSeleccionados,
            tareas: tareasSeleccionadas.map(tareaId => ({ id: tareaId, completado: false }))
        };

        if (isEditMode && currentEditChecklistId) {
            // Modo Edición: Actualizar el checklist existente
            try {
                const checklistRef = doc(db, "checklists", currentEditChecklistId);
                const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", currentEditChecklistId))).then(snapshot => {
                    let found = null;
                    snapshot.forEach(docu => {
                        if (docu.id === currentEditChecklistId) {
                            found = docu.data();
                            found.id = docu.id;
                        }
                    });
                    return found;
                });

                if (!checklistSnap) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Checklist no encontrado.',
                    });
                    return;
                }

                const tareasActuales = checklistSnap.tareas.map(t => t.id);
                const tareasNuevas = tareasSeleccionadas;
                const tareasAgregadas = tareasNuevas.filter(t => !tareasActuales.includes(t));
                const tareasEliminadas = tareasActuales.filter(t => !tareasNuevas.includes(t));

                // Actualizar el checklist en Firestore
                await updateDoc(checklistRef, {
                    titulo: checklistData.titulo,
                    fecha: checklistData.fecha,
                    responsables: checklistData.responsables,
                    tareas: checklistData.tareas
                });

                // Actualizar el estado de las tareas agregadas
                for (const tareaId of tareasAgregadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "En Progreso" });
                }

                // Opcional: Si deseas revertir el estado de las tareas eliminadas
                for (const tareaId of tareasEliminadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "Pendiente" }); // O el estado que corresponda
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido actualizado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
                isEditMode = false;
                currentEditChecklistId = null;
                document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
            } catch (error) {
                console.error("Error al actualizar checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al actualizar el checklist.',
                });
            }
        } else {
            // Modo Creación: Crear un nuevo checklist
            try {
                await addDoc(collection(db, "checklists"), checklistData);
                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido creado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
            } catch (error) {
                console.error("Error al crear checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al crear el checklist.',
                });
            }
        }
    });

    // **Cargar Checklists Existentes**
    function cargarChecklists() {
        const checklistsRef = collection(db, "checklists");
        onSnapshot(checklistsRef, (snapshot) => {
            checklists = [];
            snapshot.forEach(docu => {
                const checklist = docu.data();
                checklist.id = docu.id;
                checklists.push(checklist);
            });
            actualizarTablaChecklists();
        }, (error) => {
            console.error("Error al cargar checklists:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar los checklists.',
            });
        });
    }

    cargarChecklists();

    // **Actualizar la Tabla de Checklists**
    function actualizarTablaChecklists() {
        checklistTableBody.innerHTML = '';

        if (checklists.length === 0) {
            const fila = document.createElement('tr');
            fila.innerHTML = `<td colspan="5" class="info-message">No hay checklists disponibles. Crea uno nuevo.</td>`;
            checklistTableBody.appendChild(fila);
            return;
        }

        checklists.forEach(checklist => {
            // Calcular el progreso
            const totalTareas = checklist.tareas.length;
            const tareasCompletadas = checklist.tareas.filter(t => t.completado).length;
            const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

            const fila = document.createElement('tr');

            fila.innerHTML = `
                <td>${checklist.titulo}</td>
                <td>${checklist.fecha}</td>
                <td>${checklist.responsables.join(', ')}</td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progreso}%;"></div>
                    </div>
                    <small>${progreso}% Completado</small>
                </td>
                <td>
                    <button class="action-btn" onclick="verChecklist('${checklist.id}')">Ver</button>
                    <button class="edit-btn action-btn" onclick="editarChecklist('${checklist.id}')">Editar</button>
                    <button class="delete-btn" onclick="eliminarChecklist('${checklist.id}')">Eliminar</button>
                </td>
            `;

            checklistTableBody.appendChild(fila);
        });
    }

    // **Función para Ver un Checklist**
    window.verChecklist = async function(checklistId) {
        try {
            const checklistRef = doc(db, "checklists", checklistId);
            const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", checklistId))).then(snapshot => {
                let found = null;
                snapshot.forEach(docu => {
                    if (docu.id === checklistId) {
                        found = docu.data();
                        found.id = docu.id;
                    }
                });
                return found;
            });

            if (!checklistSnap) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Checklist no encontrado.',
                });
                return;
            }

            // Calcular el progreso
            const totalTareas = checklistSnap.tareas.length;
            const tareasCompletadas = checklistSnap.tareas.filter(t => t.completado).length;
            const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

            // Actualizar la barra de progreso en el modal
            viewProgressBar.style.width = `${progreso}%`;
            viewProgressText.textContent = `${progreso}% Completado`;

            viewChecklistTitulo.textContent = checklistSnap.titulo;
            viewChecklistFecha.textContent = `Fecha: ${checklistSnap.fecha}`;
            viewChecklistResponsables.textContent = `Responsables: ${checklistSnap.responsables.join(', ')}`;
            viewChecklistTareasList.innerHTML = '';

            if (checklistSnap.tareas.length === 0) {
                viewChecklistTareasList.innerHTML = '<li class="info-message">Este checklist no tiene tareas asignadas.</li>';
            } else {
                // Optimización: Crear una única consulta para todas las tareas
                const tareaIds = checklistSnap.tareas.map(t => t.id);
                let tareasMap = {};

                // Firestore permite un máximo de 10 elementos en 'in', así que si hay más, dividimos en múltiples consultas
                const chunks = [];
                const size = 10;
                for (let i = 0; i < tareaIds.length; i += size) {
                    chunks.push(tareaIds.slice(i, i + size));
                }

                for (const chunk of chunks) {
                    const tareasQuery = query(collection(db, "tareas"), where("__name__", "in", chunk));
                    const tareasSnapshot = await getDocs(tareasQuery);
                    tareasSnapshot.forEach(docu => {
                        tareasMap[docu.id] = docu.data();
                    });
                }

                checklistSnap.tareas.forEach(tareaItem => {
                    const tarea = tareasMap[tareaItem.id];
                    const tareaDescripcion = tarea ? tarea.descripcion : 'Descripción no disponible';

                    const li = document.createElement('li');
                    li.innerHTML = `
                        <label>
                            <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${tareaItem.id}" ${tareaItem.completado ? 'checked' : ''}>
                            ${tareaDescripcion}
                        </label>
                    `;
                    viewChecklistTareasList.appendChild(li);
                });
            }

            // Escuchar cambios en las tareas del checklist en tiempo real
            onSnapshot(doc(db, "checklists", checklistId), (docu) => {
                const updatedChecklist = docu.data();
                if (updatedChecklist) {
                    // Calcular el progreso actualizado
                    const totalTareas = updatedChecklist.tareas.length;
                    const tareasCompletadas = updatedChecklist.tareas.filter(t => t.completado).length;
                    const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

                    // Actualizar la barra de progreso en el modal
                    viewProgressBar.style.width = `${progreso}%`;
                    viewProgressText.textContent = `${progreso}% Completado`;

                    // Actualizar la información del checklist
                    viewChecklistTitulo.textContent = updatedChecklist.titulo;
                    viewChecklistFecha.textContent = `Fecha: ${updatedChecklist.fecha}`;
                    viewChecklistResponsables.textContent = `Responsables: ${updatedChecklist.responsables.join(', ')}`;
                    viewChecklistTareasList.innerHTML = '';

                    if (updatedChecklist.tareas.length === 0) {
                        viewChecklistTareasList.innerHTML = '<li class="info-message">Este checklist no tiene tareas asignadas.</li>';
                    } else {
                        // Optimización: Crear una única consulta para todas las tareas
                        const tareaIds = updatedChecklist.tareas.map(t => t.id);
                        let tareasMap = {};

                        // Firestore permite un máximo de 10 elementos en 'in', así que si hay más, dividimos en múltiples consultas
                        const chunks = [];
                        const size = 10;
                        for (let i = 0; i < tareaIds.length; i += size) {
                            chunks.push(tareaIds.slice(i, i + size));
                        }

                        // Función asíncrona para manejar múltiples consultas
                        (async () => {
                            for (const chunk of chunks) {
                                const tareasQuery = query(collection(db, "tareas"), where("__name__", "in", chunk));
                                const tareasSnapshot = await getDocs(tareasQuery);
                                tareasSnapshot.forEach(docu => {
                                    tareasMap[docu.id] = docu.data();
                                });
                            }

                            updatedChecklist.tareas.forEach(tareaItem => {
                                const tarea = tareasMap[tareaItem.id];
                                const tareaDescripcion = tarea ? tarea.descripcion : 'Descripción no disponible';

                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <label>
                                        <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${tareaItem.id}" ${tareaItem.completado ? 'checked' : ''}>
                                        ${tareaDescripcion}
                                    </label>
                                `;
                                viewChecklistTareasList.appendChild(li);
                            });
                        })().catch(error => {
                            console.error("Error al cargar tareas actualizadas:", error);
                        });
                    }

                    // Actualizar la barra de progreso en la tabla
                    actualizarTablaChecklists();
                }
            });

            viewChecklistModal.style.display = 'block';
        } catch (error) {
            console.error("Error al ver checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar el checklist.',
            });
        }
    }

    // **Función para Editar un Checklist**
    window.editarChecklist = async function(checklistId) {
        try {
            const checklistRef = doc(db, "checklists", checklistId);
            const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", checklistId))).then(snapshot => {
                let found = null;
                snapshot.forEach(docu => {
                    if (docu.id === checklistId) {
                        found = docu.data();
                        found.id = docu.id;
                    }
                });
                return found;
            });

            if (!checklistSnap) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Checklist no encontrado.',
                });
                return;
            }

            // Configurar el modal en modo edición
            isEditMode = true;
            currentEditChecklistId = checklistId;

            // Llenar el formulario con los datos existentes
            document.getElementById('checklistTitulo').value = checklistSnap.titulo;
            document.getElementById('checklistFecha').value = checklistSnap.fecha;

            // Seleccionar los responsables existentes
            Array.from(checklistResponsablesSelect.options).forEach(option => {
                option.selected = checklistSnap.responsables.includes(option.value);
            });

            // Cargar tareas disponibles basadas en los responsables seleccionados
            cargarTareasDisponibles(checklistSnap.responsables);

            // Esperar a que las tareas se carguen y luego marcar las que ya están en el checklist
            setTimeout(() => {
                checklistSnap.tareas.forEach(tareaItem => {
                    const checkbox = document.querySelector(`input[name="tareas"][value="${tareaItem.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }, 500); // Ajusta el tiempo según la carga de tareas

            // Cambiar el título del modal
            document.getElementById('modalTitle').textContent = 'Editar Checklist';

            // Abrir el modal
            checklistModal.style.display = 'block';
        } catch (error) {
            console.error("Error al editar checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar el checklist para editar.',
            });
        }
    }

    // **Función para Eliminar un Checklist**
    window.eliminarChecklist = function(checklistId) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción eliminará el checklist de forma permanente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                eliminarChecklistConfirm(checklistId);
            }
        });
    }

    async function eliminarChecklistConfirm(checklistId) {
        try {
            await deleteDoc(doc(db, "checklists", checklistId));
            Swal.fire({
                icon: 'success',
                title: 'Eliminado',
                text: 'El checklist ha sido eliminado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error al eliminar checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al eliminar el checklist.',
            });
        }
    }

    // **Manejar el Guardado de Cambios en el Checklist**
    checklistForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const titulo = document.getElementById('checklistTitulo').value.trim();
        const fecha = document.getElementById('checklistFecha').value;
        const responsablesSeleccionados = Array.from(checklistResponsablesSelect.selectedOptions).map(option => option.value);
        const tareasSeleccionadas = Array.from(document.querySelectorAll('input[name="tareas"]:checked')).map(checkbox => checkbox.value);

        // Validaciones
        if (!titulo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El título del checklist no puede estar vacío.',
            });
            return;
        }

        if (!fecha) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona una fecha.',
            });
            return;
        }

        if (responsablesSeleccionados.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos un responsable.',
            });
            return;
        }

        if (tareasSeleccionadas.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos una tarea.',
            });
            return;
        }

        // Crear el objeto del checklist
        const checklistData = {
            titulo,
            fecha,
            responsables: responsablesSeleccionados,
            tareas: tareasSeleccionadas.map(tareaId => ({ id: tareaId, completado: false }))
        };

        if (isEditMode && currentEditChecklistId) {
            // Modo Edición: Actualizar el checklist existente
            try {
                const checklistRef = doc(db, "checklists", currentEditChecklistId);
                const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", currentEditChecklistId))).then(snapshot => {
                    let found = null;
                    snapshot.forEach(docu => {
                        if (docu.id === currentEditChecklistId) {
                            found = docu.data();
                            found.id = docu.id;
                        }
                    });
                    return found;
                });

                if (!checklistSnap) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Checklist no encontrado.',
                    });
                    return;
                }

                const tareasActuales = checklistSnap.tareas.map(t => t.id);
                const tareasNuevas = tareasSeleccionadas;
                const tareasAgregadas = tareasNuevas.filter(t => !tareasActuales.includes(t));
                const tareasEliminadas = tareasActuales.filter(t => !tareasNuevas.includes(t));

                // Actualizar el checklist en Firestore
                await updateDoc(checklistRef, {
                    titulo: checklistData.titulo,
                    fecha: checklistData.fecha,
                    responsables: checklistData.responsables,
                    tareas: checklistData.tareas
                });

                // Actualizar el estado de las tareas agregadas
                for (const tareaId of tareasAgregadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "En Progreso" });
                }

                // Opcional: Si deseas revertir el estado de las tareas eliminadas
                for (const tareaId of tareasEliminadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "Pendiente" }); // O el estado que corresponda
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido actualizado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
                isEditMode = false;
                currentEditChecklistId = null;
                document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
            } catch (error) {
                console.error("Error al actualizar checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al actualizar el checklist.',
                });
            }
        } else {
            // Modo Creación: Crear un nuevo checklist
            try {
                await addDoc(collection(db, "checklists"), checklistData);
                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido creado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
            } catch (error) {
                console.error("Error al crear checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al crear el checklist.',
                });
            }
        }
    });

    // **Cargar Checklists Existentes**
    function cargarChecklists() {
        const checklistsRef = collection(db, "checklists");
        onSnapshot(checklistsRef, (snapshot) => {
            checklists = [];
            snapshot.forEach(docu => {
                const checklist = docu.data();
                checklist.id = docu.id;
                checklists.push(checklist);
            });
            actualizarTablaChecklists();
        }, (error) => {
            console.error("Error al cargar checklists:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar los checklists.',
            });
        });
    }

    cargarChecklists();

    // **Actualizar la Tabla de Checklists**
    function actualizarTablaChecklists() {
        checklistTableBody.innerHTML = '';

        if (checklists.length === 0) {
            const fila = document.createElement('tr');
            fila.innerHTML = `<td colspan="5" class="info-message">No hay checklists disponibles. Crea uno nuevo.</td>`;
            checklistTableBody.appendChild(fila);
            return;
        }

        checklists.forEach(checklist => {
            // Calcular el progreso
            const totalTareas = checklist.tareas.length;
            const tareasCompletadas = checklist.tareas.filter(t => t.completado).length;
            const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

            const fila = document.createElement('tr');

            fila.innerHTML = `
                <td>${checklist.titulo}</td>
                <td>${checklist.fecha}</td>
                <td>${checklist.responsables.join(', ')}</td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progreso}%;"></div>
                    </div>
                    <small>${progreso}% Completado</small>
                </td>
                <td>
                    <button class="action-btn" onclick="verChecklist('${checklist.id}')">Ver</button>
                    <button class="edit-btn action-btn" onclick="editarChecklist('${checklist.id}')">Editar</button>
                    <button class="delete-btn" onclick="eliminarChecklist('${checklist.id}')">Eliminar</button>
                </td>
            `;

            checklistTableBody.appendChild(fila);
        });
    }

    // **Función para Ver un Checklist**
    window.verChecklist = async function(checklistId) {
        try {
            const checklistRef = doc(db, "checklists", checklistId);
            const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", checklistId))).then(snapshot => {
                let found = null;
                snapshot.forEach(docu => {
                    if (docu.id === checklistId) {
                        found = docu.data();
                        found.id = docu.id;
                    }
                });
                return found;
            });

            if (!checklistSnap) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Checklist no encontrado.',
                });
                return;
            }

            // Calcular el progreso
            const totalTareas = checklistSnap.tareas.length;
            const tareasCompletadas = checklistSnap.tareas.filter(t => t.completado).length;
            const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

            // Actualizar la barra de progreso en el modal
            viewProgressBar.style.width = `${progreso}%`;
            viewProgressText.textContent = `${progreso}% Completado`;

            viewChecklistTitulo.textContent = checklistSnap.titulo;
            viewChecklistFecha.textContent = `Fecha: ${checklistSnap.fecha}`;
            viewChecklistResponsables.textContent = `Responsables: ${checklistSnap.responsables.join(', ')}`;
            viewChecklistTareasList.innerHTML = '';

            if (checklistSnap.tareas.length === 0) {
                viewChecklistTareasList.innerHTML = '<li class="info-message">Este checklist no tiene tareas asignadas.</li>';
            } else {
                // Optimización: Crear una única consulta para todas las tareas
                const tareaIds = checklistSnap.tareas.map(t => t.id);
                let tareasMap = {};

                // Firestore permite un máximo de 10 elementos en 'in', así que si hay más, dividimos en múltiples consultas
                const chunks = [];
                const size = 10;
                for (let i = 0; i < tareaIds.length; i += size) {
                    chunks.push(tareaIds.slice(i, i + size));
                }

                for (const chunk of chunks) {
                    const tareasQuery = query(collection(db, "tareas"), where("__name__", "in", chunk));
                    const tareasSnapshot = await getDocs(tareasQuery);
                    tareasSnapshot.forEach(docu => {
                        tareasMap[docu.id] = docu.data();
                    });
                }

                checklistSnap.tareas.forEach(tareaItem => {
                    const tarea = tareasMap[tareaItem.id];
                    const tareaDescripcion = tarea ? tarea.descripcion : 'Descripción no disponible';

                    const li = document.createElement('li');
                    li.innerHTML = `
                        <label>
                            <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${tareaItem.id}" ${tareaItem.completado ? 'checked' : ''}>
                            ${tareaDescripcion}
                        </label>
                    `;
                    viewChecklistTareasList.appendChild(li);
                });
            }

            // Escuchar cambios en las tareas del checklist en tiempo real
            onSnapshot(doc(db, "checklists", checklistId), (docu) => {
                const updatedChecklist = docu.data();
                if (updatedChecklist) {
                    // Calcular el progreso actualizado
                    const totalTareas = updatedChecklist.tareas.length;
                    const tareasCompletadas = updatedChecklist.tareas.filter(t => t.completado).length;
                    const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

                    // Actualizar la barra de progreso en el modal
                    viewProgressBar.style.width = `${progreso}%`;
                    viewProgressText.textContent = `${progreso}% Completado`;

                    // Actualizar la información del checklist
                    viewChecklistTitulo.textContent = updatedChecklist.titulo;
                    viewChecklistFecha.textContent = `Fecha: ${updatedChecklist.fecha}`;
                    viewChecklistResponsables.textContent = `Responsables: ${updatedChecklist.responsables.join(', ')}`;
                    viewChecklistTareasList.innerHTML = '';

                    if (updatedChecklist.tareas.length === 0) {
                        viewChecklistTareasList.innerHTML = '<li class="info-message">Este checklist no tiene tareas asignadas.</li>';
                    } else {
                        // Optimización: Crear una única consulta para todas las tareas
                        const tareaIds = updatedChecklist.tareas.map(t => t.id);
                        let tareasMap = {};

                        // Firestore permite un máximo de 10 elementos en 'in', así que si hay más, dividimos en múltiples consultas
                        const chunks = [];
                        const size = 10;
                        for (let i = 0; i < tareaIds.length; i += size) {
                            chunks.push(tareaIds.slice(i, i + size));
                        }

                        // Función asíncrona para manejar múltiples consultas
                        (async () => {
                            for (const chunk of chunks) {
                                const tareasQuery = query(collection(db, "tareas"), where("__name__", "in", chunk));
                                const tareasSnapshot = await getDocs(tareasQuery);
                                tareasSnapshot.forEach(docu => {
                                    tareasMap[docu.id] = docu.data();
                                });
                            }

                            updatedChecklist.tareas.forEach(tareaItem => {
                                const tarea = tareasMap[tareaItem.id];
                                const tareaDescripcion = tarea ? tarea.descripcion : 'Descripción no disponible';

                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <label>
                                        <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${tareaItem.id}" ${tareaItem.completado ? 'checked' : ''}>
                                        ${tareaDescripcion}
                                    </label>
                                `;
                                viewChecklistTareasList.appendChild(li);
                            });
                        })().catch(error => {
                            console.error("Error al cargar tareas actualizadas:", error);
                        });
                    }

                    // Actualizar la barra de progreso en la tabla
                    actualizarTablaChecklists();
                }
            });

            viewChecklistModal.style.display = 'block';
        } catch (error) {
            console.error("Error al ver checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar el checklist.',
            });
        }
    }

    // **Función para Editar un Checklist**
    window.editarChecklist = async function(checklistId) {
        try {
            const checklistRef = doc(db, "checklists", checklistId);
            const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", checklistId))).then(snapshot => {
                let found = null;
                snapshot.forEach(docu => {
                    if (docu.id === checklistId) {
                        found = docu.data();
                        found.id = docu.id;
                    }
                });
                return found;
            });

            if (!checklistSnap) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Checklist no encontrado.',
                });
                return;
            }

            // Configurar el modal en modo edición
            isEditMode = true;
            currentEditChecklistId = checklistId;

            // Llenar el formulario con los datos existentes
            document.getElementById('checklistTitulo').value = checklistSnap.titulo;
            document.getElementById('checklistFecha').value = checklistSnap.fecha;

            // Seleccionar los responsables existentes
            Array.from(checklistResponsablesSelect.options).forEach(option => {
                option.selected = checklistSnap.responsables.includes(option.value);
            });

            // Cargar tareas disponibles basadas en los responsables seleccionados
            cargarTareasDisponibles(checklistSnap.responsables);

            // Esperar a que las tareas se carguen y luego marcar las que ya están en el checklist
            setTimeout(() => {
                checklistSnap.tareas.forEach(tareaItem => {
                    const checkbox = document.querySelector(`input[name="tareas"][value="${tareaItem.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }, 500); // Ajusta el tiempo según la carga de tareas

            // Cambiar el título del modal
            document.getElementById('modalTitle').textContent = 'Editar Checklist';

            // Abrir el modal
            checklistModal.style.display = 'block';
        } catch (error) {
            console.error("Error al editar checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar el checklist para editar.',
            });
        }
    }

    // **Función para Eliminar un Checklist**
    window.eliminarChecklist = function(checklistId) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción eliminará el checklist de forma permanente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                eliminarChecklistConfirm(checklistId);
            }
        });
    }

    async function eliminarChecklistConfirm(checklistId) {
        try {
            await deleteDoc(doc(db, "checklists", checklistId));
            Swal.fire({
                icon: 'success',
                title: 'Eliminado',
                text: 'El checklist ha sido eliminado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error al eliminar checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al eliminar el checklist.',
            });
        }
    }

    // **Manejar el Guardado de Cambios en el Checklist**
    checklistForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const titulo = document.getElementById('checklistTitulo').value.trim();
        const fecha = document.getElementById('checklistFecha').value;
        const responsablesSeleccionados = Array.from(checklistResponsablesSelect.selectedOptions).map(option => option.value);
        const tareasSeleccionadas = Array.from(document.querySelectorAll('input[name="tareas"]:checked')).map(checkbox => checkbox.value);

        // Validaciones
        if (!titulo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El título del checklist no puede estar vacío.',
            });
            return;
        }

        if (!fecha) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona una fecha.',
            });
            return;
        }

        if (responsablesSeleccionados.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos un responsable.',
            });
            return;
        }

        if (tareasSeleccionadas.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos una tarea.',
            });
            return;
        }

        // Crear el objeto del checklist
        const checklistData = {
            titulo,
            fecha,
            responsables: responsablesSeleccionados,
            tareas: tareasSeleccionadas.map(tareaId => ({ id: tareaId, completado: false }))
        };

        if (isEditMode && currentEditChecklistId) {
            // Modo Edición: Actualizar el checklist existente
            try {
                const checklistRef = doc(db, "checklists", currentEditChecklistId);
                const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", currentEditChecklistId))).then(snapshot => {
                    let found = null;
                    snapshot.forEach(docu => {
                        if (docu.id === currentEditChecklistId) {
                            found = docu.data();
                            found.id = docu.id;
                        }
                    });
                    return found;
                });

                if (!checklistSnap) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Checklist no encontrado.',
                    });
                    return;
                }

                const tareasActuales = checklistSnap.tareas.map(t => t.id);
                const tareasNuevas = tareasSeleccionadas;
                const tareasAgregadas = tareasNuevas.filter(t => !tareasActuales.includes(t));
                const tareasEliminadas = tareasActuales.filter(t => !tareasNuevas.includes(t));

                // Actualizar el checklist en Firestore
                await updateDoc(checklistRef, {
                    titulo: checklistData.titulo,
                    fecha: checklistData.fecha,
                    responsables: checklistData.responsables,
                    tareas: checklistData.tareas
                });

                // Actualizar el estado de las tareas agregadas
                for (const tareaId of tareasAgregadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "En Progreso" });
                }

                // Opcional: Si deseas revertir el estado de las tareas eliminadas
                for (const tareaId of tareasEliminadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "Pendiente" }); // O el estado que corresponda
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido actualizado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
                isEditMode = false;
                currentEditChecklistId = null;
                document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
            } catch (error) {
                console.error("Error al actualizar checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al actualizar el checklist.',
                });
            }
        } else {
            // Modo Creación: Crear un nuevo checklist
            try {
                await addDoc(collection(db, "checklists"), checklistData);
                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido creado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
            } catch (error) {
                console.error("Error al crear checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al crear el checklist.',
                });
            }
        }
    });

    // **Escuchar Cambios en las Tareas Disponibles en Tiempo Real**
    async function escucharCambiosTareas(responsablesSeleccionados) {
        try {
            const tareasRef = collection(db, "tareas");
            const q = query(tareasRef, where("responsable", "array-contains-any", responsablesSeleccionados));
            onSnapshot(q, (snapshot) => {
                tareasDisponibles = [];
                snapshot.forEach(docu => {
                    const tarea = docu.data();
                    tarea.id = docu.id;
                    if (tarea.estado !== "Revisión" && tarea.estado !== "Completado") {
                        tareasDisponibles.push(tarea);
                    }
                });
                // Si el modal está abierto y el usuario ha seleccionado responsables, actualizar las tareas mostradas
                if (checklistModal.style.display === 'block') {
                    cargarTareasDisponibles(responsablesSeleccionados);
                }
            }, (error) => {
                console.error("Error al escuchar cambios en tareas disponibles:", error);
            });
        } catch (error) {
            console.error("Error al configurar escucha de tareas disponibles:", error);
        }
    }

});
