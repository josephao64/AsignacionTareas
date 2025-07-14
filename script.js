// script.js
import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  // Elementos DOM
  const loginModal = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const closeLoginBtn = document.getElementById('closeLoginBtn');
  const loginForm = document.getElementById('loginForm');
  const usernameSelect = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const logoutBtn = document.getElementById('logoutBtn');

  const taskTableBody = document.querySelector('#taskTable tbody');
  const searchInput = document.getElementById('searchInput');
  const filterTipo = document.getElementById('filterTipo');
  const filterResponsable = document.getElementById('filterResponsable');
  const filterFechaDesde = document.getElementById('filterFechaDesde');
  const filterFechaHasta = document.getElementById('filterFechaHasta');
  const filterSemana = document.getElementById('filterSemana'); // checkbox semana actual
  const sortOrder = document.getElementById('sortOrder');
  const resetFiltersBtn = document.getElementById('resetFilters');
  const editarBtn = document.getElementById('editarBtn');
  const eliminarBtn = document.getElementById('eliminarBtn');
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const tipoSelect = document.getElementById('tipo');
  const addTipoBtn = document.getElementById('addTipoBtn');
  const estadoCheckboxes = Array.from(document.querySelectorAll('#filterEstadoCheckboxes input[type="checkbox"]'));
  const responsableCheckboxesContainer = document.getElementById('responsableCheckboxes');

  // Datos y estado
  const usuarios = [
    { username: 'admin', password: '1', isAdmin: true },
    { username: 'david', password: 'tu_contraseña_segura', isAdmin: false }
  ];
  let usuarioActual = JSON.parse(localStorage.getItem('usuarioActual')) || null;
  let tareas = [], tiposTareas = [], selectedTaskId = null, filaSeleccionada = null;
  const prioridadEstado = { "Completado":1, "Revisión":2, "En Progreso":3, "No Iniciado":4 };

  // Inicialización
  initLogin();
  cargarTipos();
  cargarTareas();
  attachEventListeners();

  // Funciones de Login
  function initLogin() {
    usuarios.forEach(u => usernameSelect.add(new Option(u.username.toUpperCase(), u.username)));
    if (usuarioActual) Swal.fire({ icon:'success', title:'Bienvenido', text:usuarioActual.username.toUpperCase(), timer:1500, showConfirmButton:false });
    toggleLoginUI();
  }
  function toggleLoginUI() {
    openLoginBtn.style.display = usuarioActual ? 'none' : 'inline-block';
    logoutBtn.style.display = usuarioActual ? 'inline-block' : 'none';
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

  // Carga de Tipos
  async function cargarTipos() {
    try {
      tiposTareas = [];
      tipoSelect.length = 1;
      filterTipo.length = 1;
      const snap = await getDocs(collection(db, 'tiposTareas'));
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
          await addDoc(collection(db,'tiposTareas'),{nombre:t});
          await cargarTipos();
          tipoSelect.value = t;
          Swal.fire({ icon:'success', title:'Tipo agregado', timer:1500, showConfirmButton:false });
        }
      });
  });

  // Carga de Tareas
  function cargarTareas() {
    onSnapshot(collection(db,'tareas'), snap => {
      tareas = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      actualizarTabla();
    });
  }

  // Listeners generales
  function attachEventListeners() {
    [searchInput,filterTipo,filterResponsable,filterFechaDesde,filterFechaHasta,filterSemana,sortOrder]
      .forEach(el => el?.addEventListener('input', actualizarTabla));
    estadoCheckboxes.forEach(ch => ch.addEventListener('change', actualizarTabla));
    resetFiltersBtn?.addEventListener('click', resetFilters);
    editarBtn?.addEventListener('click', () => abrirModal(selectedTaskId));
    eliminarBtn?.addEventListener('click', eliminarTarea);
    document.querySelector('.add-task-btn')?.addEventListener('click', () => abrirModal());
    taskForm?.addEventListener('submit', submitTarea);
    window.addEventListener('click', e => { if (e.target === taskModal) cerrarModal(); });
    if(filterSemana) filterSemana.checked = true;
  }

  // Modal Tarea
  window.abrirModal = id => {
    selectedTaskId = id || null;
    taskForm.reset();
    responsableCheckboxesContainer.querySelectorAll('input').forEach(c => c.checked = false);
    document.getElementById('modalTitle').textContent = id ? 'Editar Tarea' : 'Agregar Tarea';
    if (id) {
      const t = tareas.find(x=>x.id===id);
      tipoSelect.value = t.tipo;
      document.getElementById('descripcion').value = t.descripcion;
      document.getElementById('fechaEstimada').value = t.fechaEstimada;
      document.getElementById('notas').value = t.notas||'';
      responsableCheckboxesContainer.querySelectorAll('input').forEach(c => {
        if (t.responsable.includes(c.value)) c.checked = true;
      });
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

  // Guardar Tarea
  async function submitTarea(e) {
    e.preventDefault();
    const tipo = tipoSelect.value;
    const descripcion = document.getElementById('descripcion').value.trim();
    const fechaEstimada = document.getElementById('fechaEstimada').value;
    const responsables = Array.from(responsableCheckboxesContainer.querySelectorAll('input:checked')).map(i=>i.value);
    const notas = document.getElementById('notas').value.trim();
    if (!tipo||!descripcion||!fechaEstimada||!responsables.length) return Swal.fire({ icon:'error', text:'Completa todos los campos' });
    const data = { tipo, descripcion, responsable:responsables, fechaEstimada, notas };
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

  // Filtrado y Orden
  function resetFilters() {
    searchInput.value = '';
    filterTipo.value = '';
    filterResponsable.value = '';
    filterFechaDesde.value = '';
    filterFechaHasta.value = '';
    if(filterSemana) filterSemana.checked = true;
    sortOrder.value = 'estadoOrden';
    estadoCheckboxes.forEach((ch,i)=> ch.checked = i<3 );
    actualizarTabla();
    Swal.fire({ icon:'info', timer:1500, showConfirmButton:false });
  }

  function actualizarTabla() {
    if (!taskTableBody) return;
    taskTableBody.innerHTML = '';

    // calcular rango semana actual
    let semanaInicio, semanaFin;
    if (filterSemana && filterSemana.checked) {
      const hoy = new Date();
      const d = hoy.getDay();
      semanaInicio = new Date(hoy);
      semanaInicio.setDate(hoy.getDate() - ((d + 6) % 7));
      semanaInicio.setHours(0,0,0,0);
      semanaFin = new Date(semanaInicio);
      semanaFin.setDate(semanaInicio.getDate() + 6);
      semanaFin.setHours(23,59,59,999);
    }

    let lista = tareas.filter(t => {
      const fecha = new Date(t.fechaEstimada);
      if (filterSemana && filterSemana.checked) {
        if (fecha < semanaInicio || fecha > semanaFin) return false;
      }
      if (filterTipo.value && t.tipo !== filterTipo.value) return false;
      if (filterResponsable.value && !t.responsable.includes(filterResponsable.value)) return false;
      if (filterFechaDesde.value && t.fechaEstimada < filterFechaDesde.value) return false;
      if (filterFechaHasta.value && t.fechaEstimada > filterFechaHasta.value) return false;
      const estados = estadoCheckboxes.filter(c=>c.checked).map(c=>c.nextSibling.textContent.trim());
      if (estados.length && !estados.includes(t.estado)) return false;
      if (searchInput.value) {
        const term = searchInput.value.toLowerCase();
        if (![t.tipo,t.descripcion,t.responsable.join(', '),t.fechaEstimada,t.estado,t.notas]
          .some(v=>v?.toLowerCase().includes(term))) return false;
      }
      return true;
    });

    switch(sortOrder.value) {
      case 'fechaEstimadaAsc': lista.sort((a,b)=>new Date(a.fechaEstimada)-new Date(b.fechaEstimada)); break;
      case 'fechaEstimadaDesc': lista.sort((a,b)=>new Date(b.fechaEstimada)-new Date(a.fechaEstimada)); break;
      case 'fechaCreacionAsc': lista.sort((a,b)=>new Date(a.fechaCreacion)-new Date(b.fechaCreacion)); break;
      case 'fechaCreacionDesc': lista.sort((a,b)=>new Date(b.fechaCreacion)-new Date(a.fechaCreacion)); break;
      default: lista.sort((a,b)=>prioridadEstado[a.estado]-prioridadEstado[b.estado]);
    }

    lista.forEach(t => {
      const tr = document.createElement('tr');
      tr.dataset.id = t.id;
      if (filaSeleccionada?.dataset.id === t.id) tr.classList.add('selected');
      tr.innerHTML = `
        <td>${t.tipo}</td>
        <td>${t.descripcion}</td>
        <td>${t.responsable.join(', ')}</td>
        <td>${t.fechaCreacion?.split('T')[0]||''}</td>
        <td>${t.fechaEstimada}</td>
        <td>${t.fechaCulminacion||'-'}</td>
        <td><select>
            <option value="No Iniciado"${t.estado==='No Iniciado'?' selected':''}>No Iniciado</option>
            <option value="En Progreso"${t.estado==='En Progreso'?' selected':''}>En Progreso</option>
            <option value="Revisión"${t.estado==='Revisión'?' selected':''}>Revisión</option>
            <option value="Completado"${t.estado==='Completado'?' selected':''}>Completado</option>
          </select></td>
        <td>${t.notas||''}</td>
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
      taskTableBody.appendChild(tr);
    });
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
    const data = { estado, fechaCulminacion: estado==='Completado' ? new Date().toISOString().split('T')[0] : '' };
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
    inp.addEventListener('blur', async () => {
      await updateDoc(doc(db,'tareas',id), { notas: inp.value.trim() });
      td.textContent = inp.value.trim();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'Escape') td.textContent = old;
    });
  }

  async function eliminarTarea() {
    const res = await Swal.fire({ title:'¿Eliminar?', icon:'warning', showCancelButton:true });
    if (res.isConfirmed) {
      await deleteDoc(doc(db,'tareas',selectedTaskId));
      filaSeleccionada.classList.remove('selected');
      editarBtn.disabled = true;
      eliminarBtn.disabled = true;
      Swal.fire({ icon:'success', title:'Eliminado', timer:1500, showConfirmButton:false });
    }
  }
});
