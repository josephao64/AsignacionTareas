// script.js
import { db } from './firebase-config.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  /* =======================
     TABS (UI)
  ======================= */
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels  = document.querySelectorAll('.tab-content');

  function activateTab(id) {
    tabButtons.forEach(btn => {
      const active = btn.dataset.tab === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });
    tabPanels.forEach(p => p.classList.toggle('active', p.id === id));
    if (history.pushState) history.replaceState(null, '', '#' + id);
    else location.hash = id;
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const arr = Array.from(tabButtons);
      const idx = arr.indexOf(document.activeElement);
      const next = e.key === 'ArrowRight' ? (idx + 1) % arr.length : (idx - 1 + arr.length) % arr.length;
      arr[next].focus();
    });
  });

  const fromHash = (location.hash || '').replace('#', '');
  const firstId  = tabButtons[0]?.dataset.tab || 'tab-recientes';
  activateTab(document.getElementById(fromHash) ? fromHash : firstId);

  /* =======================
     REFERENCIAS DOM
  ======================= */
  const loginModal   = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const closeLoginBtn= document.getElementById('closeLoginBtn');
  const loginForm    = document.getElementById('loginForm');
  const usernameSelect = document.getElementById('username');
  const passwordInput  = document.getElementById('password');
  const logoutBtn    = document.getElementById('logoutBtn');

  const taskTableBody    = document.querySelector('#taskTable tbody');
  const historyTableBody = document.querySelector('#historyTable tbody');

  const searchInput   = document.getElementById('searchInput');
  const filterTipo    = document.getElementById('filterTipo');
  const filterResponsable = document.getElementById('filterResponsable');
  const filterFechaDesde  = document.getElementById('filterFechaDesde');
  const filterFechaHasta  = document.getElementById('filterFechaHasta');
  const filterSemana  = document.getElementById('filterSemana');
  const sortOrder     = document.getElementById('sortOrder');
  const resetFiltersBtn = document.getElementById('resetFilters');
  const editarBtn     = document.getElementById('editarBtn');
  const eliminarBtn   = document.getElementById('eliminarBtn');
  const taskModal     = document.getElementById('taskModal');
  const taskForm      = document.getElementById('taskForm');
  const tipoSelect    = document.getElementById('tipo');
  const addTipoBtn    = document.getElementById('addTipoBtn');
  const estadoCheckboxes = Array.from(document.querySelectorAll('#filterEstadoCheckboxes input[type="checkbox"]'));
  const responsableCheckboxesContainer = document.getElementById('responsableCheckboxes');

  const userStatsEls = {
    JOSE:   document.getElementById('pending-JOSE'),
    MARINA: document.getElementById('pending-MARINA'),
    JOSEPH: document.getElementById('pending-JOSEPH'),
    DAVID:  document.getElementById('pending-DAVID'),
  };

  /* =======================
     ESTADO
  ======================= */
  const usuarios = [
    { username: 'admin',  password: '1',                    isAdmin: true  },
    { username: 'david',  password: 'tu_contraseña_segura', isAdmin: false }
  ];
  let usuarioActual = JSON.parse(localStorage.getItem('usuarioActual')) || null;
  let tareas = [];
  let tiposTareas = [];
  let selectedTaskId = null;
  let filaSeleccionada = null;

  const prioridadEstado = { "Completado":1, "Revisión":2, "En Progreso":3, "No Iniciado":4 };

  /* =======================
     INIT
  ======================= */
  initLogin();
  cargarTipos();
  cargarTareas();
  attachEventListeners();

  /* =======================
     UTILIDADES FECHAS
  ======================= */
  function parseYMD(ymd) {
    const [y,m,d] = ymd.split('-').map(n => parseInt(n,10));
    return new Date(y, m-1, d);
  }
  function inicioDeHoy() { const dt = new Date(); dt.setHours(0,0,0,0); return dt; }
  function finDeHoy()    { const dt = new Date(); dt.setHours(23,59,59,999); return dt; }
  function inicioVentana15() { const dt = inicioDeHoy(); dt.setDate(dt.getDate()-15); return dt; }

  /* =======================
     LOGIN
  ======================= */
  function initLogin() {
    usuarios.forEach(u => usernameSelect.add(new Option(u.username.toUpperCase(), u.username)));
    if (usuarioActual) {
      Swal.fire({ icon:'success', title:'Bienvenido', text:usuarioActual.username.toUpperCase(), timer:1500, showConfirmButton:false });
    }
    if (filterSemana) { filterSemana.checked = true; filterSemana.disabled = true; }
    estadoCheckboxes.forEach(ch => ch.checked = true); // ver todos los estados
    toggleLoginUI();
  }
  function toggleLoginUI() {
    openLoginBtn.style.display = usuarioActual ? 'none' : 'inline-block';
    logoutBtn.style.display    = usuarioActual ? 'inline-block' : 'none';
  }
  loginForm?.addEventListener('submit', e => {
    e.preventDefault();
    const user = usuarios.find(u => u.username === usernameSelect.value && u.password === passwordInput.value.trim());
    if (user) {
      usuarioActual = user;
      localStorage.setItem('usuarioActual', JSON.stringify(user));
      loginModal.style.display = 'none';
      Swal.fire({ icon:'success', title:'Bienvenido', text:user.username.toUpperCase(), timer:1500, showConfirmButton:false });
      toggleLoginUI();
      actualizarTabla();
    } else {
      Swal.fire({ icon:'error', title:'Error', text:'Credenciales incorrectas.' });
    }
  });
  openLoginBtn?.addEventListener('click', () => loginModal.style.display = 'block');
  closeLoginBtn?.addEventListener('click', () => loginModal.style.display = 'none');
  logoutBtn?.addEventListener('click', () => {
    usuarioActual = null;
    localStorage.removeItem('usuarioActual');
    Swal.fire({ icon:'info', title:'Sesión Cerrada', timer:1500, showConfirmButton:false });
    toggleLoginUI();
    actualizarTabla();
  });
  window.addEventListener('click', e => { if (e.target === loginModal) loginModal.style.display = 'none'; });

  /* =======================
     TIPOS
  ======================= */
  async function cargarTipos() {
    try {
      tiposTareas = [];
      tipoSelect.length = 1;
      filterTipo.length = 1;
      const snap = await getDocs(collection(db,'tiposTareas'));
      snap.forEach(d => tiposTareas.push(d.data().nombre));
      tiposTareas.forEach(t => {
        tipoSelect.add(new Option(t, t));
        filterTipo.add(new Option(t, t));
      });
    } catch {
      Swal.fire({ icon:'error', title:'Error', text:'No se cargaron los tipos.' });
    }
  }
  addTipoBtn?.addEventListener('click', () => {
    if (!usuarioActual) return Swal.fire({ icon:'error', title:'Acceso Denegado', text:'Inicia sesión.' });
    Swal.fire({ title:'Nuevo Tipo', input:'text', showCancelButton:true, inputValidator: v => !v && 'Ingresa un tipo' })
      .then(async res => {
        if (res.isConfirmed) {
          const t = res.value.toUpperCase();
          if (tiposTareas.includes(t)) return Swal.fire('Ya existe');
          await addDoc(collection(db,'tiposTareas'), { nombre:t });
          await cargarTipos();
          tipoSelect.value = t;
          Swal.fire({ icon:'success', title:'Tipo agregado', timer:1500, showConfirmButton:false });
        }
      });
  });

  /* =======================
     TAREAS (Tiempo real)
  ======================= */
  function cargarTareas() {
    onSnapshot(collection(db,'tareas'), snap => {
      tareas = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      actualizarTabla();
    });
  }

  /* =======================
     LISTENERS
  ======================= */
  function attachEventListeners() {
    [searchInput, filterTipo, filterResponsable, filterFechaDesde, filterFechaHasta, sortOrder]
      .forEach(el => el?.addEventListener('input', actualizarTabla));

    estadoCheckboxes.forEach(ch => ch.addEventListener('change', actualizarTabla));
    resetFiltersBtn?.addEventListener('click', resetFilters);
    editarBtn?.addEventListener('click', () => abrirModal(selectedTaskId));
    eliminarBtn?.addEventListener('click', eliminarTarea);
    document.querySelector('.add-task-btn')?.addEventListener('click', () => abrirModal());
    taskForm?.addEventListener('submit', submitTarea);
    window.addEventListener('click', e => { if (e.target === taskModal) cerrarModal(); });

    if (filterSemana) filterSemana.checked = true;
  }

  /* =======================
     MODAL TAREA
  ======================= */
  window.abrirModal = id => {
    selectedTaskId = id || null;
    taskForm.reset();
    responsableCheckboxesContainer.querySelectorAll('input').forEach(c => c.checked = false);
    document.getElementById('modalTitle').textContent = id ? 'Editar Tarea' : 'Agregar Tarea';

    if (id) {
      const t = tareas.find(x => x.id === id);
      if (t) {
        tipoSelect.value = t.tipo;
        document.getElementById('descripcion').value = t.descripcion;
        document.getElementById('fechaEstimada').value = t.fechaEstimada;
        document.getElementById('notas').value = t.notas || '';
        responsableCheckboxesContainer.querySelectorAll('input').forEach(c => {
          if (t.responsable.includes(c.value)) c.checked = true;
        });
      }
    }
    taskModal.style.display = 'block';
  };

  window.cerrarModal = () => {
    taskModal.style.display = 'none';
    selectedTaskId = null;
    filaSeleccionada = null;
    editarBtn.disabled = true;
    eliminarBtn.disabled = true;
  };

  /* =======================
     GUARDAR / ACTUALIZAR
  ======================= */
  async function submitTarea(e) {
    e.preventDefault();
    const tipo = tipoSelect.value;
    const descripcion = document.getElementById('descripcion').value.trim();
    const fechaEstimada = document.getElementById('fechaEstimada').value;
    const responsables = Array.from(responsableCheckboxesContainer.querySelectorAll('input:checked')).map(i => i.value);
    const notas = document.getElementById('notas').value.trim();

    if (!tipo || !descripcion || !fechaEstimada || !responsables.length) {
      return Swal.fire({ icon:'error', text:'Completa todos los campos' });
    }

    const data = { tipo, descripcion, responsable: responsables, fechaEstimada, notas };

    try {
      if (selectedTaskId) {
        await updateDoc(doc(db,'tareas',selectedTaskId), data);
      } else {
        await addDoc(collection(db,'tareas'), {
          ...data,
          estado: 'No Iniciado',
          fechaCulminacion: '',
          fechaCreacion: new Date().toISOString()
        });
      }
      cerrarModal();
      Swal.fire({ icon:'success', timer:1500, showConfirmButton:false });
    } catch {
      Swal.fire({ icon:'error', text:'Error al guardar' });
    }
  }

  /* =======================
     FILTROS / RENDER
  ======================= */
  function resetFilters() {
    searchInput.value = '';
    filterTipo.value = '';
    filterResponsable.value = '';
    filterFechaDesde.value = '';
    filterFechaHasta.value = '';
    if (filterSemana) { filterSemana.checked = true; filterSemana.disabled = true; }
    sortOrder.value = 'estadoOrden';
    estadoCheckboxes.forEach(ch => ch.checked = true);
    actualizarTabla();
    Swal.fire({ icon:'info', timer:1200, showConfirmButton:false });
  }

  function actualizarTabla() {
    if (!taskTableBody || !historyTableBody) return;

    taskTableBody.innerHTML = '';
    historyTableBody.innerHTML = '';

    const hoyFin = finDeHoy();
    const ventanaInicio = inicioVentana15();

    // Resumen semanal (pendientes)
    const hoy = new Date();
    const dia = hoy.getDay(); // 0 dom, 1 lun ...
    const diffLunes = (dia + 6) % 7;
    const semanaInicio = new Date(hoy); semanaInicio.setDate(hoy.getDate() - diffLunes); semanaInicio.setHours(0,0,0,0);
    const semanaFin = new Date(semanaInicio); semanaFin.setDate(semanaInicio.getDate() + 6); semanaFin.setHours(23,59,59,999);

    Object.keys(userStatsEls).forEach(user => {
      const count = tareas.filter(t => {
        const fecha = parseYMD(t.fechaEstimada);
        return t.responsable.includes(user)
          && (t.estado === 'No Iniciado' || t.estado === 'En Progreso')
          && fecha >= semanaInicio && fecha <= semanaFin;
      }).length;
      userStatsEls[user].textContent = count;
    });

    const pasaFiltrosComunes = (t) => {
      if (filterTipo.value && t.tipo !== filterTipo.value) return false;
      if (filterResponsable.value && !t.responsable.includes(filterResponsable.value)) return false;
      if (filterFechaDesde.value && t.fechaEstimada < filterFechaDesde.value) return false;
      if (filterFechaHasta.value && t.fechaEstimada > filterFechaHasta.value) return false;

      const estadosSel = estadoCheckboxes.filter(c => c.checked).map(c => c.nextSibling.textContent.trim());
      if (estadosSel.length && !estadosSel.includes(t.estado)) return false;

      if (searchInput.value) {
        const term = searchInput.value.toLowerCase();
        const campos = [t.tipo, t.descripcion, t.responsable.join(', '), t.fechaEstimada, t.estado, t.notas];
        if (!campos.some(v => v?.toLowerCase().includes(term))) return false;
      }
      return true;
    };

    let listaVentana = [];
    let listaHistorial = [];

    tareas.forEach(t => {
      const fecha = parseYMD(t.fechaEstimada);
      if (fecha >= ventanaInicio && fecha <= hoyFin) {
        if (pasaFiltrosComunes(t)) listaVentana.push(t);
      } else if (fecha < ventanaInicio) {
        if (pasaFiltrosComunes(t)) listaHistorial.push(t);
      }
      // Futuras (fecha > hoy) no se muestran
    });

    switch (sortOrder.value) {
      case 'fechaEstimadaAsc':
        listaVentana.sort((a,b) => parseYMD(a.fechaEstimada) - parseYMD(b.fechaEstimada)); break;
      case 'fechaEstimadaDesc':
        listaVentana.sort((a,b) => parseYMD(b.fechaEstimada) - parseYMD(a.fechaEstimada)); break;
      case 'fechaCreacionAsc':
        listaVentana.sort((a,b) => new Date(a.fechaCreacion) - new Date(b.fechaCreacion)); break;
      case 'fechaCreacionDesc':
        listaVentana.sort((a,b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion)); break;
      default:
        listaVentana.sort((a,b) => prioridadEstado[a.estado] - prioridadEstado[b.estado]);
    }
    // Historial: recientes primero por fecha estimada
    listaHistorial.sort((a,b) => parseYMD(b.fechaEstimada) - parseYMD(a.fechaEstimada));

    listaVentana.forEach(t => taskTableBody.appendChild(crearFilaTarea(t)));
    listaHistorial.forEach(t => historyTableBody.appendChild(crearFilaTarea(t)));
  }

  /* =======================
     FILAS / ACCIONES
  ======================= */
  function crearFilaTarea(t) {
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    if (filaSeleccionada?.dataset.id === t.id) tr.classList.add('selected');

    tr.innerHTML = `
      <td>${t.tipo}</td>
      <td>${t.descripcion}</td>
      <td>${t.responsable.join(', ')}</td>
      <td>${t.fechaCreacion?.split('T')[0] || ''}</td>
      <td>${t.fechaEstimada}</td>
      <td>${t.fechaCulminacion || '-'}</td>
      <td>
        <select>
          <option value="No Iniciado"${t.estado==='No Iniciado' ? ' selected' : ''}>No Iniciado</option>
          <option value="En Progreso"${t.estado==='En Progreso' ? ' selected' : ''}>En Progreso</option>
          <option value="Revisión"${t.estado==='Revisión'   ? ' selected' : ''}>Revisión</option>
          <option value="Completado"${t.estado==='Completado'? ' selected' : ''}>Completado</option>
        </select>
      </td>
      <td>${t.notas || ''}</td>
    `;

    const claseEstado = {
      "No Iniciado": "estado-no-iniciado",
      "En Progreso": "estado-en-progreso",
      "Revisión": "estado-revision",
      "Completado": "estado-completado"
    }[t.estado] || "";
    const tdEstado = tr.children[6];
    if (claseEstado) tdEstado.classList.add(claseEstado);

    const select = tdEstado.querySelector('select');
    if (!usuarioActual?.isAdmin) {
      select.querySelector('option[value="Completado"]').disabled = true;
      if (t.estado === 'Completado') select.disabled = true;
    }
    select.addEventListener('change', e => cambiarEstado(t.id, e.target.value));

    const notasTd = tr.children[7];
    notasTd.addEventListener('dblclick', () => editarNotas(notasTd, t.id));

    tr.addEventListener('click', () => seleccionarFila(tr, t.id));
    return tr;
  }

  function seleccionarFila(tr, id) {
    filaSeleccionada?.classList.remove('selected');
    tr.classList.add('selected');
    filaSeleccionada = tr;
    selectedTaskId = id;
    editarBtn.disabled = false;
    eliminarBtn.disabled = false;
  }

  async function cambiarEstado(id, estado) {
    if (estado === 'Completado' && !usuarioActual?.isAdmin) {
      Swal.fire({ icon:'error', text:'Solo admin.' });
      return actualizarTabla();
    }
    const data = {
      estado,
      fechaCulminacion: estado === 'Completado' ? new Date().toISOString().split('T')[0] : ''
    };
    await updateDoc(doc(db,'tareas',id), data);
    Swal.fire({ icon:'success', timer:1500, showConfirmButton:false });
  }

  function editarNotas(td, id) {
    const old = td.textContent;
    const inp = document.createElement('input');
    inp.value = old;
    td.textContent = '';
    td.append(inp);
    inp.focus();

    const commit = async () => {
      const nuevo = inp.value.trim();
      await updateDoc(doc(db,'tareas',id), { notas: nuevo });
      td.textContent = nuevo;
    };

    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'Escape') {
        td.textContent = old;
        inp.removeEventListener('blur', commit);
      }
    });
  }

  async function eliminarTarea() {
    if (!selectedTaskId) return;
    const res = await Swal.fire({ title:'¿Eliminar?', icon:'warning', showCancelButton:true, confirmButtonText:'Sí, eliminar' });
    if (res.isConfirmed) {
      await deleteDoc(doc(db,'tareas',selectedTaskId));
      filaSeleccionada?.classList.remove('selected');
      editarBtn.disabled = true;
      eliminarBtn.disabled = true;
      Swal.fire({ icon:'success', title:'Eliminado', timer:1500, showConfirmButton:false });
    }
  }
});
