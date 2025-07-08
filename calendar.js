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
  // DOM refs
  const branchForm      = document.getElementById('branch-form');
  const branchIdInput   = document.getElementById('branch-id');
  const branchNameInput = document.getElementById('branch-name');
  const branchesList    = document.getElementById('branches-list');

  const viewSelect      = document.getElementById('view-select');
  const prevMonthBtn    = document.getElementById('prevMonth');
  const nextMonthBtn    = document.getElementById('nextMonth');
  const prevYearBtn     = document.getElementById('prevYear');
  const nextYearBtn     = document.getElementById('nextYear');
  const calendarTitle   = document.getElementById('calendar-title');
  const calendarEl      = document.getElementById('calendar');
  const yearViewEl      = document.getElementById('year-view');

  // Tasks tab
  const filterMonthInput = document.getElementById('task-filter-month');
  const generatePdfBtn   = document.getElementById('generate-pdf');
  const taskListEl       = document.getElementById('task-list');
  const taskForm         = document.getElementById('task-form');
  const taskIdInput      = document.getElementById('task-id');
  const branchSelect     = document.getElementById('task-branch');
  const titleInput       = document.getElementById('task-title');
  const dateInput        = document.getElementById('task-date');
  const repeatInput      = document.getElementById('task-repeat');
  const alertCheck       = document.getElementById('task-alert');
  const alertOptions     = document.getElementById('alert-options');
  const alertTimeSelect  = document.getElementById('task-alert-time');
  const colorInput       = document.getElementById('task-color');

  // State
  let branches = [], tasks = [];

  // Helper: lookup branch name
  function branchNameById(id) {
    const b = branches.find(x => x.id === id);
    return b ? b.name : '';
  }

  // Current date for "today"
  const today = new Date();
  const todayDs = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Display tasks due today on load (DOM alert)
  function renderTodayTasks() {
    const due = tasks.filter(t => {
      const diff = Math.floor((new Date(todayDs) - new Date(t.date)) / (1000*60*60*24));
      return diff >= 0
        && ((t.repeatDays === 0 ? t.date === todayDs : diff % t.repeatDays === 0))
        && !t.completedDates.includes(todayDs);
    });
    let alertEl = document.getElementById('today-alert');
    if (alertEl) alertEl.remove();
    alertEl = document.createElement('div');
    alertEl.id = 'today-alert';
    alertEl.className = 'alert alert-info';
    if (due.length) {
      alertEl.innerHTML =
        '<strong>Tareas de hoy:</strong><ul>' +
        due.map(t => `<li>${t.title}</li>`).join('') +
        '</ul>';
    } else {
      alertEl.innerHTML = '<strong>Tareas de hoy:</strong> No hay tareas pendientes.';
    }
    document.querySelector('.container').prepend(alertEl);
  }

  // Send a browser notification for today's tasks (auto-close + only pending)
  function notifyTodayTasks() {
    if (!("Notification" in window) || Notification.permission !== 'granted') return;
    const due = tasks.filter(t => {
      const diff = Math.floor((new Date(todayDs) - new Date(t.date)) / (1000*60*60*24));
      return diff >= 0
        && ((t.repeatDays === 0 ? t.date === todayDs : diff % t.repeatDays === 0))
        && !t.completedDates.includes(todayDs);
    });
    if (due.length) {
      const titles = due.map(t => t.title).join(', ');
      const n = new Notification('Tareas de hoy', { body: titles });
      setTimeout(() => n.close(), 5000);
    }
  }

  // Calendar state
  let currentMonth = today.getMonth();
  let currentYear  = today.getFullYear();

  // Notification offsets
  const ALERT_OFFSETS = {
    "Al momento":       0,
    "10 minutos antes": 10*60*1000,
    "1 hora antes":     60*60*1000,
    "1 día antes":      24*60*60*1000,
    "3 días antes":     3*24*60*60*1000
  };

  // Request notification permission
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Init month filter
  filterMonthInput.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  filterMonthInput.addEventListener('change', renderTaskTable);

  // Toggle alert options
  alertCheck.addEventListener('change', () => {
    alertOptions.style.display = alertCheck.checked ? 'block' : 'none';
  });

  // Switch view
  viewSelect.addEventListener('change', () => {
    document.getElementById('calendar-container').style.display = viewSelect.value === 'month' ? 'block' : 'none';
    yearViewEl.style.display = viewSelect.value === 'year' ? 'grid' : 'none';
    renderAll();
  });

  // Nav buttons
  prevMonthBtn.onclick = () => { currentMonth = (currentMonth + 11) % 12; if (currentMonth===11) currentYear--; renderAll(); };
  nextMonthBtn.onclick = () => { currentMonth = (currentMonth + 1) % 12;  if (currentMonth===0)  currentYear++; renderAll(); };
  prevYearBtn.onclick  = () => { currentYear--; renderAll(); };
  nextYearBtn.onclick  = () => { currentYear++; renderAll(); };

  // Firestore listeners
  onSnapshot(query(collection(db,'branches'), orderBy('createdAt')), snap => {
    branches = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderBranches();
    populateBranchSelect();
  });
  onSnapshot(query(collection(db,'tasks'), orderBy('createdAt')), snap => {
    tasks = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      completedDates: d.data().completedDates||[],
      color: d.data().color||'#ffffff'
    }));
    renderAll();
    renderTaskTable();
    renderTodayTasks();
    notifyTodayTasks();
    scheduleAllNotifications();
  });

  // BRANCH CRUD
  branchForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const name = branchNameInput.value.trim();
    if(!name) return;
    if(branchIdInput.value) {
      await updateDoc(doc(db,'branches',branchIdInput.value),{name});
    } else {
      await addDoc(collection(db,'branches'),{name,createdAt:Date.now()});
    }
    branchForm.reset();
    branchIdInput.value='';
    bootstrap.Modal.getInstance(document.getElementById('branchModal')).hide();
  });

  // TASK CRUD
  taskForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const data = {
      branchId: branchSelect.value,
      title: titleInput.value.trim(),
      date: dateInput.value,
      repeatDays: parseInt(repeatInput.value,10),
      alert: alertCheck.checked,
      alertTime: alertTimeSelect.value,
      color: colorInput.value,
      completedDates: [],
      createdAt: Date.now()
    };
    if(taskIdInput.value) {
      await updateDoc(doc(db,'tasks',taskIdInput.value),data);
    } else {
      await addDoc(collection(db,'tasks'),data);
    }
    taskForm.reset();
    taskIdInput.value='';
    alertOptions.style.display='none';
    bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
  });

  function populateBranchSelect() {
    branchSelect.innerHTML=`<option value="" disabled selected>Selecciona sucursal</option>`;
    branches.forEach(b=>{
      const o=document.createElement('option');
      o.value=b.id; o.textContent=b.name;
      branchSelect.append(o);
    });
  }

  function renderAll(){
    viewSelect.value==='month'?renderMonth():renderYear();
  }

  function renderBranches(){
    branchesList.innerHTML='';
    branches.forEach(b=>{
      const li=document.createElement('li');
      li.className='list-group-item d-flex justify-content-between align-items-center';
      li.textContent=b.name;
      const edit=document.createElement('button');
      edit.className='btn btn-sm btn-outline-primary me-1'; edit.textContent='✏️';
      edit.onclick=()=>{ branchIdInput.value=b.id; branchNameInput.value=b.name; new bootstrap.Modal(document.getElementById('branchModal')).show(); };
      const del=document.createElement('button');
      del.className='btn btn-sm btn-danger'; del.textContent='🗑';
      del.onclick=async()=>{ await deleteDoc(doc(db,'branches',b.id)); };
      const ctr=document.createElement('div'); ctr.append(edit,del);
      li.append(ctr); branchesList.append(li);
    });
  }

  function renderMonth(){
    calendarEl.innerHTML='';
    const firstDay=new Date(currentYear,currentMonth,1).getDay();
    const daysInMonth=new Date(currentYear,currentMonth+1,0).getDate();
    calendarTitle.textContent=`${currentYear} — ${currentMonth+1}`;
    for(let i=0;i<firstDay;i++){
      const e=document.createElement('div'); e.className='day empty'; calendarEl.append(e);
    }
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks=tasks.filter(t=>{
        const diff=Math.floor((new Date(ds)-new Date(t.date))/(1000*60*60*24));
        return diff>=0 && (t.repeatDays===0?t.date===ds:diff%t.repeatDays===0);
      });
      const cell=document.createElement('div');
      cell.className='day'+(dayTasks.length?' has-task':'');
      const dv=document.createElement('div'); dv.className='date'; dv.textContent=d; cell.append(dv);
      dayTasks.slice(0,2).forEach(t=>{
        const span=document.createElement('span');
        const done=t.completedDates.includes(ds);
        span.className='task-title'+(done?' completed':'');
        span.textContent=t.title;
        span.style.backgroundColor=t.color;
        span.onclick=async e=>{
          e.stopPropagation();
          await updateDoc(doc(db,'tasks',t.id),{ completedDates: done?arrayRemove(ds):arrayUnion(ds) });
          renderMonth(); renderTodayTasks();
        };
        cell.append(span);
      });
      calendarEl.append(cell);
    }
  }

  function renderYear(){
    yearViewEl.innerHTML='';
    calendarTitle.textContent=currentYear;
    for(let m=0;m<12;m++){
      const sm=document.createElement('div'); sm.className='small-calendar';
      const mn=new Date(currentYear,m,1).toLocaleString('es',{month:'long'});
      sm.innerHTML=`<div class="month-name">${mn}</div><div class="days"></div>`;
      const daysEl=sm.querySelector('.days');
      const first=new Date(currentYear,m,1).getDay();
      const dm=new Date(currentYear,m+1,0).getDate();
      for(let i=0;i<first;i++){ const e=document.createElement('div'); e.className='day empty'; daysEl.append(e); }
      for(let d=1;d<=dm;d++){
        const ds=`${currentYear}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const has=tasks.some(t=>{
          const diff=Math.floor((new Date(ds)-new Date(t.date))/(1000*60*60*24));
          return diff>=0 && (t.repeatDays===0?t.date===ds:diff%t.repeatDays===0);
        });
        const td=document.createElement('div'); td.className='day'+(has?' has-task':''); td.textContent=d;
        daysEl.append(td);
      }
      yearViewEl.append(sm);
    }
  }

  function renderTaskTable(){
    taskListEl.innerHTML='';
    if(!tasks.length){ taskListEl.innerHTML='<li class="list-group-item">No hay tareas.</li>'; return; }
    const [fY,fM]=filterMonthInput.value.split('-').map(n=>parseInt(n,10));
    const dim=new Date(fY,fM,0).getDate();
    tasks.forEach(t=>{
      const base=new Date(t.date);
      for(let d=1;d<=dim;d++){
        const ds=`${fY}-${String(fM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const diff=Math.floor((new Date(ds)-base)/(1000*60*60*24));
        if(diff<0) continue;
        if(t.repeatDays===0?t.date===ds:diff%t.repeatDays===0){
          const li=document.createElement('li');
          li.className='list-group-item d-flex justify-content-between align-items-center';
          const info=document.createElement('div');
          info.innerHTML=`
            <strong style="background:${t.color};padding:2px 6px;border-radius:4px;">
              ${t.title}
            </strong><br/><small>${ds}</small>
          `;
          const actions=document.createElement('div');
          const done=t.completedDates.includes(ds);
          const cb=document.createElement('button');
          cb.className='btn btn-sm me-2'; cb.textContent=done?'✅':'⬜';
          cb.onclick=async()=>{
            await updateDoc(doc(db,'tasks',t.id),{ completedDates: done?arrayRemove(ds):arrayUnion(ds) });
            renderTaskTable(); renderTodayTasks();
          };
          const edt=document.createElement('button');
          edt.className='btn btn-sm btn-outline-primary me-2'; edt.textContent='✏️';
          edt.onclick=()=>{
            taskIdInput.value=t.id;
            branchSelect.value=t.branchId;
            titleInput.value=t.title;
            dateInput.value=t.date;
            repeatInput.value=t.repeatDays;
            alertCheck.checked=t.alert;
            alertOptions.style.display=t.alert?'block':'none';
            alertTimeSelect.value=t.alertTime;
            colorInput.value=t.color;
            new bootstrap.Modal(document.getElementById('taskModal')).show();
          };
          const del=document.createElement('button');
          del.className='btn btn-sm btn-danger'; del.textContent='🗑';
          del.onclick=async()=>{ await deleteDoc(doc(db,'tasks',t.id)); };
          actions.append(cb,edt,del);
          li.append(info,actions);
          taskListEl.append(li);
        }
      }
    });
  }

  // Schedule per-task notifications
  function scheduleNotification(t, ds){
    if(!t.alert||t.completedDates.includes(ds)) return;
    const [yr,mo,da]=ds.split('-').map(n=>parseInt(n,10));
    const fireDate=new Date(yr,mo-1,da,9,0,0);
    const offset=ALERT_OFFSETS[t.alertTime]||0;
    const when=fireDate.getTime()-offset;
    const delay=when-Date.now();
    if(delay>0){
      setTimeout(()=>{
        const n=new Notification(`Tarea: ${t.title}`,{
          body:`Sucursal: ${branchNameById(t.branchId)}\nFecha: ${ds}`
        });
        setTimeout(()=>n.close(),5000);
      },delay);
    }
  }

  function scheduleAllNotifications(){
    const [fY,fM]=filterMonthInput.value.split('-').map(n=>parseInt(n,10));
    const dim=new Date(fY,fM,0).getDate();
    tasks.forEach(t=>{
      for(let d=1;d<=dim;d++){
        const ds=`${fY}-${String(fM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const diff=Math.floor((new Date(ds)-new Date(t.date))/(1000*60*60*24));
        if(diff<0) continue;
        if(t.repeatDays===0?t.date===ds:diff%t.repeatDays===0){
          scheduleNotification(t,ds);
        }
      }
    });
  }

  // PDF generation
  generatePdfBtn.addEventListener('click',async()=>{
    const { jsPDF }=window.jspdf;
    const pdf=new jsPDF();

    // Tasks table with branch column
    const [yr,mo]=filterMonthInput.value.split('-');
    pdf.setFontSize(16); pdf.text(`Tareas - ${yr}-${mo}`,20,30);
    pdf.setFontSize(12);
    const cols=['Sucursal','Tarea','Estado'], rows=[];
    const dim=new Date(yr,mo,0).getDate();
    tasks.forEach(t=>{
      const base=new Date(t.date);
      for(let d=1;d<=dim;d++){
        const ds=`${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const diff=Math.floor((new Date(ds)-base)/(1000*60*60*24));
        if(diff<0) continue;
        if(t.repeatDays===0?t.date===ds:diff%t.repeatDays===0){
          const done=t.completedDates.includes(ds);
          rows.push([
            branchNameById(t.branchId),
            `${t.title} (${ds})`,
            done?'Completada':'Pendiente'
          ]);
        }
      }
    });
    pdf.autoTable({ startY:40, head:[cols], body:rows, styles:{fontSize:10} });

    // Calendar screenshot
    pdf.addPage('a4','landscape');
    pdf.setFontSize(16); pdf.text(`Calendario - ${yr}-${mo}`,20,30);
    const calTabEl=document.querySelector('[data-bs-target="#tabCalendar"]');
    const taskTabEl=document.querySelector('[data-bs-target="#tabTasks"]');
    const calTab=bootstrap.Tab.getOrCreateInstance(calTabEl);
    const taskTab=bootstrap.Tab.getOrCreateInstance(taskTabEl);
    calTab.show(); viewSelect.value='month'; document.getElementById('calendar-container').style.display='block'; yearViewEl.style.display='none';
    renderMonth();
    await new Promise(r=>setTimeout(r,200));
    const canvas=await html2canvas(calendarEl,{backgroundColor:null});
    const img=canvas.toDataURL('image/png');
    const pw=pdf.internal.pageSize.getWidth()-40;
    const ph=canvas.height*(pw/canvas.width);
    pdf.addImage(img,'PNG',20,50,pw,ph);
    taskTab.show();
    pdf.save(`Reporte_${yr}-${mo}.pdf`);
  });

  // Initial render
  renderAll();
  renderTaskTable();
});
