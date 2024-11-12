import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

const firebaseConfig = {
  // Tu configuración de Firebase
  apiKey: "AIzaSyCc_XN...goLunI_pk",
  authDomain: "tareasdb-193f4.firebaseapp.com",
  projectId: "tareasdb-193f4",
  storageBucket: "tareasdb-193f4.appspot.com",
  messagingSenderId: "654977996103",
  appId: "1:654977996103:web:9c246d4d16c1d3c943e862"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
    let tareas = [];
    let editarIndex = null;
    let filaSeleccionada = null;

    let tiposTareas = [
        "RRHH",
        "LOGISTICA",
        "FINANZAS",
        "GENERAL",
        "MANTENIMIENTO",
        "MARKETING Y PUBLICIDAD",
        "INVESTIGACION Y DESARROLLO",
        "REPORTE"
    ];

    const taskTable = document.getElementById("taskTable").querySelector("tbody");
    const searchInput = document.getElementById('searchInput');
    const editarBtn = document.getElementById('editarBtn');
    const eliminarBtn = document.getElementById('eliminarBtn');

    const filterTipo = document.getElementById('filterTipo');
    const filterResponsable = document.getElementById('filterResponsable');

    // Referencias a los checkboxes de estado
    const filterNoIniciado = document.getElementById('filterNoIniciado');
    const filterEnProgreso = document.getElementById('filterEnProgreso');
    const filterCompletado = document.getElementById('filterCompletado');

    const filterFechaDesde = document.getElementById('filterFechaDesde');
    const filterFechaHasta = document.getElementById('filterFechaHasta');
    const sortOrderSelect = document.getElementById('sortOrder');
    const resetFiltersBtn = document.getElementById('resetFilters');

    const tipoSelect = document.getElementById('tipo');
    const addTipoBtn = document.getElementById('addTipoBtn');

    // Función para cargar los tipos de tareas en el select
    function cargarTipos() {
        // Limpiar opciones
        tipoSelect.innerHTML = '<option value="">Selecciona un tipo</option>';
        filterTipo.innerHTML = '<option value="">Todos los Tipos</option>';

        tiposTareas.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            tipoSelect.appendChild(option);
        });

        tiposTareas.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            filterTipo.appendChild(option);
        });
    }

    cargarTipos();

    // Evento para agregar un nuevo tipo de tarea
    addTipoBtn.addEventListener('click', function() {
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
        }).then((result) => {
            if (result.isConfirmed) {
                const nuevoTipo = result.value.toUpperCase();
                tiposTareas.push(nuevoTipo);
                cargarTipos();
                tipoSelect.value = nuevoTipo;
                Swal.fire({
                    icon: 'success',
                    title: 'Tipo Agregado',
                    text: `El tipo "${nuevoTipo}" ha sido agregado exitosamente.`,
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    });

    // Cargar tareas desde Firebase
    function cargarTareas() {
        const tareasRef = collection(db, "tareas");
        onSnapshot(tareasRef, (snapshot) => {
            tareas = [];
            snapshot.forEach((doc) => {
                const tarea = doc.data();
                tarea.id = doc.id;
                tareas.push(tarea);
            });
            actualizarTabla();
        });
    }

    cargarTareas();

    // Abrir el modal
    window.abrirModal = function(index = null) {
        editarIndex = index;
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        form.reset();

        // Reiniciar los checkboxes
        const checkboxes = document.querySelectorAll('#responsableCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = false);

        if (index !== null) {
            // Modo edición
            const tarea = tareas[index];
            document.getElementById('modalTitle').innerText = 'Editar Tarea';
            document.getElementById('tipo').value = tarea.tipo;
            document.getElementById('descripcion').value = tarea.descripcion;

            // Preseleccionar responsables
            const responsables = tarea.responsable;
            checkboxes.forEach(checkbox => {
                if (responsables.includes(checkbox.value)) {
                    checkbox.checked = true;
                }
            });

            document.getElementById('fechaEstimada').value = tarea.fechaEstimada;
            document.getElementById('notas').value = tarea.notas;
        } else {
            // Modo agregar
            document.getElementById('modalTitle').innerText = 'Agregar Tarea';
        }

        modal.style.display = 'block';
    }

    // Cerrar el modal
    window.cerrarModal = function() {
        document.getElementById('taskModal').style.display = 'none';
    }

    // Agregar o Editar Tarea
    document.getElementById('taskForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const tipo = document.getElementById('tipo').value.trim();
        const descripcion = document.getElementById('descripcion').value.trim();

        const responsableCheckboxes = document.querySelectorAll('#responsableCheckboxes input[type="checkbox"]');
        const responsables = [];
        responsableCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                responsables.push(checkbox.value);
            }
        });

        const fechaEstimada = document.getElementById('fechaEstimada').value;
        const notas = document.getElementById('notas').value.trim();

        // Validaciones
        if (!tipo || !descripcion || responsables.length === 0 || !fechaEstimada) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, completa todos los campos requeridos y selecciona al menos un responsable.',
            });
            return;
        }

        // Validar que la fecha estimada no sea en el pasado
        const fechaActual = new Date().toISOString().split('T')[0];
        if (fechaEstimada < fechaActual) {
            Swal.fire({
                icon: 'error',
                title: 'Fecha inválida',
                text: 'La fecha estimada de culminación no puede ser en el pasado.',
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
            await updateDoc(tareaRef, tarea);

            Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'La tarea ha sido actualizada exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
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
            await addDoc(collection(db, "tareas"), nuevaTarea);

            Swal.fire({
                icon: 'success',
                title: 'Añadido',
                text: 'La tarea ha sido agregada exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
        }

        cerrarModal();
    });

    // Actualizar la tabla
    function actualizarTabla() {
        taskTable.innerHTML = "";

        // Aplicar filtros y ordenamiento
        let tareasFiltradas = tareas.slice();

        // Aplicar filtros
        tareasFiltradas = tareasFiltradas.filter(tarea => filtrarTarea(tarea));

        // Ordenar tareas
        const sortOrder = sortOrderSelect.value;
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
            } else if (tarea.estado === "Completado") {
                claseEstado = 'estado-completado';
            }

            // Convertir array de responsables a cadena
            const responsablesStr = tarea.responsable.join(', ');

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
                        <option value="Completado" ${tarea.estado === 'Completado' ? 'selected' : ''}>Completado</option>
                    </select>
                </td>
                <td>${tarea.notas || '-'}</td>
            `;

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
                editarBtn.disabled = true;
                eliminarBtn.disabled = true;
            }
        }
    }

    // Filtrar tarea según los filtros activos
    function filtrarTarea(tarea) {
        const filtroTipo = filterTipo.value;
        const filtroResponsable = filterResponsable.value;
        const filtroFechaDesde = filterFechaDesde.value;
        const filtroFechaHasta = filterFechaHasta.value;
        const searchTerm = searchInput.value.toLowerCase();

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
        if (filterNoIniciado.checked) estadosSeleccionados.push("No Iniciado");
        if (filterEnProgreso.checked) estadosSeleccionados.push("En Progreso");
        if (filterCompletado.checked) estadosSeleccionados.push("Completado");

        if (!estadosSeleccionados.includes(tarea.estado)) {
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
                             tarea.notas.toLowerCase().includes(searchTerm);
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

        editarBtn.disabled = false;
        eliminarBtn.disabled = false;

        filaSeleccionada.dataset.index = index;
    }

    // Editar Tarea
    editarBtn.addEventListener('click', function() {
        if (filaSeleccionada) {
            const index = parseInt(filaSeleccionada.dataset.index, 10);
            abrirModal(index);
        }
    });

    // Eliminar Tarea
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
                    await deleteDoc(tareaRef);

                    filaSeleccionada = null;
                    editarBtn.disabled = true;
                    eliminarBtn.disabled = true;

                    Swal.fire(
                        'Eliminado!',
                        'La tarea ha sido eliminada.',
                        'success'
                    );
                }
            });
        }
    });

    // Cambiar el estado de una tarea
    window.cambiarEstado = async function(index, nuevoEstado) {
        const tarea = tareas[index];
        tarea.estado = nuevoEstado;
        if (nuevoEstado === "Completado" && tarea.fechaCulminacion === "") {
            tarea.fechaCulminacion = new Date().toISOString().split('T')[0];
        } else if (nuevoEstado !== "Completado") {
            tarea.fechaCulminacion = "";
        }

        const tareaRef = doc(db, "tareas", tarea.id);
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
    }

    // Listeners para filtros y ordenamiento
    sortOrderSelect.addEventListener('change', actualizarTabla);
    searchInput.addEventListener('input', actualizarTabla);
    filterTipo.addEventListener('change', actualizarTabla);
    filterResponsable.addEventListener('change', actualizarTabla);
    filterFechaDesde.addEventListener('change', actualizarTabla);
    filterFechaHasta.addEventListener('change', actualizarTabla);

    // Listeners para los checkboxes de estado
    filterNoIniciado.addEventListener('change', actualizarTabla);
    filterEnProgreso.addEventListener('change', actualizarTabla);
    filterCompletado.addEventListener('change', actualizarTabla);

    // Resetear filtros
    resetFiltersBtn.addEventListener('click', function() {
        filterTipo.value = "";
        filterResponsable.value = "";
        searchInput.value = "";
        filterFechaDesde.value = "";
        filterFechaHasta.value = "";
        sortOrderSelect.value = "fechaEstimadaAsc";
        filterNoIniciado.checked = true;
        filterEnProgreso.checked = true;
        filterCompletado.checked = true;
        actualizarTabla();
        Swal.fire({
            icon: 'info',
            title: 'Filtros Reseteados',
            text: 'Todos los filtros han sido reseteados.',
            timer: 1500,
            showConfirmButton: false
        });
    });

    // Cerrar el modal al hacer clic fuera de él
    window.onclick = function(event) {
        const modal = document.getElementById('taskModal');
        if (event.target == modal) {
            cerrarModal();
        }
    }
});
