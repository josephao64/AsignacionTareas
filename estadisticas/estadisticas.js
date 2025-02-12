/* estadisticas.js */

/* ====================================================
   CONFIGURACIÓN DE FIREBASE
   ==================================================== */
   const firebaseConfig = {
    apiKey: "AIzaSyCc_XNSGWjrl8eOmOvbSpxvsmgoLunI_pk",
    authDomain: "tareasdb-193f4.firebaseapp.com",
    projectId: "tareasdb-193f4",
    storageBucket: "tareasdb-193f4.appspot.com",
    messagingSenderId: "654977996103",
    appId: "1:654977996103:web:9c246d4d16c1d3c943e862"
  };
  
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  
  /* ====================================================
     VARIABLES GLOBALES Y DATOS INICIALES
     ==================================================== */
  // Fechas de ejemplo
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split("T")[0];
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const ayerStr = ayer.toISOString().split("T")[0];
  
  // Los arreglos se cargarán desde Firestore
  let saleTypes = [];  // Colección "saleTypes"
  let salesData = [];  // Colección "sales"
  
  // Tipo de venta actualmente activo (seleccionado)
  let activeSaleType = null;
  // Variable para saber si se está editando un registro (null = nuevo)
  let currentEditIndex = null;
  // Variable para la gráfica de ventas diarias
  let dailySalesChart;
  // Variable global para el tipo de gráfica (por defecto "line")
  // Opciones: "line", "stepline", "smoothline", "bar", "radar"
  let chartType = "line";
  // Variable global para activar/desactivar etiquetas en la gráfica
  let showLabels = false;
  
  /* ====================================================
     FUNCIÓN PARA PARSEAR FECHAS COMO LOCALES
     ==================================================== */
  function parseDateAsLocal(dateStr) {
    const parts = dateStr.split("-");
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  
  /* ====================================================
     CARGA DE DATOS DESDE FIREBASE
     ==================================================== */
  function loadSaleTypes() {
    db.collection("saleTypes").get()
      .then((snapshot) => {
        saleTypes = [];
        snapshot.forEach((doc) => {
          saleTypes.push({ ...doc.data(), id: doc.id });
        });
        if (saleTypes.length === 0) {
          const initialTypes = [
            { id: "general", label: "General", color: "rgba(0, 123, 255, 1)" },
            { id: "domicilio_jalapa", label: "Ventas a domicilio Jalapa", color: "rgba(75, 192, 192, 1)" }
          ];
          initialTypes.forEach((t) => {
            db.collection("saleTypes").add(t);
          });
          setTimeout(loadSaleTypes, 1000);
        } else {
          renderSaleTypeSelector();
          renderDetailedSaleTypeSelector();
        }
      })
      .catch((error) => { console.error("Error al cargar saleTypes:", error); });
  }
  
  function loadSalesData() {
    db.collection("sales").get()
      .then((snapshot) => {
        salesData = [];
        snapshot.forEach((doc) => {
          salesData.push({ ...doc.data(), id: doc.id });
        });
        updateDailySalesChart();
        updateIndicators();
        loadSalesDetailed();
      })
      .catch((error) => { console.error("Error al cargar salesData:", error); });
  }
  
  /* ====================================================
     FUNCIONES AUXILIARES
     ==================================================== */
  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }
  
  /* ====================================================
     GESTIÓN DEL TIPO DE VENTA (SELECCIÓN)
     ==================================================== */
  function renderSaleTypeSelector() {
    const container = document.getElementById("saleTypeSelector");
    container.innerHTML = "";
    saleTypes.forEach((type) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-outline-primary me-2 mb-2" + (activeSaleType === type.id ? " active" : "");
      btn.textContent = type.label;
      btn.style.borderColor = type.color;
      btn.style.color = type.color;
      btn.onclick = () => { setActiveSaleType(type.id); };
      container.appendChild(btn);
    });
  }
  
  function renderDetailedSaleTypeSelector() {
    const container = document.getElementById("detailedSaleTypeSelector");
    container.innerHTML = "";
    saleTypes.forEach((type) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-outline-primary me-2 mb-2" + (activeSaleType === type.id ? " active" : "");
      btn.textContent = type.label;
      btn.style.borderColor = type.color;
      btn.style.color = type.color;
      btn.onclick = () => { setActiveSaleType(type.id); };
      container.appendChild(btn);
    });
  }
  
  function setActiveSaleType(typeId) {
    activeSaleType = typeId;
    renderSaleTypeSelector();
    renderDetailedSaleTypeSelector();
    document.getElementById("dashboardContent").style.display = "block";
    updateDailySalesChart();
    updateIndicators();
    loadSalesDetailed();
  }
  
  /* ====================================================
     GRÁFICO DE VENTAS DIARIAS
     ==================================================== */
  function updateDailySalesChart() {
    const year = parseInt(document.getElementById("chartFilterYear").value);
    const month = parseInt(document.getElementById("chartFilterMonth").value);
    if (!year || !month) {
      alert("Por favor seleccione año y mes para actualizar la gráfica.");
      return;
    }
    if (!activeSaleType) {
      alert("Por favor seleccione un tipo de venta en el Dashboard.");
      return;
    }
    
    // Título de la gráfica: incluye mes, año y el rango de fechas (primer y último día)
    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const monthName = monthNames[month - 1];
    const firstDay = "01/" + (month < 10 ? "0" + month : month) + "/" + year;
    const lastDay = getDaysInMonth(year, month);
    const lastDayStr = (lastDay < 10 ? "0" + lastDay : lastDay) + "/" + (month < 10 ? "0" + month : month) + "/" + year;
    
    const daysInMonth = getDaysInMonth(year, month);
    const labels = [];
    for (let d = 1; d <= daysInMonth; d++) {
      // Etiquetas: solo el día (01, 02, etc.)
      const dayStr = ("0" + d).slice(-2);
      labels.push(dayStr);
    }
    
    const ctx = document.getElementById("dailySalesChart").getContext("2d");
    if (dailySalesChart) { dailySalesChart.destroy(); }
    
    // Acumular ventas diarias para el tipo activo
    const data = new Array(daysInMonth).fill(0);
    salesData.forEach((sale) => {
      const saleDate = parseDateAsLocal(sale.date);
      if (
        saleDate.getFullYear() === year &&
        saleDate.getMonth() + 1 === month &&
        sale.type === activeSaleType
      ) {
        const day = saleDate.getDate();
        data[day - 1] += sale.amount;
      }
    });
    
    const total = data.reduce((sum, val) => sum + val, 0);
    const avgDaily = total / daysInMonth;
    const avgLineData = new Array(daysInMonth).fill(avgDaily);
    const typeObj = saleTypes.find((t) => t.id === activeSaleType);
    const borderColor = typeObj ? typeObj.color : "rgba(75, 192, 192, 1)";
    const labelText = typeObj ? typeObj.label + " (Q)" : "Ventas (Q)";
    
    // Opciones de la línea según el tipo de gráfica
    let datasetOptions = { tension: 0.2, stepped: false };
    if (chartType === "stepline") {
      datasetOptions.stepped = true;
      datasetOptions.tension = 0;
    } else if (chartType === "smoothline") {
      datasetOptions.tension = 0.4;
    }
    
    dailySalesChart = new Chart(ctx, {
      type: (chartType === "bar" || chartType === "radar") ? chartType : "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: labelText,
            data: data,
            fill: false,
            borderColor: borderColor,
            backgroundColor: borderColor,
            pointRadius: 5,
            ...datasetOptions
          },
          {
            label: "Promedio Diario",
            data: avgLineData,
            borderColor: "rgba(255, 99, 132, 1)",
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Ventas Diarias – ${monthName} ${year} (del ${firstDay} al ${lastDayStr})`
          },
          datalabels: {
            display: showLabels,
            color: "#000",
            align: 'top',
            formatter: Math.round
          },
          tooltip: { mode: "index", intersect: false },
          legend: { position: "top" },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Ventas (Q)" } },
          x: { title: { display: true, text: "Día" } }
        }
      },
      plugins: [ChartDataLabels]
    });
  }
  
  /* ====================================================
     CAMBIAR TIPO DE GRÁFICA
     ==================================================== */
  function setChartType(newType) {
    chartType = newType;
    updateDailySalesChart();
  }
  
  /* ====================================================
     TOGGLE DE ETIQUETAS EN LA GRÁFICA
     ==================================================== */
  function toggleDataLabels(activate) {
    showLabels = activate;
    updateDailySalesChart();
  }
  
  /* ====================================================
     INDICADORES DEL DASHBOARD (POR MES)
     ==================================================== */
  function updateIndicators() {
    const year = parseInt(document.getElementById("chartFilterYear").value);
    const month = parseInt(document.getElementById("chartFilterMonth").value);
    if (!year || !month || !activeSaleType) return;
    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const monthName = monthNames[month - 1];
    const firstDay = "01/" + (month < 10 ? "0" + month : month) + "/" + year;
    const lastDay = getDaysInMonth(year, month);
    const lastDayStr = (lastDay < 10 ? "0" + lastDay : lastDay) + "/" + (month < 10 ? "0" + month : month) + "/" + year;
    document.getElementById("dashboardMonthInfo").innerText = `Datos para: ${monthName} ${year} (del ${firstDay} al ${lastDayStr})`;
    
    // Filtrar ventas del mes para el tipo activo
    const monthSales = salesData.filter((sale) => {
      const saleDate = parseDateAsLocal(sale.date);
      return saleDate.getFullYear() === year &&
             saleDate.getMonth() + 1 === month &&
             sale.type === activeSaleType;
    });
    // Total de ventas y promedio por transacción (mes)
    const totalSales = monthSales.reduce((sum, sale) => sum + sale.amount, 0);
    const avgSale = monthSales.length > 0 ? totalSales / monthSales.length : 0;
    
    const container = document.getElementById("indicatorsContainer");
    container.innerHTML = "";
    
    // Tarjeta: Venta Total (Mes)
    const colTotal = document.createElement("div");
    colTotal.className = "col-md-4 mb-3";
    const cardTotal = document.createElement("div");
    cardTotal.className = "card text-white bg-secondary";
    const cardBodyTotal = document.createElement("div");
    cardBodyTotal.className = "card-body";
    const titleTotal = document.createElement("h5");
    titleTotal.className = "card-title";
    titleTotal.textContent = "Venta Total (Mes)";
    const textTotal = document.createElement("p");
    textTotal.className = "card-text";
    textTotal.textContent = "Q" + totalSales.toFixed(2);
    cardBodyTotal.appendChild(titleTotal);
    cardBodyTotal.appendChild(textTotal);
    cardTotal.appendChild(cardBodyTotal);
    colTotal.appendChild(cardTotal);
    container.appendChild(colTotal);
    
    // Tarjeta: Promedio de Venta (Mes) - por transacción
    const colAvg = document.createElement("div");
    colAvg.className = "col-md-4 mb-3";
    const cardAvg = document.createElement("div");
    cardAvg.className = "card text-white bg-warning";
    const cardBodyAvg = document.createElement("div");
    cardBodyAvg.className = "card-body";
    const titleAvg = document.createElement("h5");
    titleAvg.className = "card-title";
    titleAvg.textContent = "Promedio (Mes)";
    const textAvg = document.createElement("p");
    textAvg.className = "card-text";
    textAvg.textContent = "Q" + (monthSales.length > 0 ? (totalSales / monthSales.length).toFixed(2) : "0.00");
    cardBodyAvg.appendChild(titleAvg);
    cardBodyAvg.appendChild(textAvg);
    cardAvg.appendChild(cardBodyAvg);
    colAvg.appendChild(cardAvg);
    container.appendChild(colAvg);
    
    // Tarjeta: Promedio de Venta Diario
    const colDailyAvg = document.createElement("div");
    colDailyAvg.className = "col-md-4 mb-3";
    const cardDailyAvg = document.createElement("div");
    cardDailyAvg.className = "card text-white bg-info";
    const cardBodyDailyAvg = document.createElement("div");
    cardBodyDailyAvg.className = "card-body";
    const titleDailyAvg = document.createElement("h5");
    titleDailyAvg.className = "card-title";
    titleDailyAvg.textContent = "Promedio Diario";
    const dailyAvg = totalSales / getDaysInMonth(year, month);
    const textDailyAvg = document.createElement("p");
    textDailyAvg.className = "card-text";
    textDailyAvg.textContent = "Q" + dailyAvg.toFixed(2);
    const textDailyRange = document.createElement("small");
    textDailyRange.className = "text-light";
    textDailyRange.textContent = ` (del ${firstDay} al ${lastDayStr})`;
    cardBodyDailyAvg.appendChild(titleDailyAvg);
    cardBodyDailyAvg.appendChild(textDailyAvg);
    cardBodyDailyAvg.appendChild(textDailyRange);
    cardDailyAvg.appendChild(cardBodyDailyAvg);
    colDailyAvg.appendChild(cardDailyAvg);
    container.appendChild(colDailyAvg);
  }
  
  /* ====================================================
     INDICADORES DE CRECIMIENTO (DIARIO Y SEMANAL)
     ==================================================== */
  function updateGrowthIndicators(year, month) {
    const daysInMonth = getDaysInMonth(year, month);
    const dailyTotals = new Array(daysInMonth).fill(0);
    salesData.forEach((sale) => {
      const saleDate = parseDateAsLocal(sale.date);
      if (
        saleDate.getFullYear() === year &&
        saleDate.getMonth() + 1 === month &&
        sale.type === activeSaleType
      ) {
        const day = saleDate.getDate();
        dailyTotals[day - 1] += sale.amount;
      }
    });
    let dailyGrowthText = "";
    if (daysInMonth >= 2 && dailyTotals[dailyTotals.length - 2] > 0) {
      const growthDaily = ((dailyTotals[dailyTotals.length - 1] - dailyTotals[dailyTotals.length - 2]) / dailyTotals[dailyTotals.length - 2]) * 100;
      const iconDaily = growthDaily >= 0 ? "🔼" : "🔽";
      dailyGrowthText = `Crecimiento Diario: ${iconDaily} ${Math.abs(growthDaily).toFixed(2)}%`;
    } else {
      dailyGrowthText = "Crecimiento Diario: N/A";
    }
    let weeklyGrowthText = "";
    if (daysInMonth >= 14) {
      const last7 = dailyTotals.slice(-7).reduce((a, b) => a + b, 0);
      const prev7 = dailyTotals.slice(-14, -7).reduce((a, b) => a + b, 0);
      if (prev7 > 0) {
        const growthWeekly = ((last7 - prev7) / prev7) * 100;
        const iconWeekly = growthWeekly >= 0 ? "🔼" : "🔽";
        weeklyGrowthText = `Crecimiento Semanal: ${iconWeekly} ${Math.abs(growthWeekly).toFixed(2)}%`;
      } else {
        weeklyGrowthText = "Crecimiento Semanal: N/A";
      }
    } else {
      weeklyGrowthText = "Crecimiento Semanal: N/A";
    }
    const additionalContainer = document.getElementById("additionalTrendIndicator");
    additionalContainer.innerHTML = `<p>${dailyGrowthText}</p><p>${weeklyGrowthText}</p>`;
  }
  
  /* ====================================================
     TENDENCIA DEL MES
     ==================================================== */
  function showTrend() {
    const year = parseInt(document.getElementById("chartFilterYear").value);
    const month = parseInt(document.getElementById("chartFilterMonth").value);
    if (!year || !month || !activeSaleType) {
      alert("Por favor seleccione año, mes y un tipo de venta en el Dashboard.");
      return;
    }
    const monthSales = salesData.filter((sale) => {
      const saleDate = parseDateAsLocal(sale.date);
      return saleDate.getFullYear() === year &&
             saleDate.getMonth() + 1 === month &&
             sale.type === activeSaleType;
    });
    const currentTotal = monthSales.reduce((sum, sale) => sum + sale.amount, 0);
    let prevYear = year, prevMonth = month - 1;
    if (prevMonth < 1) { prevMonth = 12; prevYear = year - 1; }
    const prevSales = salesData.filter((sale) => {
      const saleDate = parseDateAsLocal(sale.date);
      return saleDate.getFullYear() === prevYear &&
             saleDate.getMonth() + 1 === prevMonth &&
             sale.type === activeSaleType;
    });
    const prevTotal = prevSales.reduce((sum, sale) => sum + sale.amount, 0);
    let trendText = "";
    if (prevTotal > 0) {
      const trendPercentage = ((currentTotal - prevTotal) / prevTotal) * 100;
      const trendIcon = trendPercentage >= 0 ? "🔼" : "🔽";
      trendText = "Tendencia Mensual: " + trendIcon + " " + Math.abs(trendPercentage).toFixed(2) +
                  "% (Comparado con " + prevMonth + "/" + prevYear + ")";
    } else {
      trendText = "Tendencia Mensual: N/A (sin datos del mes anterior)";
    }
    document.getElementById("trendIndicator").innerText = trendText;
  }
  
  /* ====================================================
     LISTADO DE VENTAS DETALLADAS (CRUD)
     ==================================================== */
  function loadSalesDetailed() {
    const filterYear = document.getElementById("filterYear").value;
    const filterMonth = document.getElementById("filterMonth").value;
    const tableHeader = document.getElementById("salesTableHeader");
    const tableBody = document.getElementById("salesTableBody");
    if (!activeSaleType) {
      tableHeader.innerHTML = "";
      tableBody.innerHTML =
        "<tr><td colspan='4' class='text-center'>Por favor, seleccione un tipo de venta para ver las ventas detalladas.</td></tr>";
      return;
    }
    if (filterYear === "" || filterMonth === "") {
      tableHeader.innerHTML = "";
      tableBody.innerHTML =
        "<tr><td colspan='4' class='text-center'>Por favor, ingrese primero el mes y el año para cargar los datos.</td></tr>";
      return;
    }
    tableHeader.innerHTML = "<tr><th>Fecha</th><th>Día</th><th>Monto (Q)</th><th>Acciones</th></tr>";
    tableBody.innerHTML = "";
    const filteredSales = salesData
      .map((sale, idx) => ({ sale, idx }))
      .filter((item) => {
        const saleDate = parseDateAsLocal(item.sale.date);
        return saleDate.getFullYear().toString() === filterYear &&
               (saleDate.getMonth() + 1).toString() === filterMonth &&
               item.sale.type === activeSaleType;
      });
    filteredSales.forEach((item) => {
      const record = item.sale;
      const origIndex = item.idx;
      const tr = document.createElement("tr");
      const parts = record.date.split("-");
      const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      const dateObj = parseDateAsLocal(record.date);
      const dayName = dateObj.toLocaleDateString("es-ES", { weekday: "long" });
      const tdDate = document.createElement("td");
      tdDate.textContent = formattedDate;
      const tdDay = document.createElement("td");
      tdDay.textContent = dayName;
      const tdAmount = document.createElement("td");
      tdAmount.textContent = "Q" + Number(record.amount).toFixed(2);
      const tdActions = document.createElement("td");
      const btnEdit = document.createElement("button");
      btnEdit.className = "btn btn-sm btn-primary me-1";
      btnEdit.innerHTML = '<i class="fa-solid fa-pencil"></i>';
      btnEdit.onclick = () => { editSale(origIndex); };
      const btnDelete = document.createElement("button");
      btnDelete.className = "btn btn-sm btn-danger";
      btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
      btnDelete.onclick = () => { deleteSale(origIndex); };
      tdActions.appendChild(btnEdit);
      tdActions.appendChild(btnDelete);
      tr.appendChild(tdDate);
      tr.appendChild(tdDay);
      tr.appendChild(tdAmount);
      tr.appendChild(tdActions);
      tableBody.appendChild(tr);
    });
  }
  
  /* ====================================================
     OPERACIONES CON FIREBASE: GUARDAR, EDITAR Y BORRAR
     ==================================================== */
  function saveSale() {
    const saleDate = document.getElementById("saleDate").value;
    const saleAmount = parseFloat(document.getElementById("saleAmount").value);
    if (!saleDate || isNaN(saleAmount)) {
      alert("Por favor complete todos los campos con valores válidos.");
      return;
    }
    const saleObj = { date: saleDate, type: activeSaleType, amount: saleAmount };
    if (currentEditIndex === null) {
      db.collection("sales").add(saleObj)
        .then(() => {
          loadSalesData();
          const saleModalEl = document.getElementById("saleModal");
          const saleModal = bootstrap.Modal.getInstance(saleModalEl);
          saleModal.hide();
          document.getElementById("saleForm").reset();
          document.activeElement.blur();
        })
        .catch((error) => {
          console.error("Error al guardar la venta:", error);
        });
    } else {
      const docId = salesData[currentEditIndex].id;
      db.collection("sales").doc(docId).update(saleObj)
        .then(() => {
          currentEditIndex = null;
          document.getElementById("saleModalLabel").innerText = "Agregar Venta Diaria";
          loadSalesData();
          const saleModalEl = document.getElementById("saleModal");
          const saleModal = bootstrap.Modal.getInstance(saleModalEl);
          saleModal.hide();
          document.getElementById("saleForm").reset();
          document.activeElement.blur();
        })
        .catch((error) => {
          console.error("Error al actualizar la venta:", error);
        });
    }
  }
  
  function editSale(index) {
    currentEditIndex = index;
    const sale = salesData[index];
    document.getElementById("saleDate").value = sale.date;
    document.getElementById("saleAmount").value = sale.amount;
    document.getElementById("saleModalLabel").innerText = "Editar Venta Diaria";
    const saleModal = new bootstrap.Modal(document.getElementById("saleModal"));
    saleModal.show();
  }
  
  function deleteSale(index) {
    if (confirm("¿Está seguro de eliminar esta venta?")) {
      const docId = salesData[index].id;
      db.collection("sales").doc(docId).delete()
        .then(() => { loadSalesData(); })
        .catch((error) => {
          console.error("Error al eliminar la venta:", error);
        });
    }
  }
  
  function saveSaleType() {
    const typeLabelInput = document.getElementById("saleTypeLabel");
    const typeColorInput = document.getElementById("saleTypeColor");
    const label = typeLabelInput.value.trim();
    const color = typeColorInput.value;
    if (!label) {
      alert("Ingrese un nombre para el tipo de venta.");
      return;
    }
    const generatedId = label.toLowerCase().replace(/\s+/g, "_");
    const exists = saleTypes.some(t => t.id === generatedId);
    if (exists) {
      alert("Ya existe un tipo de venta con ese nombre.");
      return;
    }
    db.collection("saleTypes").add({ id: generatedId, label, color })
      .then(() => {
        loadSaleTypes();
        loadSalesData();
        const saleTypeModalEl = document.getElementById("saleTypeModal");
        const saleTypeModal = bootstrap.Modal.getInstance(saleTypeModalEl);
        saleTypeModal.hide();
        document.getElementById("saleTypeForm").reset();
        document.activeElement.blur();
      })
      .catch((error) => {
        console.error("Error al guardar el tipo de venta:", error);
      });
  }
  
  /* ====================================================
     BOTÓN PARA MINIMIZAR EL MENÚ Y AJUSTAR EL CONTENIDO
     ==================================================== */
  function toggleSidebar() {
    const sidebar = document.getElementById("sidebarMenu");
    const mainContent = document.getElementById("mainContent");
    sidebar.classList.toggle("minimized");
    mainContent.classList.toggle("full-width");
  }
  
  /* ====================================================
     INICIALIZACIÓN GLOBAL
     ==================================================== */
  window.onload = function () {
    const chartFilterYear = document.getElementById("chartFilterYear");
    const chartFilterMonth = document.getElementById("chartFilterMonth");
    chartFilterYear.innerHTML =
      '<option value="">Seleccione Año</option><option value="2024">2024</option><option value="2025" selected>2025</option>';
    chartFilterMonth.innerHTML =
      '<option value="">Seleccione Mes</option>' +
      '<option value="1">Enero</option>' +
      '<option value="2" selected>Febrero</option>' +
      '<option value="3">Marzo</option>' +
      '<option value="4">Abril</option>' +
      '<option value="5">Mayo</option>' +
      '<option value="6">Junio</option>' +
      '<option value="7">Julio</option>' +
      '<option value="8">Agosto</option>' +
      '<option value="9">Septiembre</option>' +
      '<option value="10">Octubre</option>' +
      '<option value="11">Noviembre</option>' +
      '<option value="12">Diciembre</option>';
    loadSaleTypes();
    loadSalesData();
    document.getElementById("dashboardContent").style.display = "none";
  };
  