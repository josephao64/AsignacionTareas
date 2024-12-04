// script.js
import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    // **Variables y Funciones de Inicio de Sesión**
    const loginModal = document.getElementById('loginModal');
    const openLoginBtn = document.getElementById('openLoginBtn');
    const closeLoginBtn = document.getElementById('closeLoginBtn');
    const loginForm = document.getElementById('loginForm');
    const usernameSelect = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const logoutBtn = document.getElementById('logoutBtn');

    // Definir el único usuario admin
    const usuarios = [
        { username: 'admin', password: '1', isAdmin: true }
    ];

    let usuarioActual = null; // Variable para rastrear el usuario actual

    // Función para cargar usuarios al select
    function cargarUsuarios() {
        usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.username;
            option.textContent = usuario.username;
            usernameSelect.appendChild(option);
        });
    }

    cargarUsuarios();

    // Verificar si hay un usuario guardado en localStorage
    const usuarioGuardado = localStorage.getItem('usuarioActual');
    if (usuarioGuardado) {
        usuarioActual = JSON.parse(usuarioGuardado);
        Swal.fire({
            icon: 'success',
            title: 'Bienvenido de Nuevo',
            text: `Has iniciado sesión como ${usuarioActual.username}.`,
            timer: 1500,
            showConfirmButton: false
        });
        // Ocultar el botón de "Iniciar Sesión" y mostrar "Cerrar Sesión"
        openLoginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    }

    // Manejar la apertura del modal de inicio de sesión
    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', function() {
            if (loginModal) {
                loginModal.style.display = 'block';
            }
        });
    }

    // Manejar el cierre del modal de inicio de sesión
    if (closeLoginBtn) {
        closeLoginBtn.addEventListener('click', function() {
            if (loginModal) {
                loginModal.style.display = 'none';
            }
        });
    }

    // Cerrar el modal al hacer clic fuera de él
    window.addEventListener('click', function(event) {
        if (loginModal && event.target == loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Manejar el envío del formulario de inicio de sesión
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const selectedUsername = usernameSelect.value;
            const enteredPassword = passwordInput.value.trim();

            if (!selectedUsername) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Por favor, selecciona un usuario.',
                });
                return;
            }

            // Verificar las credenciales del usuario
            const usuario = usuarios.find(u => u.username === selectedUsername && u.password === enteredPassword);
            if (usuario) {
                usuarioActual = usuario;
                // Guardar el usuario en localStorage para persistencia
                localStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));

                Swal.fire({
                    icon: 'success',
                    title: 'Bienvenido',
                    text: `Has iniciado sesión como ${usuarioActual.username}.`,
                    timer: 1500,
                    showConfirmButton: false
                });
                // Ocultar el botón de "Iniciar Sesión" y mostrar "Cerrar Sesión"
                if (openLoginBtn) openLoginBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'inline-block';
                // Cerrar el modal de inicio de sesión
                if (loginModal) loginModal.style.display = 'none';
                // Actualizar la tabla para reflejar permisos (si aplica)
                actualizarTabla();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Credenciales incorrectas.',
                });
            }
        });
    }

    // Manejar el cierre de sesión
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            usuarioActual = null;
            localStorage.removeItem('usuarioActual'); // Eliminar el usuario guardado

            Swal.fire({
                icon: 'info',
                title: 'Sesión Cerrada',
                text: 'Has cerrado sesión exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
            // Mostrar el botón de "Iniciar Sesión" y ocultar "Cerrar Sesión"
            if (openLoginBtn) openLoginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
            // Actualizar la tabla para reflejar permisos (si aplica)
            actualizarTabla();
        });
    }

    // **Variables y Funciones de la Aplicación Principal**
    let tareas = [];
    let editarIndex = null;
    let filaSeleccionada = null;

    let tiposTareas = []; // Ahora se cargará desde la base de datos

    const taskTable = document.getElementById("taskTable") ? document.getElementById("taskTable").querySelector("tbody") : null;
    const searchInput = document.getElementById('searchInput');
    const editarBtn = document.getElementById('editarBtn');
    const eliminarBtn = document.getElementById('eliminarBtn');

    const filterTipo = document.getElementById('filterTipo');
    const filterResponsable = document.getElementById('filterResponsable');

    // Referencias a los checkboxes de estado
    const filterNoIniciado = document.getElementById('filterNoIniciado');
    const filterEnProgreso = document.getElementById('filterEnProgreso');
    const filterRevision = document.getElementById('filterRevision');
    const filterCompletado = document.getElementById('filterCompletado');

    const filterFechaDesde = document.getElementById('filterFechaDesde');
    const filterFechaHasta = document.getElementById('filterFechaHasta');
    const sortOrderSelect = document.getElementById('sortOrder');
    const resetFiltersBtn = document.getElementById('resetFilters');

    const tipoSelect = document.getElementById('tipo');
    const addTipoBtn = document.getElementById('addTipoBtn');

    // Definir el orden de prioridad para los estados
    const prioridadEstado = {
        "Completado": 1,
        "Revisión": 2,
        "En Progreso": 3,
        "No Iniciado": 4
    };

    // Función para cargar los tipos de tareas desde la base de datos
    async function cargarTipos() {
        try {
            // Limpiar opciones
            if (tipoSelect) tipoSelect.innerHTML = '<option value="">Selecciona un tipo</option>';
            if (filterTipo) filterTipo.innerHTML = '<option value="">Todos los Tipos</option>';

            tiposTareas = []; // Reiniciar el array local

            const tiposRef = collection(db, "tiposTareas");
            const tiposSnapshot = await getDocs(tiposRef);
            tiposSnapshot.forEach((docu) => {
                const tipo = docu.data().nombre;
                tiposTareas.push(tipo);
            });

            tiposTareas.forEach(tipo => {
                if (tipoSelect) {
                    const option = document.createElement('option');
                    option.value = tipo;
                    option.textContent = tipo;
                    tipoSelect.appendChild(option);
                }
            });

            tiposTareas.forEach(tipo => {
                if (filterTipo) {
                    const option = document.createElement('option');
                    option.value = tipo;
                    option.textContent = tipo;
                    filterTipo.appendChild(option);
                }
            });
        } catch (error) {
            console.error("Error al cargar tipos de tareas:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar los tipos de tareas.',
            });
        }
    }

    cargarTipos();

    // Evento para agregar un nuevo tipo de tarea
    if (addTipoBtn) {
        addTipoBtn.addEventListener('click', function() {
            // Solo permitir agregar tipos si el usuario ha iniciado sesión
            if (!usuarioActual) {
                Swal.fire({
                    icon: 'error',
                    title: 'Acceso Denegado',
                    text: 'Debes iniciar sesión para agregar nuevos tipos de tareas.',
                });
                return;
            }

            Swal.fire({
                title: 'Agregar Nuevo Tipo',
                input: 'text',
                inputLabel: 'Nuevo Tipo de Tarea',
                inputPlaceholder: 'Escribe el nuevo tipo',
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value) {
                        return 'Por favor ingresa un tipo de tarea';
                    }
                    if (tiposTareas.includes(value.toUpperCase())) {
                        return 'Este tipo ya existe';
                    }
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const nuevoTipo = result.value.toUpperCase();
                    try {
                        // Guardar el nuevo tipo en la base de datos
                        await addDoc(collection(db, "tiposTareas"), { nombre: nuevoTipo });
                        // Recargar los tipos
                        await cargarTipos();
                        if (tipoSelect) tipoSelect.value = nuevoTipo;
                        Swal.fire({
                            icon: 'success',
                            title: 'Tipo Agregado',
                            text: `El tipo "${nuevoTipo}" ha sido agregado exitosamente.`,
                            timer: 1500,
                            showConfirmButton: false
                        });
                    } catch (error) {
                        console.error("Error al agregar nuevo tipo de tarea:", error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Hubo un problema al agregar el nuevo tipo de tarea.',
                        });
                    }
                }
            });
        });
    }

    // Cargar tareas desde Firebase
    function cargarTareas() {
        const tareasRef = collection(db, "tareas");
        onSnapshot(tareasRef, (snapshot) => {
            tareas = [];
            snapshot.forEach((docu) => {
                const tarea = docu.data();
                tarea.id = docu.id;
                tareas.push(tarea);
            });
            actualizarTabla();
        }, (error) => {
            console.error("Error al cargar tareas:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar las tareas.',
            });
        });
    }

    cargarTareas();

    // Abrir el modal
    window.abrirModal = function(index = null) {
        editarIndex = index;
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        if (form) form.reset();

        // Reiniciar los checkboxes
        const checkboxes = document.querySelectorAll('#responsableCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (checkbox) checkbox.checked = false;
        });

        if (index !== null) {
            // Modo edición
            const tarea = tareas[index];
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.innerText = 'Editar Tarea';
            if (document.getElementById('tipo')) document.getElementById('tipo').value = tarea.tipo;
            if (document.getElementById('descripcion')) document.getElementById('descripcion').value = tarea.descripcion;

            // Preseleccionar responsables
            const responsables = tarea.responsable;
            checkboxes.forEach(checkbox => {
                if (responsables.includes(checkbox.value)) {
                    checkbox.checked = true;
                }
            });

            if (document.getElementById('fechaEstimada')) document.getElementById('fechaEstimada').value = tarea.fechaEstimada;
            if (document.getElementById('notas')) document.getElementById('notas').value = tarea.notas;
        } else {
            // Modo agregar
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.innerText = 'Agregar Tarea';
        }

        if (modal) {
            modal.style.display = 'block';
        }
    }

    // Cerrar el modal
    window.cerrarModal = function() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.style.display = 'none';
        }
        editarIndex = null;
        filaSeleccionada = null;
        if (editarBtn) editarBtn.disabled = true;
        if (eliminarBtn) eliminarBtn.disabled = true;
    }

    // Agregar o Editar Tarea
    if (document.getElementById('taskForm')) {
        document.getElementById('taskForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const tipo = document.getElementById('tipo') ? document.getElementById('tipo').value.trim() : '';
            const descripcion = document.getElementById('descripcion') ? document.getElementById('descripcion').value.trim() : '';

            const responsableCheckboxes = document.querySelectorAll('#responsableCheckboxes input[type="checkbox"]');
            const responsables = [];
            responsableCheckboxes.forEach(checkbox => {
                if (checkbox && checkbox.checked) {
                    responsables.push(checkbox.value);
                }
            });

            const fechaEstimada = document.getElementById('fechaEstimada') ? document.getElementById('fechaEstimada').value : '';
            const notas = document.getElementById('notas') ? document.getElementById('notas').value.trim() : '';

            // Validaciones
            if (!tipo || !descripcion || responsables.length === 0 || !fechaEstimada) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Por favor, completa todos los campos requeridos y selecciona al menos un responsable.',
                });
                return;
            }

            if (editarIndex !== null) {
                // Actualizar tarea existente
                const tarea = {
                    ...tareas[editarIndex],
                    tipo,
                    descripcion,
                    responsable: responsables,
                    fechaEstimada,
                    notas
                };
                const tareaRef = doc(db, "tareas", tarea.id);
                try {
                    await updateDoc(tareaRef, tarea);

                    Swal.fire({
                        icon: 'success',
                        title: 'Actualizado',
                        text: 'La tarea ha sido actualizada exitosamente.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                } catch (error) {
                    console.error("Error al actualizar tarea:", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Hubo un problema al actualizar la tarea.',
                    });
                    return;
                }
            } else {
                // Agregar nueva tarea
                const nuevaTarea = {
                    tipo,
                    descripcion,
                    responsable: responsables,
                    fechaEstimada,
                    fechaCulminacion: "",
                    estado: "No Iniciado",
                    notas,
                    fechaCreacion: new Date().toISOString()
                };
                try {
                    await addDoc(collection(db, "tareas"), nuevaTarea);

                    Swal.fire({
                        icon: 'success',
                        title: 'Añadido',
                        text: 'La tarea ha sido agregada exitosamente.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                } catch (error) {
                    console.error("Error al agregar tarea:", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Hubo un problema al agregar la tarea.',
                    });
                    return;
                }
            }

            cerrarModal();
        });
    }

    // Actualizar la tabla
    function actualizarTabla() {
        if (!taskTable) return;

        taskTable.innerHTML = "";

        // Aplicar filtros y ordenamiento
        let tareasFiltradas = tareas.slice();

        // Aplicar filtros
        tareasFiltradas = tareasFiltradas.filter(tarea => filtrarTarea(tarea));

        // Ordenar tareas
        const sortOrder = sortOrderSelect ? sortOrderSelect.value : null;
        if (sortOrder === 'fechaEstimadaAsc') {
            tareasFiltradas.sort((a, b) => {
                return new Date(a.fechaEstimada) - new Date(b.fechaEstimada);
            });
        } else if (sortOrder === 'fechaEstimadaDesc') {
            tareasFiltradas.sort((a, b) => {
                return new Date(b.fechaEstimada) - new Date(a.fechaEstimada);
            });
        } else if (sortOrder === 'fechaCreacionDesc') {
            tareasFiltradas.sort((a, b) => {
                return new Date(b.fechaCreacion || '1970-01-01') - new Date(a.fechaCreacion || '1970-01-01');
            });
        } else if (sortOrder === 'fechaCreacionAsc') {
            tareasFiltradas.sort((a, b) => {
                return new Date(a.fechaCreacion || '9999-12-31') - new Date(b.fechaCreacion || '9999-12-31');
            });
        } else if (sortOrder === 'estadoOrden') { // Manejo de la nueva opción
            tareasFiltradas.sort((a, b) => {
                return prioridadEstado[a.estado] - prioridadEstado[b.estado];
            });
        }

        tareasFiltradas.forEach((tarea, index) => {
            const fila = document.createElement("tr");
            fila.dataset.index = index;

            // Asignar clase según el estado
            let claseEstado = '';
            if (tarea.estado === "No Iniciado") {
                claseEstado = 'estado-no-iniciado';
            } else if (tarea.estado === "En Progreso") {
                claseEstado = 'estado-en-progreso';
            } else if (tarea.estado === "Revisión") {
                claseEstado = 'estado-revision';
            } else if (tarea.estado === "Completado") {
                claseEstado = 'estado-completado';
            }

            // Convertir array de responsables a cadena
            const responsablesStr = tarea.responsable.join(', ');

            // Crear el contenido de la fila
            fila.innerHTML = `
                <td>${tarea.tipo}</td>
                <td>${tarea.descripcion}</td>
                <td>${responsablesStr}</td>
                <td>${tarea.fechaEstimada}</td>
                <td>${tarea.fechaCulminacion || '-'}</td>
                <td class="${claseEstado}">
                    <select onchange="cambiarEstado(${tareas.indexOf(tarea)}, this.value)">
                        <option value="No Iniciado" ${tarea.estado === 'No Iniciado' ? 'selected' : ''}>No Iniciado</option>
                        <option value="En Progreso" ${tarea.estado === 'En Progreso' ? 'selected' : ''}>En Progreso</option>
                        <option value="Revisión" ${tarea.estado === 'Revisión' ? 'selected' : ''}>Revisión</option>
                        <option value="Completado" ${tarea.estado === 'Completado' ? 'selected' : ''}>Completado</option>
                    </select>
                </td>
                <td>${tarea.notas || '-'}</td>
            `;

            // Ajustar el <select> de Estado según el rol del usuario
            const selectEstado = fila.querySelector('select');
            if (selectEstado) {
                if (usuarioActual && usuarioActual.isAdmin) {
                    // Administradores pueden seleccionar cualquier estado
                    selectEstado.disabled = false;
                } else {
                    // Usuarios no administradores y no autenticados: deshabilitar la opción "Completado"
                    const optionCompletado = selectEstado.querySelector('option[value="Completado"]');
                    if (optionCompletado) {
                        optionCompletado.disabled = true;
                        if (tarea.estado === 'Completado') {
                            // Si la tarea está "Completada" y el usuario no es admin, deshabilitar el select completamente
                            selectEstado.disabled = true;
                        }
                    }
                }
            }

            // Evento de selección de fila
            fila.addEventListener('click', function(e) {
                if (e.target.nodeName !== "SELECT") {
                    seleccionarFila(this, tareas.indexOf(tarea));
                }
            });

            taskTable.appendChild(fila);
        });

        // Verificar si la fila seleccionada sigue visible
        if (filaSeleccionada) {
            const seleccionadaVisible = Array.from(taskTable.children).some(fila => parseInt(fila.dataset.index) === parseInt(filaSeleccionada.dataset.index));
            if (!seleccionadaVisible) {
                filaSeleccionada = null;
                if (editarBtn) editarBtn.disabled = true;
                if (eliminarBtn) eliminarBtn.disabled = true;
            }
        }
    }

    // Filtrar tarea según los filtros activos
    function filtrarTarea(tarea) {
        const filtroTipo = filterTipo ? filterTipo.value : '';
        const filtroResponsable = filterResponsable ? filterResponsable.value : '';
        const filtroFechaDesde = filterFechaDesde ? filterFechaDesde.value : '';
        const filtroFechaHasta = filterFechaHasta ? filterFechaHasta.value : '';
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        let cumple = true;

        // Filtro por Tipo
        if (filtroTipo && tarea.tipo !== filtroTipo) {
            cumple = false;
        }

        // Filtro por Responsable
        if (filtroResponsable && !tarea.responsable.includes(filtroResponsable)) {
            cumple = false;
        }

        // Filtro por Estado usando los checkboxes
        const estadosSeleccionados = [];
        if (filterNoIniciado && filterNoIniciado.checked) estadosSeleccionados.push("No Iniciado");
        if (filterEnProgreso && filterEnProgreso.checked) estadosSeleccionados.push("En Progreso");
        if (filterRevision && filterRevision.checked) estadosSeleccionados.push("Revisión");
        if (filterCompletado && filterCompletado.checked) estadosSeleccionados.push("Completado");

        if (estadosSeleccionados.length > 0 && !estadosSeleccionados.includes(tarea.estado)) {
            cumple = false;
        }

        // Filtro por Fecha Estimada Desde
        if (filtroFechaDesde && tarea.fechaEstimada < filtroFechaDesde) {
            cumple = false;
        }

        // Filtro por Fecha Estimada Hasta
        if (filtroFechaHasta && tarea.fechaEstimada > filtroFechaHasta) {
            cumple = false;
        }

        // Búsqueda general
        if (searchTerm) {
            const responsablesStr = tarea.responsable.join(', ');
            const contiene = tarea.tipo.toLowerCase().includes(searchTerm) ||
                             tarea.descripcion.toLowerCase().includes(searchTerm) ||
                             responsablesStr.toLowerCase().includes(searchTerm) ||
                             tarea.fechaEstimada.includes(searchTerm) ||
                             (tarea.fechaCulminacion && tarea.fechaCulminacion.includes(searchTerm)) ||
                             tarea.estado.toLowerCase().includes(searchTerm) ||
                             (tarea.notas && tarea.notas.toLowerCase().includes(searchTerm));
            if (!contiene) {
                cumple = false;
            }
        }

        return cumple;
    }

    // Seleccionar una fila
    function seleccionarFila(fila, index) {
        if (filaSeleccionada) {
            filaSeleccionada.classList.remove('selected');
        }

        fila.classList.add('selected');
        filaSeleccionada = fila;

        // Habilitar botones de editar y eliminar
        if (editarBtn) editarBtn.disabled = false;
        if (eliminarBtn) eliminarBtn.disabled = false;

        filaSeleccionada.dataset.index = index;
    }

    // Editar Tarea
    if (editarBtn) {
        editarBtn.addEventListener('click', function() {
            if (filaSeleccionada) {
                const index = parseInt(filaSeleccionada.dataset.index, 10);
                abrirModal(index);
            }
        });
    }

    // Eliminar Tarea
    if (eliminarBtn) {
        eliminarBtn.addEventListener('click', function() {
            if (filaSeleccionada) {
                const index = parseInt(filaSeleccionada.dataset.index, 10);
                Swal.fire({
                    title: '¿Estás seguro?',
                    text: "¡No podrás revertir esto!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const tarea = tareas[index];
                        const tareaRef = doc(db, "tareas", tarea.id);
                        try {
                            await deleteDoc(tareaRef);

                            filaSeleccionada = null;
                            if (editarBtn) editarBtn.disabled = true;
                            if (eliminarBtn) eliminarBtn.disabled = true;

                            Swal.fire(
                                'Eliminado!',
                                'La tarea ha sido eliminada.',
                                'success'
                            );
                        } catch (error) {
                            console.error("Error al eliminar tarea:", error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Hubo un problema al eliminar la tarea.',
                            });
                        }
                    }
                });
            }
        });
    }

    // Cambiar el estado de una tarea
    window.cambiarEstado = async function(index, nuevoEstado) {
        const tarea = tareas[index];

        // Verificar si el nuevo estado es "Completado"
        if (nuevoEstado === "Completado") {
            if (usuarioActual && usuarioActual.isAdmin) {
                // Permitir el cambio a "Completado" si el usuario es admin
            } else {
                // Bloquear el cambio a "Completado" para usuarios no admin o no autenticados
                Swal.fire({
                    icon: 'error',
                    title: 'Acceso Denegado',
                    text: 'Solo el administrador puede marcar las tareas como "Completado".',
                });
                actualizarTabla(); // Revertir cualquier cambio visual
                return;
            }
        }

        // Actualizar el estado
        tarea.estado = nuevoEstado;
        if (nuevoEstado === "Completado" && tarea.fechaCulminacion === "") {
            tarea.fechaCulminacion = new Date().toISOString().split('T')[0];
        } else if (nuevoEstado !== "Completado") {
            tarea.fechaCulminacion = "";
        }

        const tareaRef = doc(db, "tareas", tarea.id);
        try {
            await updateDoc(tareaRef, {
                estado: tarea.estado,
                fechaCulminacion: tarea.fechaCulminacion
            });

            Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'El estado de la tarea ha sido actualizado.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error al actualizar estado de tarea:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al actualizar el estado de la tarea.',
            });
            actualizarTabla(); // Revertir cualquier cambio visual
        }
    }

    // Listeners para filtros y ordenamiento
    if (sortOrderSelect) sortOrderSelect.addEventListener('change', actualizarTabla);
    if (searchInput) searchInput.addEventListener('input', actualizarTabla);
    if (filterTipo) filterTipo.addEventListener('change', actualizarTabla);
    if (filterResponsable) filterResponsable.addEventListener('change', actualizarTabla);
    if (filterFechaDesde) filterFechaDesde.addEventListener('change', actualizarTabla);
    if (filterFechaHasta) filterFechaHasta.addEventListener('change', actualizarTabla);

    // Listeners para los checkboxes de estado
    if (filterNoIniciado) filterNoIniciado.addEventListener('change', actualizarTabla);
    if (filterEnProgreso) filterEnProgreso.addEventListener('change', actualizarTabla);
    if (filterRevision) filterRevision.addEventListener('change', actualizarTabla);
    if (filterCompletado) filterCompletado.addEventListener('change', actualizarTabla);

    // Resetear filtros
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            if (filterTipo) filterTipo.value = "";
            if (filterResponsable) filterResponsable.value = "";
            if (searchInput) searchInput.value = "";
            if (filterFechaDesde) filterFechaDesde.value = "";
            if (filterFechaHasta) filterFechaHasta.value = "";
            if (sortOrderSelect) sortOrderSelect.value = "estadoOrden"; // Preseleccionar "Ordenar por Estado"
            if (filterNoIniciado) filterNoIniciado.checked = true;
            if (filterEnProgreso) filterEnProgreso.checked = true;
            if (filterRevision) filterRevision.checked = true;
            if (filterCompletado) filterCompletado.checked = false; // Desmarcar "Completado"
            actualizarTabla();
            Swal.fire({
                icon: 'info',
                title: 'Filtros Reseteados',
                text: 'Todos los filtros han sido reseteados.',
                timer: 1500,
                showConfirmButton: false
            });
        });
    }

    // Cerrar el modal al hacer clic fuera de él
    window.onclick = function(event) {
        const modal = document.getElementById('taskModal');
        if (modal && event.target == modal) {
            cerrarModal();
        }
    }

    // **Función para Habilitar Funcionalidades Adicionales (Opcional)**
    function habilitarFuncionesAdicionales() {
        // Puedes agregar funcionalidades adicionales aquí si lo deseas
    }
});
