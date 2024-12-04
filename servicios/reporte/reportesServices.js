// reportesServices.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
    // Reemplaza estos valores con tu configuración real de Firebase
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
    let tiposServicios = [];

    const filterForm = document.getElementById('filterForm');
    const reportContainer = document.getElementById('reportContainer');
    const fechaInicioInput = document.getElementById('fechaInicio');
    const fechaFinInput = document.getElementById('fechaFin');
    const filterSucursal = document.getElementById('filterSucursal');
    const filterServicio = document.getElementById('filterServicio');
    const filterEstadoPago = document.getElementById('filterEstadoPago');
    const reportModal = document.getElementById('reportModal');
    const exportBtn = document.getElementById('exportBtn');
    const backToServicesBtn = document.getElementById('backToServicesBtn');
    const closeModalBtn = document.querySelector('.close');

    // Variables para almacenar los filtros seleccionados
    let tiposReporteSeleccionados = [];
    let sucursalSeleccionada = '';
    let servicioSeleccionado = '';
    let fechaInicioSeleccionada = '';
    let fechaFinSeleccionada = '';

    // Establecer fechas por defecto (fecha actual)
    const now = new Date();
    const fechaActualISO = now.toISOString().slice(0, 10); // YYYY-MM-DD
    fechaInicioInput.value = fechaActualISO;
    fechaFinInput.value = fechaActualISO;

    // Array de meses en español
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Cargar tipos de servicio desde Firestore
    function cargarTiposServicios() {
        const tiposServiciosRef = collection(db, "tiposServicios");
        const q = query(tiposServiciosRef, orderBy("nombre", "asc"));
        onSnapshot(q, (snapshot) => {
            tiposServicios = [];
            snapshot.forEach((doc) => {
                const tipo = doc.data();
                tipo.id = doc.id;
                tiposServicios.push(tipo);
            });
            actualizarSelectServicios();
        });
    }

    cargarTiposServicios();

    // Actualizar el select de servicios con tipos de servicio
    function actualizarSelectServicios() {
        const servicioSelect = document.getElementById('filterServicio');
        // Nota: La opción "Todos los Servicios" ya está presente en el HTML, no es necesario agregarla aquí
        tiposServicios.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.nombre;
            option.textContent = tipo.nombre;
            servicioSelect.appendChild(option);
        });
    }

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
        });
    }

    cargarServicios();

    // Manejar el envío del formulario de filtros
    filterForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Obtener valores de filtros
        const fechaInicio = fechaInicioInput.value;
        const fechaFin = fechaFinInput.value;
        fechaInicioSeleccionada = fechaInicioInput.value;
        fechaFinSeleccionada = fechaFinInput.value;
        sucursalSeleccionada = filterSucursal.value || 'Todas las Sucursales';
        servicioSeleccionado = filterServicio.value;
        const estadoPago = filterEstadoPago.value;

        // Obtener tipos de reporte seleccionados
        const tiposReporteCheckboxes = document.querySelectorAll('input[name="tipoReporte"]:checked');
        tiposReporteSeleccionados = Array.from(tiposReporteCheckboxes).map(cb => cb.value);

        // Validaciones
        if (tiposReporteSeleccionados.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Tipo de Reporte Requerido',
                text: 'Por favor, selecciona al menos un tipo de reporte.',
            });
            return;
        }

        if (tiposReporteSeleccionados.includes('estadisticas') && (!servicioSeleccionado || servicioSeleccionado === 'todos')) {
            Swal.fire({
                icon: 'warning',
                title: 'Servicio Requerido para Estadísticas',
                text: 'Por favor, selecciona un servicio específico para generar las estadísticas.',
            });
            return;
        }

        // Validar fechas solo si no se seleccionó "estadisticas"
        if (!tiposReporteSeleccionados.includes('estadisticas')) {
            if (!fechaInicio || !fechaFin) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Fechas Requeridas',
                    text: 'Por favor, selecciona la fecha de inicio y fin.',
                });
                return;
            }

            if (new Date(fechaInicio) > new Date(fechaFin)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Fechas Inválidas',
                    text: 'La fecha de inicio no puede ser posterior a la fecha de fin.',
                });
                return;
            }
        }

        // Filtrar servicios
        let serviciosFiltrados = servicios.filter(servicio => {
            // Filtrar por sucursal
            if (filterSucursal.value && servicio.sucursal !== filterSucursal.value) {
                return false;
            }

            // Filtrar por servicio
            if (servicioSeleccionado && servicioSeleccionado !== 'todos' && servicio.servicio !== servicioSeleccionado) {
                return false;
            }

            // Filtrar por estado de pago
            if (estadoPago) {
                const estadoPagoServicio = calcularEstadoPagoServicio(servicio);
                if (estadoPagoServicio !== estadoPago) {
                    return false;
                }
            }

            return true;
        });

        // Generar reportes según los tipos seleccionados
        generarReportes(serviciosFiltrados, tiposReporteSeleccionados, fechaInicio, fechaFin);

        // Mostrar el modal con el reporte
        reportModal.style.display = 'block';
    });

    // Cerrar el modal
    closeModalBtn.addEventListener('click', () => {
        reportModal.style.display = 'none';
        reportContainer.innerHTML = ''; // Limpiar el contenedor del reporte
    });

    window.addEventListener('click', (event) => {
        if (event.target === reportModal) {
            reportModal.style.display = 'none';
            reportContainer.innerHTML = ''; // Limpiar el contenedor del reporte
        }
    });

    // Función para calcular el estado de pago del servicio
    function calcularEstadoPagoServicio(servicio) {
        if (servicio.historialPagos && servicio.historialPagos.length > 0) {
            const todosPagados = servicio.historialPagos.every(pago => pago.estadoPago === 'Pagado');
            return todosPagados ? 'Pagado' : 'Pendiente';
        } else {
            return 'Pendiente';
        }
    }

    // Función para generar los reportes
    function generarReportes(serviciosFiltrados, tiposReporteSeleccionados, fechaInicio, fechaFin) {
        reportContainer.innerHTML = "";

        // Convertir los tipos de reporte seleccionados a texto para mostrar en el encabezado
        const tiposReporteTextos = tiposReporteSeleccionados.map(tipo => {
            switch (tipo) {
                case 'detallado':
                    return 'Detallado por Mes';
                case 'pagado':
                    return 'Pagado';
                case 'pendiente':
                    return 'Pendiente';
                case 'noPagado':
                    return 'No Pagado';
                case 'recibos':
                    return 'Recibos y Pagos';
                case 'estadisticas':
                    return 'Estadísticas';
                case 'todos':
                    return 'Todos';
                default:
                    return tipo;
            }
        }).join(', ');

        // Crear encabezado del reporte
        const encabezado = document.createElement('div');
        encabezado.classList.add('report-header');
        encabezado.innerHTML = `
            <h1>Reporte de Servicios</h1>
            <p><strong>Tipo de Reporte:</strong> ${tiposReporteTextos}</p>
            <p><strong>Sucursal:</strong> ${sucursalSeleccionada || 'Todas las Sucursales'}</p>
            <p><strong>Servicio:</strong> ${servicioSeleccionado !== 'todos' ? servicioSeleccionado : 'Todos los Servicios'}</p>
            ${!tiposReporteSeleccionados.includes('estadisticas') ? `
            <p><strong>Fecha Inicio:</strong> ${new Date(fechaInicioSeleccionada).toLocaleDateString('es-ES')}</p>
            <p><strong>Fecha Fin:</strong> ${new Date(fechaFinSeleccionada).toLocaleDateString('es-ES')}</p>
            ` : ''}
            <hr>
        `;
        reportContainer.appendChild(encabezado);

        // Generar reportes según cada tipo seleccionado
        tiposReporteSeleccionados.forEach(tipoReporte => {
            switch (tipoReporte) {
                case 'detallado':
                    generarReporteDetallado(serviciosFiltrados, fechaInicio, fechaFin);
                    break;
                case 'pagado':
                    generarReportePagado(serviciosFiltrados, fechaInicio, fechaFin);
                    break;
                case 'pendiente':
                    generarReportePendiente(serviciosFiltrados, fechaInicio, fechaFin);
                    break;
                case 'noPagado':
                    generarReporteNoPagado(serviciosFiltrados, fechaInicio, fechaFin);
                    break;
                case 'recibos':
                    generarReporteRecibos(serviciosFiltrados, fechaInicio, fechaFin);
                    break;
                case 'estadisticas':
                    generarReporteEstadisticas(serviciosFiltrados);
                    break;
                case 'todos':
                    generarReporteTodos(serviciosFiltrados, fechaInicio, fechaFin);
                    break;
                default:
                    break;
            }
        });
    }

    // Función para generar reporte detallado por mes
    function generarReporteDetallado(servicios, fechaInicio, fechaFin) {
        const titleElement = document.createElement('h2');
        titleElement.innerText = 'Reporte Detallado por Mes';
        reportContainer.appendChild(titleElement);

        servicios.forEach(servicio => {
            const servicioDiv = document.createElement('div');
            servicioDiv.classList.add('servicio-detalle');

            // Incluir ubicación y proveedor en el título
            const servicioHeader = document.createElement('h3');
            servicioHeader.innerText = `${servicio.servicio} - ${servicio.sucursal} - Ubicación: ${servicio.ubicacion || 'Sin Ubicación'} - Proveedor: ${servicio.proveedorServicio}`;
            servicioDiv.appendChild(servicioHeader);

            const table = document.createElement('table');
            table.classList.add('report-table');

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Mes</th>
                    <th>Número de Recibo</th>
                    <th>Cantidad a Pagar</th>
                    <th>Estado de Pago</th>
                    <th>Datos de Pago</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            meses.forEach(mes => {
                const pagosDelMes = servicio.historialPagos ? servicio.historialPagos.filter(pago => {
                    const fechaPago = new Date(pago.fechaPago);
                    return pago.mes === mes && fechaPago >= new Date(fechaInicio) && fechaPago <= new Date(fechaFin);
                }) : [];

                if (pagosDelMes.length > 0) {
                    pagosDelMes.forEach(pago => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${mes}</td>
                            <td>${pago.numeroRecibo}</td>
                            <td>Q. ${parseFloat(pago.cantidadAPagar).toFixed(2)}</td>
                            <td>${pago.estadoPago}</td>
                            <td>${pago.estadoPago === 'Pagado' && pago.boletaPago ? `
                                Banco: ${pago.boletaPago.banco}, 
                                Número Boleta: ${pago.boletaPago.numeroBoleta}, 
                                Fecha: ${new Date(pago.boletaPago.fecha).toLocaleDateString('es-ES')}, 
                                Tipo de Pago: ${pago.boletaPago.tipoPago}, 
                                Cantidad Pagada: Q. ${parseFloat(pago.boletaPago.cantidadPagada).toFixed(2)}
                            ` : 'N/A'}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                } else {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${mes}</td>
                        <td>No Registrado</td>
                        <td>N/A</td>
                        <td>No Registrado</td>
                        <td>N/A</td>
                    `;
                    tbody.appendChild(tr);
                }
            });

            table.appendChild(tbody);
            servicioDiv.appendChild(table);
            reportContainer.appendChild(servicioDiv);
        });
    }

    // Función para generar reporte de servicios pagados
    function generarReportePagado(servicios, fechaInicio, fechaFin) {
        const serviciosPagados = servicios.filter(servicio => {
            const estadoPago = calcularEstadoPagoServicio(servicio);
            return estadoPago === 'Pagado';
        });

        mostrarTablaServicios(serviciosPagados, 'Servicios Pagados', fechaInicio, fechaFin);
    }

    // Función para generar reporte de servicios pendientes
    function generarReportePendiente(servicios, fechaInicio, fechaFin) {
        const serviciosPendientes = servicios.filter(servicio => {
            const estadoPago = calcularEstadoPagoServicio(servicio);
            return estadoPago === 'Pendiente';
        });

        mostrarTablaServicios(serviciosPendientes, 'Servicios Pendientes', fechaInicio, fechaFin);
    }

    // Función para generar reporte de servicios no pagados (sin historial de pagos)
    function generarReporteNoPagado(servicios, fechaInicio, fechaFin) {
        const serviciosNoPagados = servicios.filter(servicio => {
            return !servicio.historialPagos || servicio.historialPagos.length === 0;
        });

        mostrarTablaServicios(serviciosNoPagados, 'Servicios No Pagados', fechaInicio, fechaFin);
    }

    // Función para generar reporte de recibos y pagos
    function generarReporteRecibos(servicios, fechaInicio, fechaFin) {
        const recibos = [];

        servicios.forEach(servicio => {
            if (servicio.historialPagos && servicio.historialPagos.length > 0) {
                servicio.historialPagos.forEach(pago => {
                    const fechaPago = new Date(pago.fechaPago);
                    if (fechaPago >= new Date(fechaInicio) && fechaPago <= new Date(fechaFin)) {
                        recibos.push({
                            servicio: servicio.servicio,
                            sucursal: servicio.sucursal,
                            proveedorServicio: servicio.proveedorServicio,
                            numeroRecibo: pago.numeroRecibo,
                            fechaPago: pago.fechaPago,
                            cantidadAPagar: pago.cantidadAPagar,
                            estadoPago: pago.estadoPago,
                            boletaPago: pago.boletaPago || null
                        });
                    }
                });
            }
        });

        mostrarTablaRecibos(recibos, 'Recibos y Pagos', fechaInicio, fechaFin);
    }

    // Función para generar reporte de estadísticas
    function generarReporteEstadisticas(servicios) {
        // Filtrar los servicios que coinciden con el servicio seleccionado y sucursal (si aplica)
        const serviciosSeleccionados = servicios.filter(s => s.servicio === servicioSeleccionado && (!filterSucursal.value || s.sucursal === filterSucursal.value));

        if (serviciosSeleccionados.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Servicio No Encontrado',
                text: 'No se encontraron registros para el servicio seleccionado.',
            });
            return;
        }

        // Agrupar los servicios por "Ubicación"
        const serviciosPorUbicacion = {};
        serviciosSeleccionados.forEach(servicio => {
            const ubicacion = servicio.ubicacion || 'Sin Ubicación';
            if (!serviciosPorUbicacion[ubicacion]) {
                serviciosPorUbicacion[ubicacion] = [];
            }
            serviciosPorUbicacion[ubicacion].push(servicio);
        });

        // Array de meses en español
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        // Para cada ubicación, generar las estadísticas
        Object.keys(serviciosPorUbicacion).forEach(ubicacion => {
            const serviciosEnUbicacion = serviciosPorUbicacion[ubicacion];

            // Combinar los pagos de todos los servicios en esta ubicación
            let historialPagos = [];
            serviciosEnUbicacion.forEach(servicio => {
                if (servicio.historialPagos && servicio.historialPagos.length > 0) {
                    historialPagos = historialPagos.concat(servicio.historialPagos);
                }
            });

            // Obtener el consumo de los 12 meses
            const consumosPorMes = meses.map(mes => {
                const pagosDelMes = historialPagos.filter(pago => {
                    return pago.mes === mes && pago.estadoPago === 'Pagado' && pago.boletaPago && !isNaN(pago.boletaPago.cantidadPagada);
                });

                // Sumar los consumos del mes
                const totalMes = pagosDelMes.reduce((total, pago) => total + parseFloat(pago.boletaPago.cantidadPagada), 0);

                return totalMes;
            });

            // Verificar si hay datos para mostrar
            if (consumosPorMes.every(consumo => consumo === 0)) {
                // No mostrar nada para esta ubicación si no hay datos
                return;
            }

            // Determinar si el consumo aumentó o disminuyó
            const consumoInicial = consumosPorMes[0];
            const consumoFinal = consumosPorMes[consumosPorMes.length - 1];
            const tendencia = consumoFinal > consumoInicial ? 'aumentado' : 'disminuido';

            // Crear el contenedor para el reporte de esta ubicación
            const estadisticasDiv = document.createElement('div');
            estadisticasDiv.innerHTML = `
                <h2>Estadísticas de Consumo Anual para ${servicioSeleccionado} - ${filterSucursal.value || 'Todas las Sucursales'} - Ubicación: ${ubicacion}</h2>
                <p>El consumo ha <strong>${tendencia}</strong> a lo largo del año.</p>
                <canvas id="consumoChart_${ubicacion.replace(/\s+/g, '_')}"></canvas>
            `;

            reportContainer.appendChild(estadisticasDiv);

            // Crear la gráfica
            const ctx = document.getElementById(`consumoChart_${ubicacion.replace(/\s+/g, '_')}`).getContext('2d');
            const consumoChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: meses,
                    datasets: [{
                        label: 'Consumo Mensual (Q)',
                        data: consumosPorMes,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                    }]
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: 'Consumo Mensual (12 meses)'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Consumo: Q${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Consumo (Q)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Meses'
                            }
                        }
                    }
                }
            });
        });
    }

    // Función para generar reporte de todos los servicios
    function generarReporteTodos(servicios, fechaInicio, fechaFin) {
        mostrarTablaServicios(servicios, 'Todos los Servicios', fechaInicio, fechaFin);
    }

    // Función para mostrar tabla de servicios
    function mostrarTablaServicios(servicios, titulo, fechaInicio, fechaFin) {
        const table = document.createElement('table');
        table.classList.add('report-table');

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Sucursal</th>
                <th>Servicio</th>
                <th>Proveedor del Servicio</th>
                <th>Ubicación</th>
                <th>Tipo de Pago</th>
                <th>Estado de Pago</th>
            </tr>
        `;

        const tbody = document.createElement('tbody');

        servicios.forEach(servicio => {
            const estadoPago = calcularEstadoPagoServicio(servicio);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${servicio.sucursal}</td>
                <td>${servicio.servicio}</td>
                <td>${servicio.proveedorServicio}</td>
                <td>${servicio.ubicacion || 'Sin Ubicación'}</td>
                <td>${servicio.tipoPago}</td>
                <td>${estadoPago}</td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        const titleElement = document.createElement('h2');
        titleElement.innerText = titulo;

        reportContainer.appendChild(titleElement);
        reportContainer.appendChild(table);

        if (servicios.length === 0) {
            const noDataMessage = document.createElement('p');
            noDataMessage.classList.add('no-data');
            noDataMessage.innerText = 'No hay datos para mostrar.';
            reportContainer.appendChild(noDataMessage);
        }
    }

    // Función para mostrar tabla de recibos
    function mostrarTablaRecibos(recibos, titulo, fechaInicio, fechaFin) {
        const table = document.createElement('table');
        table.classList.add('report-table');

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Sucursal</th>
                <th>Servicio</th>
                <th>Proveedor del Servicio</th>
                <th>Número de Recibo</th>
                <th>Fecha de Pago</th>
                <th>Cantidad a Pagar</th>
                <th>Estado de Pago</th>
                <th>Detalles de Boleta</th>
            </tr>
        `;

        const tbody = document.createElement('tbody');

        recibos.forEach(recibo => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${recibo.sucursal}</td>
                <td>${recibo.servicio}</td>
                <td>${recibo.proveedorServicio}</td>
                <td>${recibo.numeroRecibo}</td>
                <td>${new Date(recibo.fechaPago).toLocaleDateString('es-ES')}</td>
                <td>Q. ${parseFloat(recibo.cantidadAPagar).toFixed(2)}</td>
                <td>${recibo.estadoPago}</td>
                <td>${recibo.boletaPago ? `
                    Banco: ${recibo.boletaPago.banco}, 
                    Número Boleta: ${recibo.boletaPago.numeroBoleta}, 
                    Fecha: ${new Date(recibo.boletaPago.fecha).toLocaleDateString('es-ES')}, 
                    Tipo de Pago: ${recibo.boletaPago.tipoPago}, 
                    Cantidad Pagada: Q. ${parseFloat(recibo.boletaPago.cantidadPagada).toFixed(2)}
                ` : 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        const titleElement = document.createElement('h2');
        titleElement.innerText = titulo;

        reportContainer.appendChild(titleElement);
        reportContainer.appendChild(table);

        if (recibos.length === 0) {
            const noDataMessage = document.createElement('p');
            noDataMessage.classList.add('no-data');
            noDataMessage.innerText = 'No hay datos para mostrar.';
            reportContainer.appendChild(noDataMessage);
        }
    }

    // Manejar el botón de exportación
    exportBtn.addEventListener('click', () => {
        Swal.fire({
            title: 'Exportar Reporte',
            text: 'Seleccione el formato en el que desea exportar el reporte:',
            icon: 'question',
            input: 'radio',
            inputOptions: {
                'pdf': 'PDF',
                'excel': 'Excel',
                'imagen': 'Imagen'
            },
            inputValidator: (value) => {
                if (!value) {
                    return 'Por favor seleccione una opción';
                }
            },
            showCancelButton: true,
            confirmButtonText: 'Exportar',
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                if (result.value === 'pdf') {
                    exportarAPDF();
                } else if (result.value === 'excel') {
                    exportarAExcel();
                } else if (result.value === 'imagen') {
                    exportarAImagen();
                }
            }
        });
    });

    // Función para exportar el reporte a PDF
    function exportarAPDF() {
        const { jsPDF } = window.jspdf;

        // Crear un nuevo documento PDF
        const doc = new jsPDF('p', 'pt', 'a4');

        // Obtener el contenido del reporte
        const reportContent = reportContainer.cloneNode(true);

        // Ajustar el estilo para el PDF
        reportContent.style.width = '595px';

        // Convertir el contenido del reporte a PDF
        doc.html(reportContent, {
            callback: function(doc) {
                doc.save('reporte.pdf');
            },
            margin: [20, 20, 20, 20],
            autoPaging: 'text',
            html2canvas: {
                scale: 0.57, // Ajustar el escalado para que quepa en la página
            },
            x: 0,
            y: 0,
            width: 595 // Ancho de la página A4 en puntos
        });
    }

    // Función para exportar el reporte a Imagen
    function exportarAImagen() {
        html2canvas(reportContainer).then(canvas => {
            const link = document.createElement('a');
            link.download = 'reporte.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    // Función para exportar el reporte a Excel
    function exportarAExcel() {
        /* Recolectar las tablas dentro del reportContainer */
        const tables = reportContainer.querySelectorAll('table');

        if (tables.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No hay tablas para exportar.',
            });
            return;
        }

        /* Convertir cada tabla a hoja de Excel */
        const workbook = XLSX.utils.book_new();

        let sheetIndex = 0;

        tables.forEach((table, index) => {
            const worksheet = XLSX.utils.table_to_sheet(table);
            const titleElement = table.previousElementSibling;

            let sheetName = `Sheet${index + 1}`;

            if (titleElement && (titleElement.tagName === 'H2' || titleElement.tagName === 'H3')) {
                sheetName = titleElement.innerText.substring(0, 31); // Máximo 31 caracteres
            }

            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            sheetIndex++;
        });

        /* Exportar el libro de Excel */
        XLSX.writeFile(workbook, 'reporte.xlsx');
    }

    // Función para manejar el botón "Volver a Servicios"
    backToServicesBtn.addEventListener('click', () => {
        // Redirigir al usuario a la página servicios.html dentro de la carpeta servicios
        window.location.href = 'servicios/servicios.html';
    });
});
