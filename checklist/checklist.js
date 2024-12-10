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

    // **Funciones para Manejar el Modal de Crear Checklist**
    openChecklistModalBtn.addEventListener('click', function() {
        checklistModal.style.display = 'block';
    });

    closeChecklistModalBtn.addEventListener('click', function() {
        checklistModal.style.display = 'none';
        checklistForm.reset();
        // Reiniciar los selects y checkboxes
        checklistResponsablesSelect.selectedIndex = -1;
        checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
    });

    // Cerrar el modal al hacer clic fuera de él
    window.addEventListener('click', function(event) {
        if (event.target == checklistModal) {
            checklistModal.style.display = 'none';
            checklistForm.reset();
            checklistResponsablesSelect.selectedIndex = -1;
            checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
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

        // Crear el checklist en Firestore y asociarlo a los responsables seleccionados
        const nuevoChecklist = {
            titulo,
            fecha,
            responsables: responsablesSeleccionados,
            tareas: tareasSeleccionadas.map(tareaId => ({ id: tareaId, completado: false }))
        };

        try {
            await addDoc(collection(db, "checklists"), nuevoChecklist);
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
    viewChecklistForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const checkboxes = viewChecklistTareasList.querySelectorAll('input[type="checkbox"]');
        const cambios = [];

        checkboxes.forEach(checkbox => {
            const checklistId = checkbox.getAttribute('data-checklist-id');
            const tareaId = checkbox.getAttribute('data-tarea-id');
            const completado = checkbox.checked;
            cambios.push({ checklistId, tareaId, completado });
        });

        // Crear un objeto para agrupar cambios por checklist
        const cambiosPorChecklist = {};

        cambios.forEach(cambio => {
            if (!cambiosPorChecklist[cambio.checklistId]) {
                cambiosPorChecklist[cambio.checklistId] = [];
            }
            cambiosPorChecklist[cambio.checklistId].push({
                id: cambio.tareaId,
                completado: cambio.completado
            });
        });

        // Procesar cada checklist por separado
        for (const [checklistId, tareas] of Object.entries(cambiosPorChecklist)) {
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

                if (!checklistSnap) continue;

                // Actualizar el estado de las tareas en el checklist
                const tareasActualizadas = checklistSnap.tareas.map(t => {
                    const tareaCambio = tareas.find(tc => tc.id === t.id);
                    if (tareaCambio) {
                        return { ...t, completado: tareaCambio.completado };
                    }
                    return t;
                });

                await updateDoc(checklistRef, { tareas: tareasActualizadas });

                // Actualizar el estado de las tareas en la colección "tareas"
                for (const tarea of tareas) {
                    const tareaRef = doc(db, "tareas", tarea.id);
                    const nuevoEstado = tarea.completado ? "Revisión" : "En Progreso";
                    await updateDoc(tareaRef, { estado: nuevoEstado });
                }

            } catch (error) {
                console.error("Error al actualizar checklist o tarea:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al actualizar el checklist o la tarea.',
                });
            }
        }

        Swal.fire({
            icon: 'success',
            title: 'Actualizado',
            text: 'Los cambios en el checklist han sido guardados.',
            timer: 1500,
            showConfirmButton: false
        });

        viewChecklistModal.style.display = 'none';
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
