// servicios.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCc_XNSGWjrl8eOmOvbSpxvsmgoLunI_pk",
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
    let servicios = [];
    let editarIndex = null;
    let filaSeleccionada = null;

    const servicioTable = document.getElementById("servicioTable").querySelector("tbody");
    const searchInput = document.getElementById('searchInput');
    const editarBtn = document.getElementById('editarBtn');
    const eliminarBtn = document.getElementById('eliminarBtn');

    const filterSucursal = document.getElementById('filterSucursal');
    const filterServicio = document.getElementById('filterServicio');
    const filterEstadoPago = document.getElementById('filterEstadoPago');
    const filterFechaDesde = document.getElementById('filterFechaDesde');
    const filterFechaHasta = document.getElementById('filterFechaHasta');
    const sortOrderSelect = document.getElementById('sortOrder');
    const resetFiltersBtn = document.getElementById('resetFilters');

    const tipoPagoSelect = document.getElementById('tipoPago');
    const tipoPagoFijoFields = document.getElementById('tipoPagoFijoFields');

    // Modales
    const registrarReciboModal = document.getElementById('registrarReciboModal');
    const reciboForm = document.getElementById('reciboForm');
    const mesesARegistrarContainer = document.getElementById('mesesARegistrar');
    const confirmarMesesBtn = document.getElementById('confirmarMesesBtn');
    const detalleReciboForm = document.getElementById('detalleReciboForm');
    const detallesPagosContainer = document.getElementById('detallesPagosContainer');
    const nombreServicioSpan = document.getElementById('nombreServicio');

    const verRecibosModal = document.getElementById('verRecibosModal');
    const checklistMeses = document.getElementById('checklistMeses');
    const listaRecibosPorMes = document.getElementById('listaRecibosPorMes');

    // Array de meses en español
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Obtener el nombre del mes actual
    const fechaActual = new Date();
    const mesActualIndex = fechaActual.getMonth(); // 0 - 11
    const mesActualNombre = meses[mesActualIndex];

    // Cargar servicios desde Firebase
    function cargarServicios() {
        const serviciosRef = collection(db, "servicios");
        onSnapshot(serviciosRef, (snapshot) => {
            servicios = [];
            snapshot.forEach((doc) => {
                const servicio = doc.data();
                servicio.id = doc.id;
                servicios.push(servicio);
            });
            actualizarTabla();
        });
    }

    cargarServicios();

    // Abrir el modal para Agregar/Editar Servicio
    window.abrirModal = function(index = null) {
        editarIndex = index;
        const modal = document.getElementById('servicioModal');
        const form = document.getElementById('servicioForm');
        form.reset();

        // Ocultar campos de Pago Fijo por defecto
        tipoPagoFijoFields.style.display = 'none';

        if (index !== null) {
            // Modo edición
            const servicio = servicios[index];
            document.getElementById('modalTitle').innerText = 'Editar Servicio';
            document.getElementById('sucursal').value = servicio.sucursal;
            document.getElementById('servicio').value = servicio.servicio;
            document.getElementById('tipoPago').value = servicio.tipoPago;
            document.getElementById('proveedorServicio').value = servicio.proveedorServicio || '';

            // Mostrar campos de Pago Fijo si es necesario
            if (servicio.tipoPago === 'Fijo') {
                tipoPagoFijoFields.style.display = 'block';
                document.getElementById('fechaPagoFijo').value = servicio.fechaPago || '';
                document.getElementById('montoAPagar').value = servicio.montoAPagar || '';
            }
        } else {
            // Modo agregar
            document.getElementById('modalTitle').innerText = 'Agregar Servicio';
        }

        modal.style.display = 'block';
    };

    // Mostrar/Ocultar campos según Tipo de Pago
    tipoPagoSelect.addEventListener('change', function() {
        if (this.value === 'Fijo') {
            tipoPagoFijoFields.style.display = 'block';
            document.getElementById('fechaPagoFijo').required = true;
            document.getElementById('montoAPagar').required = true;
        } else {
            tipoPagoFijoFields.style.display = 'none';
            document.getElementById('fechaPagoFijo').required = false;
            document.getElementById('montoAPagar').required = false;
            document.getElementById('fechaPagoFijo').value = '';
            document.getElementById('montoAPagar').value = '';
        }
    });

    // Cerrar el modal de Agregar/Editar Servicio
    window.cerrarModal = function() {
        document.getElementById('servicioModal').style.display = 'none';
    };

    // Agregar o Editar Servicio
    document.getElementById('servicioForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const sucursal = document.getElementById('sucursal').value.trim();
        const servicio = document.getElementById('servicio').value.trim();
        const tipoPago = document.getElementById('tipoPago').value;
        const fechaPagoFijo = document.getElementById('fechaPagoFijo').value;
        const montoAPagar = parseFloat(document.getElementById('montoAPagar').value);
        const proveedorServicio = document.getElementById('proveedorServicio').value.trim();

        // Validaciones
        if (!sucursal || !servicio || !tipoPago || !proveedorServicio ||
            (tipoPago === 'Fijo' && (!fechaPagoFijo || isNaN(montoAPagar) || montoAPagar < 0))) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, completa todos los campos requeridos correctamente.',
            });
            return;
        }

        // Validar que la fecha de pago no sea en el pasado si es Fijo
        if (tipoPago === 'Fijo') {
            const fechaActualISO = new Date().toISOString().split('T')[0];
            if (fechaPagoFijo < fechaActualISO) {
                Swal.fire({
                    icon: 'error',
                    title: 'Fecha inválida',
                    text: 'La fecha de pago no puede ser en el pasado.',
                });
                return;
            }
        }

        if (editarIndex !== null) {
            // Actualizar servicio existente
            const servicioActualizado = {
                ...servicios[editarIndex],
                sucursal,
                servicio,
                tipoPago,
                fechaPago: tipoPago === 'Fijo' ? fechaPagoFijo : '',
                montoAPagar: tipoPago === 'Fijo' ? montoAPagar : 0,
                proveedorServicio,
                estadoPago: servicios[editarIndex].estadoPago || 'Pendiente'
            };
            const servicioRef = doc(db, "servicios", servicioActualizado.id);
            await updateDoc(servicioRef, servicioActualizado);

            Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'El servicio ha sido actualizado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            // Agregar nuevo servicio
            const nuevoServicio = {
                sucursal,
                servicio,
                tipoPago,
                fechaPago: tipoPago === 'Fijo' ? fechaPagoFijo : '',
                montoAPagar: tipoPago === 'Fijo' ? montoAPagar : 0,
                proveedorServicio,
                estadoPago: 'Pendiente',
                historialPagos: [],
                mesesPagados: [],
                fechaCreacion: new Date().toISOString()
            };
            await addDoc(collection(db, "servicios"), nuevoServicio);

            Swal.fire({
                icon: 'success',
                title: 'Añadido',
                text: 'El servicio ha sido agregado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
        }

        cerrarModal();
    });

    // Actualizar la tabla
    function actualizarTabla() {
        servicioTable.innerHTML = "";

        // Aplicar filtros y ordenamiento
        let serviciosFiltrados = servicios.slice();

        // Aplicar filtros
        serviciosFiltrados = serviciosFiltrados.filter(servicio => filtrarServicio(servicio));

        // Ordenar servicios
        const sortOrder = sortOrderSelect.value;
        if (sortOrder === 'fechaPagoAsc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(a.fechaPago) - new Date(b.fechaPago);
            });
        } else if (sortOrder === 'fechaPagoDesc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(b.fechaPago) - new Date(a.fechaPago);
            });
        } else if (sortOrder === 'fechaCreacionDesc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(b.fechaCreacion || '1970-01-01') - new Date(a.fechaCreacion || '1970-01-01');
            });
        } else if (sortOrder === 'fechaCreacionAsc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(a.fechaCreacion || '9999-12-31') - new Date(b.fechaCreacion || '9999-12-31');
            });
        }

        serviciosFiltrados.forEach((servicio, index) => {
            const fila = document.createElement("tr");
            fila.dataset.index = index;
            fila.dataset.id = servicio.id;

            // Estado de Pago para el mes actual
            let estadoPagoActual = 'Pendiente';
            const recibosMesActual = servicio.historialPagos ? servicio.historialPagos.filter(pago => pago.mes === mesActualNombre) : [];
            if (recibosMesActual.length > 0) {
                const todosPagados = recibosMesActual.every(pago => pago.estadoPago === 'Pagado');
                estadoPagoActual = todosPagados ? 'Pagado' : 'Pendiente';
            }

            // Crear celdas
            const sucursalTd = document.createElement('td');
            sucursalTd.textContent = servicio.sucursal;

            const servicioTd = document.createElement('td');
            servicioTd.textContent = servicio.servicio;

            const proveedorTd = document.createElement('td');
            proveedorTd.textContent = servicio.proveedorServicio;

            const tipoPagoTd = document.createElement('td');
            tipoPagoTd.textContent = servicio.tipoPago;

            const estadoPagoTd = document.createElement('td');
            estadoPagoTd.textContent = estadoPagoActual;

            // Crear celdas para cada mes
            const mesesTd = meses.map(mes => {
                const recibosDelMes = servicio.historialPagos ? servicio.historialPagos.filter(pago => pago.mes === mes) : [];
                let simbolo = '×';

                if (recibosDelMes.length > 0) {
                    const todosPagados = recibosDelMes.every(pago => pago.estadoPago === 'Pagado');
                    if (todosPagados) {
                        simbolo = '✓';
                    } else {
                        simbolo = '⚠';
                    }
                }

                const td = document.createElement('td');
                td.textContent = simbolo;

                // Asignar clase según el símbolo para estilizar
                if (simbolo === '✓') {
                    td.classList.add('status-paid');
                } else if (simbolo === '×') {
                    td.classList.add('status-none');
                } else if (simbolo === '⚠') {
                    td.classList.add('status-pending');
                }

                return td;
            });

            // Botones de Acción
            const accionesTd = document.createElement('td');
            const verRecibosBtn = `<button class="ver-recibos-btn" onclick="abrirVerRecibosModal('${servicio.id}')">Ver Recibos</button>`;
            const registrarReciboBtn = `<button class="registrar-recibo-btn" onclick="abrirRegistrarReciboModal('${servicio.id}')">Registrar Recibo</button>`;
            accionesTd.innerHTML = `${verRecibosBtn} ${registrarReciboBtn}`;

            // Agregar todas las celdas a la fila
            fila.appendChild(sucursalTd);
            fila.appendChild(servicioTd);
            fila.appendChild(proveedorTd);
            fila.appendChild(tipoPagoTd);
            fila.appendChild(estadoPagoTd);
            mesesTd.forEach(td => fila.appendChild(td));
            fila.appendChild(accionesTd);

            // Evento de selección de fila
            fila.addEventListener('click', function(e) {
                if (e.target.classList.contains('ver-recibos-btn') || e.target.classList.contains('registrar-recibo-btn')) {
                    return;
                }
                seleccionarFila(this, servicios.indexOf(servicio));
            });

            servicioTable.appendChild(fila);
        });

        // Verificar si la fila seleccionada sigue visible
        if (filaSeleccionada) {
            const seleccionadaVisible = Array.from(servicioTable.children).some(fila => parseInt(fila.dataset.index) === parseInt(filaSeleccionada.dataset.index));
            if (!seleccionadaVisible) {
                filaSeleccionada = null;
                editarBtn.disabled = true;
                eliminarBtn.disabled = true;
            }
        }
    }

    // Filtrar servicio según los filtros activos
    function filtrarServicio(servicio) {
        const filtroSucursal = filterSucursal.value;
        const filtroServicio = filterServicio.value;
        const filtroEstadoPago = filterEstadoPago.value;
        const filtroFechaDesde = filterFechaDesde.value;
        const filtroFechaHasta = filterFechaHasta.value;
        const searchTerm = searchInput.value.toLowerCase();

        let cumple = true;

        // Filtro por Sucursal
        if (filtroSucursal && servicio.sucursal !== filtroSucursal) {
            cumple = false;
        }

        // Filtro por Servicio
        if (filtroServicio && servicio.servicio !== filtroServicio) {
            cumple = false;
        }

        // Filtro por Estado de Pago
        if (filtroEstadoPago && servicio.estadoPago !== filtroEstadoPago) {
            cumple = false;
        }

        // Filtro por Fecha de Pago Desde
        if (filtroFechaDesde && servicio.fechaPago < filtroFechaDesde) {
            cumple = false;
        }

        // Filtro por Fecha de Pago Hasta
        if (filtroFechaHasta && servicio.fechaPago > filtroFechaHasta) {
            cumple = false;
        }

        // Búsqueda general
        if (searchTerm) {
            const contiene = servicio.sucursal.toLowerCase().includes(searchTerm) ||
                             servicio.servicio.toLowerCase().includes(searchTerm) ||
                             servicio.tipoPago.toLowerCase().includes(searchTerm) ||
                             servicio.proveedorServicio.toLowerCase().includes(searchTerm) ||
                             (servicio.fechaPago || '').toLowerCase().includes(searchTerm) ||
                             (servicio.montoAPagar && (`Q. ${servicio.montoAPagar.toFixed(2)}`).includes(searchTerm)) ||
                             (servicio.estadoPago || '').toLowerCase().includes(searchTerm);
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

    // Editar Servicio
    editarBtn.addEventListener('click', function() {
        if (filaSeleccionada) {
            const index = parseInt(filaSeleccionada.dataset.index, 10);
            abrirModal(index);
        }
    });

    // Eliminar Servicio
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
                    const servicio = servicios[index];
                    const servicioRef = doc(db, "servicios", servicio.id);
                    await deleteDoc(servicioRef);

                    filaSeleccionada = null;
                    editarBtn.disabled = true;
                    eliminarBtn.disabled = true;

                    Swal.fire(
                        'Eliminado!',
                        'El servicio ha sido eliminado.',
                        'success'
                    );
                }
            });
        }
    });

    // Abrir el modal para Registrar Recibo
    window.abrirRegistrarReciboModal = function(servicioId) {
        const modal = document.getElementById('registrarReciboModal');

        // Obtener el servicio correspondiente
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        // Mostrar el nombre del servicio seleccionado
        nombreServicioSpan.innerText = `${servicio.servicio} - ${servicio.sucursal}`;

        // Generar el checklist de meses
        generarChecklistMeses(servicioId);

        modal.style.display = 'block';
    };

    // Generar checklist de meses para el servicio seleccionado
    function generarChecklistMeses(servicioId) {
        mesesARegistrarContainer.innerHTML = "";
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) return;

        meses.forEach((mes, idx) => {
            const checkboxId = `mesARegistrar${idx}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.value = mes;

            // Deshabilitar el checkbox si ya hay un recibo registrado para ese mes
            const yaRegistrado = servicio.historialPagos && servicio.historialPagos.some(pago => pago.mes === mes);
            if (yaRegistrado) {
                checkbox.disabled = true;
            }

            const label = document.createElement('label');
            label.htmlFor = checkboxId;
            label.innerText = mes;

            const wrapper = document.createElement('div');
            wrapper.classList.add('checkbox-wrapper');
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);

            mesesARegistrarContainer.appendChild(wrapper);
        });
    }

    // Confirmar meses seleccionados para registrar recibos
    confirmarMesesBtn.addEventListener('click', function() {
        const checkboxes = mesesARegistrarContainer.querySelectorAll('input[type="checkbox"]');
        const mesesSeleccionados = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                mesesSeleccionados.push(cb.value);
            }
        });

        if (mesesSeleccionados.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos un mes para registrar el recibo.',
            });
            return;
        }

        // Generar formularios para cada mes seleccionado
        detallesPagosContainer.innerHTML = "";
        mesesSeleccionados.forEach((mes, idx) => {
            const detalleDiv = document.createElement('div');
            detalleDiv.classList.add('detalle-pago');

            detalleDiv.innerHTML = `
                <h4>${mes}</h4>
                <label for="numeroRecibo${idx}">Número de Recibo:</label>
                <input type="text" id="numeroRecibo${idx}" required>

                <label for="fechaPago${idx}">Fecha de Pago:</label>
                <input type="date" id="fechaPago${idx}" required>

                <label for="cantidadAPagar${idx}">Cantidad a Pagar (Q.):</label>
                <input type="number" id="cantidadAPagar${idx}" min="0" step="0.01" required>
            `;

            detallesPagosContainer.appendChild(detalleDiv);
        });

        detalleReciboForm.style.display = 'block';
    });

    // Registrar recibos
    detalleReciboForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const servicioId = servicios.find(s => `${s.servicio} - ${s.sucursal}` === nombreServicioSpan.innerText)?.id;
        if (!servicioId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        // Obtener el servicio correspondiente
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        // Obtener meses seleccionados
        const checkboxes = mesesARegistrarContainer.querySelectorAll('input[type="checkbox"]');
        const mesesSeleccionados = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                mesesSeleccionados.push(cb.value);
            }
        });

        const nuevosPagos = [];
        for (let i = 0; i < mesesSeleccionados.length; i++) {
            const mes = mesesSeleccionados[i];
            const numeroRecibo = document.getElementById(`numeroRecibo${i}`).value.trim();
            const fechaPago = document.getElementById(`fechaPago${i}`).value;
            const cantidadAPagar = parseFloat(document.getElementById(`cantidadAPagar${i}`).value);

            // Validaciones
            if (!numeroRecibo || isNaN(cantidadAPagar) || cantidadAPagar < 0 || !fechaPago) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: `Por favor, completa todos los campos para el mes de ${mes}.`,
                });
                return;
            }

            // Validar que la fecha de pago no sea en el pasado
            const fechaActualISO = new Date().toISOString().split('T')[0];
            if (fechaPago < fechaActualISO) {
                Swal.fire({
                    icon: 'error',
                    title: 'Fecha inválida',
                    text: `La fecha de pago para el mes de ${mes} no puede ser en el pasado.`,
                });
                return;
            }

            // Verificar si ya existe un recibo para este mes y número de recibo
            const existeRecibo = servicio.historialPagos && servicio.historialPagos.some(pago => pago.mes === mes && pago.numeroRecibo === numeroRecibo);
            if (existeRecibo) {
                Swal.fire({
                    icon: 'error',
                    title: 'Recibo Duplicado',
                    text: `Ya existe un recibo con el número "${numeroRecibo}" para el mes de ${mes}.`,
                });
                return;
            }

            nuevosPagos.push({
                mes,
                numeroRecibo,
                fechaPago,
                cantidadAPagar,
                estadoPago: 'Pendiente',
                boletaPago: null
            });
        }

        // Confirmar Registro de Recibos
        Swal.fire({
            title: 'Confirmar Registro de Recibos',
            html: generarHTMLConfirmacionRecibos(mesesSeleccionados, nuevosPagos),
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            cancelButtonText: 'Cancelar',
            width: '600px'
        }).then(async (result) => {
            if (result.isConfirmed) {
                // Actualizar el historial de pagos
                const historialPagosActualizado = servicio.historialPagos ? [...servicio.historialPagos, ...nuevosPagos] : [...nuevosPagos];

                // Actualizar los meses pagados
                const mesesPagadosActualizados = servicio.mesesPagados ? [...new Set([...servicio.mesesPagados, ...mesesSeleccionados])] : [...mesesSeleccionados];

                // Determinar el estado de pago
                const estadoPagoActualizado = historialPagosActualizado.length > 0 ? "Pagado" : "Pendiente";

                // Actualizar el servicio en Firestore
                const servicioRef = doc(db, "servicios", servicioId);
                await updateDoc(servicioRef, {
                    historialPagos: historialPagosActualizado,
                    mesesPagados: mesesPagadosActualizados,
                    estadoPago: estadoPagoActualizado
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Recibos Registrados',
                    text: 'Los recibos han sido registrados exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });

                cerrarReciboModal();
            }
        });
    });

    // Función para generar el HTML de confirmación de recibos
    function generarHTMLConfirmacionRecibos(mesesSeleccionados, nuevosPagos) {
        let html = '<ul>';
        nuevosPagos.forEach(pago => {
            html += `<li><strong>${pago.mes}:</strong> Recibo ${pago.numeroRecibo}, Fecha de Pago: ${new Date(pago.fechaPago).toLocaleDateString('es-ES')}, Cantidad: Q. ${pago.cantidadAPagar.toFixed(2)}</li>`;
        });
        html += '</ul>';
        return html;
    }

    // Cerrar el modal de Registrar Recibo
    window.cerrarReciboModal = function() {
        registrarReciboModal.style.display = 'none';
        reciboForm.reset();
        detalleReciboForm.style.display = 'none';
        detallesPagosContainer.innerHTML = "";
        nombreServicioSpan.innerText = '-';
        // Rehabilitar los botones de registrar recibo
        const registrarReciboBtns = document.querySelectorAll('.registrar-recibo-btn');
        registrarReciboBtns.forEach(btn => {
            btn.disabled = false;
        });
    };

    // Abrir el modal para Ver Recibos
    window.abrirVerRecibosModal = function(servicioId) {
        const modal = document.getElementById('verRecibosModal');

        // Obtener el servicio correspondiente
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        // Generar el checklist de meses
        generarChecklistMesesVerRecibos(servicio);

        // Generar la lista de recibos por mes
        generarListaRecibosPorMes(servicio);

        modal.style.display = 'block';
    };

    // Cerrar el modal de Ver Recibos
    window.cerrarVerRecibosModal = function() {
        verRecibosModal.style.display = 'none';
        checklistMeses.innerHTML = "";
        listaRecibosPorMes.innerHTML = "";
    };

    // Generar checklist de meses para ver recibos
    function generarChecklistMesesVerRecibos(servicio) {
        checklistMeses.innerHTML = "";
        meses.forEach((mes, idx) => {
            const checkboxId = `verReciboMes${idx}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.value = mes;
            checkbox.disabled = true;
            checkbox.checked = servicio.historialPagos && servicio.historialPagos.some(pago => pago.mes === mes && pago.estadoPago === 'Pagado');

            const label = document.createElement('label');
            label.htmlFor = checkboxId;
            label.innerText = mes;

            const wrapper = document.createElement('div');
            wrapper.classList.add('checkbox-wrapper');
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);

            checklistMeses.appendChild(wrapper);
        });
    }

    // Generar la lista de recibos por mes
    function generarListaRecibosPorMes(servicio) {
        listaRecibosPorMes.innerHTML = "";
        meses.forEach(mes => {
            const recibosDelMes = servicio.historialPagos ? servicio.historialPagos.filter(pago => pago.mes === mes) : [];

            if (recibosDelMes.length > 0) {
                const mesDiv = document.createElement('div');
                mesDiv.classList.add('mes-recibos');

                const mesTitle = document.createElement('h3');
                mesTitle.innerText = mes;
                mesDiv.appendChild(mesTitle);

                recibosDelMes.forEach((recibo, idx) => {
                    const reciboDiv = document.createElement('div');
                    reciboDiv.classList.add('recibo');

                    // Información de Boleta de Pago si existe
                    let boletaInfo = '';
                    if (recibo.boletaPago) {
                        boletaInfo = `
                            <p><strong>Banco:</strong> ${recibo.boletaPago.banco}</p>
                            <p><strong>Número de Boleta:</strong> ${recibo.boletaPago.numeroBoleta}</p>
                            <p><strong>Fecha:</strong> ${new Date(recibo.boletaPago.fecha).toLocaleDateString('es-ES')}</p>
                            <p><strong>Tipo de Pago:</strong> ${recibo.boletaPago.tipoPago}</p>
                            ${
                                recibo.boletaPago.cantidadPagada !== undefined && !isNaN(recibo.boletaPago.cantidadPagada)
                                ? `<p><strong>Cantidad Pagada:</strong> Q. ${parseFloat(recibo.boletaPago.cantidadPagada).toFixed(2)}</p>`
                                : ''
                            }
                        `;
                    }

                    reciboDiv.innerHTML = `
                        <p><strong>Número de Recibo:</strong> ${recibo.numeroRecibo}</p>
                        <p><strong>Fecha de Pago:</strong> ${new Date(recibo.fechaPago).toLocaleDateString('es-ES')}</p>
                        ${
                            recibo.cantidadAPagar !== undefined && !isNaN(recibo.cantidadAPagar)
                            ? `<p><strong>Cantidad a Pagar:</strong> Q. ${parseFloat(recibo.cantidadAPagar).toFixed(2)}</p>`
                            : ''
                        }
                        <p><strong>Estado de Pago:</strong> <span class="${recibo.estadoPago === 'Pagado' ? 'estado-pagado' : 'estado-pendiente'}">${recibo.estadoPago}</span></p>
                        ${boletaInfo}
                    `;

                    if (recibo.estadoPago === 'Pendiente') {
                        const registrarPagoBtn = document.createElement('button');
                        registrarPagoBtn.classList.add('registrar-pago-btn');
                        registrarPagoBtn.innerText = 'Registrar Pago';
                        registrarPagoBtn.onclick = () => registrarPagoRecibo(servicio.id, recibo.numeroRecibo);
                        reciboDiv.appendChild(registrarPagoBtn);
                    }

                    // Botones para Editar y Eliminar Recibo
                    const botonesRecibo = document.createElement('div');
                    botonesRecibo.classList.add('botones-recibo');

                    const editarReciboBtn = document.createElement('button');
                    editarReciboBtn.classList.add('editar-recibo-btn');
                    editarReciboBtn.innerText = 'Editar';
                    editarReciboBtn.onclick = () => editarRecibo(servicio.id, recibo.numeroRecibo);

                    const eliminarReciboBtn = document.createElement('button');
                    eliminarReciboBtn.classList.add('eliminar-recibo-btn');
                    eliminarReciboBtn.innerText = 'Eliminar';
                    eliminarReciboBtn.onclick = () => eliminarRecibo(servicio.id, recibo.numeroRecibo);

                    botonesRecibo.appendChild(editarReciboBtn);
                    botonesRecibo.appendChild(eliminarReciboBtn);

                    reciboDiv.appendChild(botonesRecibo);

                    mesDiv.appendChild(reciboDiv);
                });

                listaRecibosPorMes.appendChild(mesDiv);
            }
        });
    }

    // Función para registrar el pago de un recibo pendiente
    window.registrarPagoRecibo = async function(servicioId, numeroRecibo) {
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        const reciboIndex = servicio.historialPagos.findIndex(pago => pago.numeroRecibo === numeroRecibo);
        if (reciboIndex === -1) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Recibo no encontrado.',
            });
            return;
        }

        // Validar que el recibo aún esté pendiente
        if (servicio.historialPagos[reciboIndex].estadoPago === 'Pagado') {
            Swal.fire({
                icon: 'info',
                title: 'Recibo ya Pagado',
                text: 'Este recibo ya ha sido marcado como pagado.',
            });
            return;
        }

        // Mostrar formulario para ingresar información de Boleta de Pago y Cantidad Pagada
        const { value: formValues } = await Swal.fire({
            title: `Registrar Pago - Recibo ${numeroRecibo}`,
            html:
                `<input id="swal-input1" class="swal2-input" placeholder="Banco">` +
                `<input id="swal-input2" class="swal2-input" placeholder="Número de Boleta">` +
                `<input id="swal-input3" type="date" class="swal2-input" placeholder="Fecha">` +
                `<select id="swal-input4" class="swal2-input">
                    <option value="" disabled selected>Selecciona Tipo de Pago</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Depósito">Depósito</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Efectivo">Efectivo</option>
                </select>` +
                `<input id="swal-input5" type="number" class="swal2-input" placeholder="Cantidad Pagada (Q.)" min="0" step="0.01">`,
            focusConfirm: false,
            preConfirm: () => {
                const banco = document.getElementById('swal-input1').value.trim();
                const numeroBoleta = document.getElementById('swal-input2').value.trim();
                const fecha = document.getElementById('swal-input3').value;
                const tipoPago = document.getElementById('swal-input4').value;
                const cantidadPagada = parseFloat(document.getElementById('swal-input5').value);

                if (!banco || !numeroBoleta || !fecha || !tipoPago || isNaN(cantidadPagada) || cantidadPagada <= 0) {
                    Swal.showValidationMessage(`Por favor, completa todos los campos correctamente.`);
                }

                return { banco, numeroBoleta, fecha, tipoPago, cantidadPagada };
            }
        });

        if (formValues) {
            const { banco, numeroBoleta, fecha, tipoPago, cantidadPagada } = formValues;

            // Confirmar registro del pago
            const { isConfirmed } = await Swal.fire({
                title: `Confirmar Pago - Recibo ${numeroRecibo}`,
                html: `<p><strong>Cantidad Pagada:</strong> Q. ${cantidadPagada.toFixed(2)}</p>`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#388e3c',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, registrar',
                cancelButtonText: 'Cancelar'
            });

            if (isConfirmed) {
                // Actualizar el recibo en Firestore
                servicio.historialPagos[reciboIndex].estadoPago = 'Pagado';
                servicio.historialPagos[reciboIndex].boletaPago = { banco, numeroBoleta, fecha, tipoPago, cantidadPagada };
                servicio.historialPagos[reciboIndex].cantidadPagada = cantidadPagada;

                // Actualizar el estado de pago del servicio si todos los recibos están pagados
                const todosPagados = servicio.historialPagos.every(pago => pago.estadoPago === 'Pagado');
                servicio.estadoPago = todosPagados ? 'Pagado' : 'Pendiente';

                const servicioRef = doc(db, "servicios", servicioId);
                await updateDoc(servicioRef, {
                    historialPagos: servicio.historialPagos,
                    estadoPago: servicio.estadoPago
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Pago Registrado',
                    text: `El recibo ${numeroRecibo} ha sido marcado como Pagado.`,
                    timer: 1500,
                    showConfirmButton: false
                });

                // Actualizar la vista de recibos
                cargarServicios();
                abrirVerRecibosModal(servicioId);
            }
        }
    };

    // Modificar la función editarRecibo para permitir editar la cantidad pagada
    window.editarRecibo = async function(servicioId, numeroRecibo) {
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        const reciboIndex = servicio.historialPagos.findIndex(pago => pago.numeroRecibo === numeroRecibo);
        if (reciboIndex === -1) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Recibo no encontrado.',
            });
            return;
        }

        const recibo = servicio.historialPagos[reciboIndex];

        // Mostrar formulario con la información existente
        const { value: boletaPagoActualizada } = await Swal.fire({
            title: `Editar Boleta de Pago - Recibo ${numeroRecibo}`,
            html:
                `<input id="swal-input1" class="swal2-input" placeholder="Banco" value="${recibo.boletaPago ? recibo.boletaPago.banco : ''}">` +
                `<input id="swal-input2" class="swal2-input" placeholder="Número de Boleta" value="${recibo.boletaPago ? recibo.boletaPago.numeroBoleta : ''}">` +
                `<input id="swal-input3" type="date" class="swal2-input" placeholder="Fecha" value="${recibo.boletaPago ? recibo.boletaPago.fecha : ''}">` +
                `<select id="swal-input4" class="swal2-input">
                    <option value="" disabled ${!recibo.boletaPago ? 'selected' : ''}>Selecciona Tipo de Pago</option>
                    <option value="Transferencia" ${recibo.boletaPago && recibo.boletaPago.tipoPago === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                    <option value="Depósito" ${recibo.boletaPago && recibo.boletaPago.tipoPago === 'Depósito' ? 'selected' : ''}>Depósito</option>
                    <option value="Cheque" ${recibo.boletaPago && recibo.boletaPago.tipoPago === 'Cheque' ? 'selected' : ''}>Cheque</option>
                    <option value="Efectivo" ${recibo.boletaPago && recibo.boletaPago.tipoPago === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                </select>` +
                `<input id="swal-input5" type="number" class="swal2-input" placeholder="Cantidad Pagada (Q.)" min="0" step="0.01" value="${recibo.boletaPago && recibo.boletaPago.cantidadPagada !== undefined ? recibo.boletaPago.cantidadPagada : ''}">`,
            focusConfirm: false,
            preConfirm: () => {
                const banco = document.getElementById('swal-input1').value.trim();
                const numeroBoleta = document.getElementById('swal-input2').value.trim();
                const fecha = document.getElementById('swal-input3').value;
                const tipoPago = document.getElementById('swal-input4').value;
                const cantidadPagada = parseFloat(document.getElementById('swal-input5').value);

                if (!banco || !numeroBoleta || !fecha || !tipoPago || isNaN(cantidadPagada) || cantidadPagada <= 0) {
                    Swal.showValidationMessage(`Por favor, completa todos los campos correctamente.`);
                }

                return { banco, numeroBoleta, fecha, tipoPago, cantidadPagada };
            }
        });

        if (boletaPagoActualizada) {
            // Confirmar edición del recibo
            const { isConfirmed } = await Swal.fire({
                title: `Confirmar Edición - Recibo ${numeroRecibo}`,
                text: `¿Estás seguro de actualizar la boleta de pago de este recibo?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#388e3c',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, actualizar',
                cancelButtonText: 'Cancelar'
            });

            if (isConfirmed) {
                // Actualizar el recibo en Firestore
                servicio.historialPagos[reciboIndex].boletaPago = boletaPagoActualizada;
                servicio.historialPagos[reciboIndex].cantidadPagada = boletaPagoActualizada.cantidadPagada;

                const servicioRef = doc(db, "servicios", servicioId);
                await updateDoc(servicioRef, {
                    historialPagos: servicio.historialPagos
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Boleta Actualizada',
                    text: `La boleta de pago del recibo ${numeroRecibo} ha sido actualizada exitosamente.`,
                    timer: 1500,
                    showConfirmButton: false
                });

                // Actualizar la vista de recibos
                cargarServicios();
                abrirVerRecibosModal(servicioId);
            }
        }
    };

    // Función para eliminar un recibo
    window.eliminarRecibo = async function(servicioId, numeroRecibo) {
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        const reciboIndex = servicio.historialPagos.findIndex(pago => pago.numeroRecibo === numeroRecibo);
        if (reciboIndex === -1) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Recibo no encontrado.',
            });
            return;
        }

        // Confirmar eliminación del recibo
        const { isConfirmed } = await Swal.fire({
            title: `Eliminar Recibo ${numeroRecibo}`,
            text: "¿Estás seguro de eliminar este recibo? Esta acción no se puede revertir.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (isConfirmed) {
            // Eliminar el recibo del historial
            servicio.historialPagos.splice(reciboIndex, 1);

            // Determinar el estado de pago del servicio
            const estadoPagoActualizado = servicio.historialPagos.length > 0 ?
                (servicio.historialPagos.every(pago => pago.estadoPago === 'Pagado') ? 'Pagado' : 'Pendiente') :
                'Pendiente';

            servicio.estadoPago = estadoPagoActualizado;

            // Actualizar el servicio en Firestore
            const servicioRef = doc(db, "servicios", servicioId);
            await updateDoc(servicioRef, {
                historialPagos: servicio.historialPagos,
                estadoPago: servicio.estadoPago
            });

            Swal.fire({
                icon: 'success',
                title: 'Recibo Eliminado',
                text: `El recibo ${numeroRecibo} ha sido eliminado exitosamente.`,
                timer: 1500,
                showConfirmButton: false
            });

            // Actualizar la vista de recibos
            cargarServicios();
            abrirVerRecibosModal(servicioId);
        }
    };

    // Listeners para filtros y ordenamiento
    sortOrderSelect.addEventListener('change', actualizarTabla);
    searchInput.addEventListener('input', actualizarTabla);
    filterSucursal.addEventListener('change', actualizarTabla);
    filterServicio.addEventListener('change', actualizarTabla);
    filterEstadoPago.addEventListener('change', actualizarTabla);
    filterFechaDesde.addEventListener('change', actualizarTabla);
    filterFechaHasta.addEventListener('change', actualizarTabla);

    // Resetear filtros
    resetFiltersBtn.addEventListener('click', function() {
        filterSucursal.value = "";
        filterServicio.value = "";
        filterEstadoPago.value = "";
        filterFechaDesde.value = "";
        filterFechaHasta.value = "";
        searchInput.value = "";
        sortOrderSelect.value = "fechaPagoAsc";
        actualizarTabla();
        Swal.fire({
            icon: 'info',
            title: 'Filtros Reseteados',
            text: 'Todos los filtros han sido reseteados.',
            timer: 1500,
            showConfirmButton: false
        });
    });

    // Cerrar los modales al hacer clic fuera de ellos
    window.onclick = function(event) {
        const modal = document.getElementById('servicioModal');
        if (event.target == modal) {
            cerrarModal();
        }

        const reciboModal = document.getElementById('registrarReciboModal');
        if (event.target == reciboModal) {
            cerrarReciboModal();
        }

        const verRecibosModalTarget = document.getElementById('verRecibosModal');
        if (event.target == verRecibosModalTarget) {
            cerrarVerRecibosModal();
        }
    };
});
