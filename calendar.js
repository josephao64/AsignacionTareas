// calendar.js
import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const branchForm        = document.getElementById('branch-form');
  const branchIdInput     = document.getElementById('branch-id');
  const branchNameInput   = document.getElementById('branch-name');
  const branchesList      = document.getElementById('branches-list');

  const viewSelect        = document.getElementById('view-select');
  const prevMonthBtn      = document.getElementById('prevMonth');
  const nextMonthBtn      = document.getElementById('nextMonth');
  const prevYearBtn       = document.getElementById('prevYear');
  const nextYearBtn       = document.getElementById('nextYear');
  const calendarTitle     = document.getElementById('calendar-title');
  const calendarEl        = document.getElementById('calendar');
  const yearViewEl        = document.getElementById('year-view');

  const filterMonthInput   = document.getElementById('task-filter-month');
  const filterDateInput    = document.getElementById('task-filter-date');
  const filterStatusSelect = document.getElementById('task-filter-status');
  const generatePdfBtn     = document.getElementById('generate-pdf');
  const taskListEl         = document.getElementById('task-list');

  const taskForm           = document.getElementById('task-form');
  const taskIdInput        = document.getElementById('task-id');
  const branchSelect       = document.getElementById('task-branch');
  const titleInput         = document.getElementById('task-title');
  const dateInput          = document.getElementById('task-date');
  const repeatInput        = document.getElementById('task-repeat');
  const alertCheck         = document.getElementById('task-alert');
  const alertOptions       = document.getElementById('alert-options');
  const alertTimeSelect    = document.getElementById('task-alert-time');
  const acceptCheck        = document.getElementById('task-accept');
  const saveTaskBtn        = document.getElementById('task-save-btn');

  const notesModalEl       = document.getElementById('notesModal');
  const existingNotesEl    = document.getElementById('existing-notes');
  const notesTaskIdInput   = document.getElementById('notes-task-id');
  const notesTaskDateInput = document.getElementById('notes-task-date');
  const newNoteTextarea    = document.getElementById('new-note');
  const addNoteBtn         = document.getElementById('add-note-btn');
  const addNoteCompleteBtn = document.getElementById('add-note-complete-btn');

  let branches = [], tasks = [];

  const today   = new Date();
  const todayDs = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  let currentMonth = today.getMonth(), currentYear = today.getFullYear();

  const ALERT_OFFSETS = {
    "Al momento":       0,
    "10 minutos antes": 10*60*1000,
    "1 hora antes":     60*60*1000,
    "1 día antes":      24*60*60*1000,
    "3 días antes":     3*24*60*60*1000
  };

  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  filterMonthInput.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  filterMonthInput.addEventListener('change', renderTaskTable);
  filterDateInput.addEventListener('change', renderTaskTable);
  filterStatusSelect.addEventListener('change', renderTaskTable);

  // ✅ al cambiar vista, mostramos/ocultamos sólo cada vista (no el contenedor)
  viewSelect.addEventListener('change', () => {
    const isMonth = viewSelect.value === 'month';
    calendarEl.style.display = isMonth ? 'block' : 'none';
    yearViewEl.style.display = isMonth ? 'none' : 'grid';
    renderAll();
  });

  prevMonthBtn.onclick = () => {
    currentMonth = (currentMonth + 11) % 12;
    if (currentMonth === 11) currentYear--;
    renderAll();
  };
  nextMonthBtn.onclick = () => {
    currentMonth = (currentMonth + 1) % 12;
    if (currentMonth === 0) currentYear++;
    renderAll();
  };
  prevYearBtn.onclick = () => { currentYear--; renderAll(); };
  nextYearBtn.onclick = () => { currentYear++; renderAll(); };

  onSnapshot(query(collection(db,'branches'), orderBy('createdAt')), snap => {
    branches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBranches();
    populateBranchSelect();
  });

  onSnapshot(query(collection(db,'tasks'), orderBy('createdAt')), snap => {
    tasks = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      completedDates: d.data().completedDates || [],
      color: d.data().color || '#ffffff',
      notes: d.data().notes || []
    }));
    renderAll();
    renderTaskTable();
    renderTodayTasks();
    notifyTodayTasks();
  });

  branchForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = branchNameInput.value.trim();
    if (!name) return;
    if (branchIdInput.value) {
      await updateDoc(doc(db,'branches',branchIdInput.value), { name });
    } else {
      await addDoc(collection(db,'branches'), { name, createdAt: Date.now() });
    }
    branchForm.reset();
    bootstrap.Modal.getInstance(document.getElementById('branchModal')).hide();
  });

  taskForm.addEventListener('submit', async e => {
    e.preventDefault();
    // Evitar duplicados
    if (!taskIdInput.value && tasks.some(t =>
      t.branchId === branchSelect.value &&
      t.title.trim() === titleInput.value.trim() &&
      t.date === dateInput.value
    )) {
      taskForm.reset();
      bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
      return;
    }
    const selectedColor = document.querySelector('input[name="task-color"]:checked')?.value || '#ffffff';
    const data = {
      branchId: branchSelect.value,
      title: titleInput.value.trim(),
      date: dateInput.value,
      repeatDays: parseInt(repeatInput.value,10),
      alert: alertCheck.checked,
      alertTime: alertTimeSelect.value,
      color: selectedColor,
      completedDates: [],
      notes: [],
      createdAt: Date.now()
    };
    if (taskIdInput.value) {
      await updateDoc(doc(db,'tasks',taskIdInput.value), data);
    } else {
      await addDoc(collection(db,'tasks'), data);
    }
    taskForm.reset();
    acceptCheck.checked = false;
    saveTaskBtn.disabled = true;
    alertOptions.style.display = 'none';
    bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
  });

  addNoteBtn.addEventListener('click', async () => {
    const id      = notesTaskIdInput.value;
    const content = newNoteTextarea.value.trim();
    if (!content) return;
    const task = tasks.find(t => t.id === id);
    if (task.notes.some(n => n.content === content)) return;
    await updateDoc(doc(db,'tasks',id), {
      notes: arrayUnion({ date: new Date().toISOString(), content })
    });
    newNoteTextarea.value = '';
    openNotesModal(task, notesTaskDateInput.value);
  });

  addNoteCompleteBtn.addEventListener('click', async () => {
    const id      = notesTaskIdInput.value;
    const ds      = notesTaskDateInput.value;
    const content = newNoteTextarea.value.trim();
    if (!content) return;
    const task = tasks.find(t => t.id === id);
    if (task.notes.some(n => n.content === content)) {
      bootstrap.Modal.getInstance(notesModalEl).hide();
      return;
    }
    await updateDoc(doc(db,'tasks',id), {
      notes: arrayUnion({ date: new Date().toISOString(), content }),
      completedDates: arrayUnion(ds)
    });
    bootstrap.Modal.getInstance(notesModalEl).hide();
    renderAll();
    renderTaskTable();
    renderTodayTasks();
  });

  function branchNameById(id) {
    const b = branches.find(x => x.id === id);
    return b ? b.name : '';
  }

  function renderTodayTasks() {
    const due = tasks.filter(t => {
      const diff = Math.floor((new Date(todayDs) - new Date(t.date)) / (1000*60*60*24));
      return diff >= 0 &&
        ((t.repeatDays === 0 ? t.date === todayDs : diff % t.repeatDays === 0)) &&
        !t.completedDates.includes(todayDs);
    });
    let alertEl = document.getElementById('today-alert');
    if (alertEl) alertEl.remove();
    alertEl = document.createElement('div');
    alertEl.id = 'today-alert';
    alertEl.className = 'alert alert-info';
    alertEl.innerHTML = due.length
      ? '<strong>Tareas de hoy:</strong><ul>' + due.map(t => `<li>${t.title} (${branchNameById(t.branchId)})</li>`).join('') + '</ul>'
      : '<strong>Tareas de hoy:</strong> No hay tareas pendientes.';
    document.querySelector('.container').prepend(alertEl);
  }

  function notifyTodayTasks() {
    if (!("Notification" in window) || Notification.permission !== 'granted') return;
    const due = tasks.filter(t => {
      const diff = Math.floor((new Date(todayDs) - new Date(t.date)) / (1000*60*60*24));
      return diff >= 0 &&
        ((t.repeatDays === 0 ? t.date === todayDs : diff % t.repeatDays === 0)) &&
        !t.completedDates.includes(todayDs);
    });
    if (due.length) {
      const titles = due.map(t => `${t.title} (${branchNameById(t.branchId)})`).join(', ');
      const n = new Notification('Tareas de hoy', { body: titles });
      setTimeout(() => n.close(), 5000);
    }
  }

  function renderBranches() {
    branchesList.innerHTML = '';
    branches.forEach(b => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.textContent = b.name;

      const edit = document.createElement('button');
      edit.className = 'btn btn-sm btn-outline-primary me-1';
      edit.textContent = '✏️';
      edit.onclick = () => {
        branchIdInput.value   = b.id;
        branchNameInput.value = b.name;
        new bootstrap.Modal(document.getElementById('branchModal')).show();
      };

      const del = document.createElement('button');
      del.className = 'btn btn-sm btn-danger';
      del.textContent = '🗑';
      del.onclick = async () => { await deleteDoc(doc(db,'branches',b.id)); };

      li.append(edit, del);
      branchesList.append(li);
    });
  }

  function populateBranchSelect() {
    branchSelect.innerHTML = `<option value="" disabled selected>Selecciona sucursal</option>`;
    branches.forEach(b => {
      const o = document.createElement('option');
      o.value       = b.id;
      o.textContent = b.name;
      branchSelect.append(o);
    });
  }

  function renderAll() {
    viewSelect.value === 'month' ? renderMonth() : renderYear();
  }

  /* 🔧 VISTA MENSUAL: celdas con altura fija y tareas truncadas + indicador "+N más" */
  function renderMonth() {
    calendarEl.innerHTML = '';
    const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate();
    calendarTitle.textContent = `${currentYear} — ${currentMonth+1}`;

    for (let i = 0; i < firstDay; i++) {
      const e = document.createElement('div');
      e.className = 'day empty';
      calendarEl.append(e);
    }

    const MAX_PER_DAY = 2; // mantenemos 2 visibles para no saturar

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks = tasks.filter(t => {
        const diff = Math.floor((new Date(ds) - new Date(t.date)) / (1000*60*60*24));
        return diff >= 0 && (t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0);
      });

      const cell = document.createElement('div');
      cell.className =
        'day' +
        (dayTasks.length ? ' has-task' : '') +
        (ds === todayDs ? ' today' : '');

      const dv = document.createElement('div');
      dv.className = 'date';
      dv.textContent = d;

      // contenedor de tareas que recorta el exceso
      const tasksWrap = document.createElement('div');
      tasksWrap.className = 'tasks';

      const toShow = dayTasks.slice(0, MAX_PER_DAY);
      toShow.forEach(t => {
        const span = document.createElement('span');
        const done = t.completedDates.includes(ds);
        span.className = 'task-title' + (done ? ' completed' : '');
        const label = `${t.title} (${branchNameById(t.branchId)})`;
        span.textContent = label;
        span.title = label; // tooltip nativo
        span.style.backgroundColor = t.color;
        span.onclick = () => openNotesModal(t, ds);
        tasksWrap.append(span);
      });

      // si hay más tareas, mostramos contador "+N más"
      const hidden = dayTasks.length - toShow.length;
      if (hidden > 0) {
        const more = document.createElement('span');
        more.className = 'more-tasks';
        more.textContent = `+${hidden} más`;
        more.title = dayTasks
          .slice(MAX_PER_DAY)
          .map(t => `${t.title} (${branchNameById(t.branchId)})`)
          .join('\n');
        tasksWrap.append(more);
      }

      cell.append(dv, tasksWrap);
      calendarEl.append(cell);
    }
  }

  function renderYear() {
    yearViewEl.innerHTML = '';
    calendarTitle.textContent = currentYear;
    for (let m = 0; m < 12; m++) {
      const sm = document.createElement('div');
      sm.className = 'small-calendar';
      const mn = new Date(currentYear, m, 1).toLocaleString('es', { month: 'long' });
      sm.innerHTML = `<div class="month-name">${mn}</div><div class="days"></div>`;
      const daysEl = sm.querySelector('.days');
      const first  = new Date(currentYear, m, 1).getDay();
      const dm     = new Date(currentYear, m+1, 0).getDate();

      for (let i = 0; i < first; i++) {
        const e = document.createElement('div');
        e.className = 'day empty';
        daysEl.append(e);
      }
      for (let d = 1; d <= dm; d++) {
        const ds  = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; // fix '0'
        const has = tasks.some(t => {
          const diff = Math.floor((new Date(ds) - new Date(t.date)) / (1000*60*60*24));
          return diff >= 0 && (t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0);
        });
        const td = document.createElement('div');
        td.className = 'day' + (has ? ' has-task' : '');
        td.textContent = d;
        if (has) {
          td.title = tasks
            .filter(t => {
              const diff = Math.floor((new Date(ds) - new Date(t.date)) / (1000*60*60*24));
              return diff >= 0 && (t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0);
            })
            .map(t => `${t.title} (${branchNameById(t.branchId)})`)
            .join('\n');
        }
        daysEl.append(td);
      }
      yearViewEl.append(sm);
    }
  }

  function renderTaskTable() {
    taskListEl.innerHTML = '';
    if (tasks.length === 0) {
      taskListEl.innerHTML = '<li class="list-group-item">No hay tareas.</li>';
      return;
    }
    const selectedMonth = filterMonthInput.value;
    const selectedDate  = filterDateInput.value;
    const statusFilter  = filterStatusSelect.value;
    let dsList = [];

    if (selectedDate) {
      dsList = [selectedDate];
    } else if (selectedMonth) {
      const [fY,fM] = selectedMonth.split('-').map(n => parseInt(n,10));
      const dim = new Date(fY, fM, 0).getDate();
      for (let d = 1; d <= dim; d++) {
        dsList.push(`${fY}-${String(fM).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      }
    } else {
      dsList = [todayDs];
    }

    tasks.forEach(t => {
      const base = new Date(t.date);
      dsList.forEach(ds => {
        const diff = Math.floor((new Date(ds) - base) / (1000*60*60*24));
        if (diff < 0) return;
        if (!(t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0)) return;
        const done = t.completedDates.includes(ds);
        if (statusFilter === 'completed' && !done) return;
        if (statusFilter === 'pending' && done) return;

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        const info = document.createElement('div');
        info.innerHTML = `
          <strong style="background:${t.color};padding:2px 6px;border-radius:4px;">
            ${t.title}
          </strong><br/>
          <small>${ds}</small><br/>
          <small>Sucursal: ${branchNameById(t.branchId)}</small><br/>
          <small>Estado: ${done?'Completada':'Pendiente'}</small>
        `;
        const actions = document.createElement('div');

        const cb = document.createElement('button');
        cb.className = 'btn btn-sm me-2';
        cb.textContent = done ? '✅' : '⬜';
        cb.onclick = async () => {
          await updateDoc(doc(db,'tasks',t.id), {
            completedDates: done
              ? arrayRemove(ds)
              : arrayUnion(ds)
          });
          renderAll();
          renderTaskTable();
          renderTodayTasks();
        };

        const noteBtn = document.createElement('button');
        noteBtn.className = 'btn btn-sm btn-outline-secondary me-2';
        noteBtn.textContent = '📝';
        noteBtn.onclick = () => openNotesModal(t, ds);

        const edt = document.createElement('button');
        edt.className = 'btn btn-sm btn-outline-primary me-2';
        edt.textContent = '✏️';
        edt.onclick = () => {
          taskIdInput.value   = t.id;
          branchSelect.value  = t.branchId;
          titleInput.value    = t.title;
          dateInput.value     = t.date;
          repeatInput.value   = t.repeatDays;
          alertCheck.checked  = t.alert;
          alertOptions.style.display = t.alert ? 'block' : 'none';
          alertTimeSelect.value = t.alertTime;
          const radio = document.querySelector(`input[name="task-color"][value="${t.color}"]`);
          if (radio) radio.checked = true;
          acceptCheck.checked = false;
          saveTaskBtn.disabled = true;
          new bootstrap.Modal(document.getElementById('taskModal')).show();
        };

        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger';
        del.textContent = '🗑';
        del.onclick = async () => { await deleteDoc(doc(db,'tasks',t.id)); };

        actions.append(cb, noteBtn, edt, del);
        li.append(info, actions);
        taskListEl.append(li);
      });
    });
  }

  function openNotesModal(t, ds) {
    notesTaskIdInput.value   = t.id;
    notesTaskDateInput.value = ds;
    existingNotesEl.innerHTML = '';
    if (t.notes.length) {
      t.notes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'note-item';
        const dt = new Date(n.date).toLocaleString();
        div.innerHTML = `<small class="text-muted">${dt}</small><p>${n.content}</p>`;
        existingNotesEl.append(div);
      });
    } else {
      existingNotesEl.innerHTML = '<p>No hay notas.</p>';
    }
    newNoteTextarea.value = '';
    notesModalEl.removeAttribute('aria-hidden');
    new bootstrap.Modal(notesModalEl).show();
  }

  generatePdfBtn.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const [yr,mo] = filterMonthInput.value.split('-');
    pdf.setFontSize(16);
    pdf.text(`Tareas - ${yr}-${mo}`, 20, 30);
    pdf.setFontSize(12);
    const cols = ['Sucursal','Tarea','Estado'], rows = [];
    const dim = new Date(yr, mo, 0).getDate();
    tasks.forEach(t => {
      const base = new Date(t.date);
      for (let d = 1; d <= dim; d++) {
        const ds = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const diff = Math.floor((new Date(ds) - base) / (1000*60*60*24));
        if (diff < 0) continue;
        if (!(t.repeatDays===0 ? t.date===ds : diff%t.repeatDays===0)) continue;
        const done = t.completedDates.includes(ds);
        rows.push([
          branchNameById(t.branchId),
          `${t.title} (${ds})`,
          done?'Completada':'Pendiente'
        ]);
      }
    });
    pdf.autoTable({ startY:40, head:[cols], body:rows, styles:{fontSize:10} });
    pdf.save(`Reporte_${yr}-${mo}.pdf`);
  });

  renderAll();
  renderTaskTable();
});
