const example = [
  {number:"000124",client:"Studio Horizonte",date:"18/09/2026",value:3250,status:"valid"},
  {number:"000123",client:"Almeida & Costa Ltda.",date:"12/09/2026",value:1800,status:"valid"},
  {number:"000122",client:"Norte Digital",date:"08/09/2026",value:2400,status:"cancelled"},
  {number:"000121",client:"Clínica Nutri Verde",date:"02/09/2026",value:4750,status:"valid"},
  {number:"000120",client:"Oliveira Consultoria",date:"25/08/2026",value:2100,status:"substituted"}
];
const labels = {valid:"Válida",cancelled:"Cancelada",substituted:"Substituída",unknown:"Não identificada"};
const colors = {valid:"#5274f4",cancelled:"#f2ae76",substituted:"#a382df",unknown:"#aeb9c9"};
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const monthFormat = new Intl.DateTimeFormat("pt-BR",{month:"short",year:"2-digit",timeZone:"UTC"});
const $ = selector => document.querySelector(selector);
let notes = example;
let demo = true;

function dateKey(value) {
  const br = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return [br[3],br[2],br[1]].join("-");
  return String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

function filteredNotes() {
  const query = $("#search-input").value.trim().toLocaleLowerCase("pt-BR");
  const status = $("#status-filter").value;
  const from = $("#date-from").value;
  const to = $("#date-to").value;
  return notes.filter(note => {
    const date = dateKey(note.date);
    return (status === "all" || note.status === status) &&
      (!from || (date && date >= from)) && (!to || (date && date <= to)) &&
      [note.number,note.client,note.rawStatus].join(" ").toLocaleLowerCase("pt-BR").includes(query);
  });
}

function renderTable(rows) {
  const body = $("#notes-body");
  body.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "empty-row";
    td.textContent = "Nenhuma nota encontrada para os filtros escolhidos.";
    tr.append(td);
    body.append(tr);
  }
  rows.forEach(note => {
    const tr = document.createElement("tr");
    [note.number || "—",note.client || "—",note.date || "—",money.format(note.value)].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    const td = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status " + note.status;
    badge.textContent = labels[note.status];
    if (note.rawStatus) badge.title = "Situação no portal: " + note.rawStatus;
    td.append(badge);
    tr.append(td);
    body.append(tr);
  });
  $("#result-count").textContent = rows.length + " de " + notes.length + " notas exibidas";
}

function renderSummary(rows) {
  const count = {valid:0,cancelled:0,substituted:0,unknown:0};
  let total = 0;
  rows.forEach(note => { count[note.status]++; if (note.status === "valid") total += note.value; });
  $("#metric-total").textContent = money.format(total);
  $("#metric-valid").textContent = count.valid;
  $("#metric-cancelled").textContent = count.cancelled;
  $("#metric-substituted").textContent = count.substituted;
  $("#donut-total").textContent = rows.length;
  const legend = $("#status-legend");
  legend.replaceChildren();
  const slices = [];
  let start = 0;
  Object.keys(labels).forEach(status => {
    const percentage = rows.length ? count[status] / rows.length * 100 : 0;
    if (count[status]) {
      slices.push(colors[status] + " " + start + "% " + (start + percentage) + "%");
      start += percentage;
    }
    const line = document.createElement("div");
    const name = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = "legend-dot " + status;
    name.append(dot,document.createTextNode(labels[status]));
    const value = document.createElement("strong");
    value.textContent = count[status] + " (" + percentage.toFixed(1).replace(".",",") + "%)";
    line.append(name,value);
    legend.append(line);
  });
  $("#status-donut").style.background = slices.length ? "conic-gradient(" + slices.join(",") + ")" : "#e7ebf3";
}

function renderChart(rows) {
  const monthly = new Map();
  rows.forEach(note => {
    const date = dateKey(note.date);
    if (note.status !== "valid" || !date) return;
    const key = date.slice(0,7);
    monthly.set(key,(monthly.get(key) || 0) + note.value);
  });
  const keys = [...monthly.keys()].sort().slice(-6);
  const chart = $("#chart-area");
  chart.replaceChildren();
  if (!keys.length) {
    const message = document.createElement("p");
    message.className = "empty-row";
    message.textContent = "Sem notas válidas com data para o gráfico.";
    chart.append(message);
    return;
  }
  const max = Math.max(...keys.map(key => monthly.get(key)));
  const scale = document.createElement("div");
  scale.className = "grid-lines";
  [max,max*2/3,max/3,0].forEach(amount => {
    const tick = document.createElement("span");
    tick.textContent = amount >= 1000 ? Math.round(amount/1000) + " mil" : Math.round(amount);
    scale.append(tick);
  });
  const bars = document.createElement("div");
  bars.className = "bars";
  keys.forEach(key => {
    const item = document.createElement("div");
    const bar = document.createElement("span");
    bar.style.setProperty("--bar",Math.max(5,monthly.get(key)/max*90) + "%");
    bar.title = key + ": " + money.format(monthly.get(key));
    const caption = document.createElement("small");
    caption.textContent = monthFormat.format(new Date(key + "-01T00:00:00Z")).toUpperCase().replace(".","");
    item.append(bar,caption);
    bars.append(item);
  });
  chart.append(scale,bars);
}

function render() {
  const rows = filteredNotes();
  renderTable(rows);
  renderSummary(rows);
  renderChart(rows);
  ["#export-button","#export-csv-button"].forEach(selector => {
    $(selector).disabled = demo || !rows.length;
    $(selector).classList.toggle("button-disabled",demo || !rows.length);
  });
}

function receiveNotes(incoming) {
  if (!Array.isArray(incoming) || incoming.length > 10000) return;
  notes = incoming.map(item => {
    if (!item || typeof item !== "object") return null;
    const value = Number(item.value);
    return {
      number:String(item.number || "").slice(0,80),
      client:String(item.client || "").slice(0,250),
      date:String(item.date || "").slice(0,30),
      value:Number.isFinite(value) ? value : 0,
      status:Object.hasOwn(labels,item.status) ? item.status : "unknown",
      rawStatus:String(item.rawStatus || "").slice(0,160)
    };
  }).filter(Boolean);
  demo = false;
  $("#search-input").value = "";
  $("#status-filter").value = "all";
  $("#date-from").value = "";
  $("#date-to").value = "";
  $("#data-description").textContent = "Notas coletadas da sua sessão no portal. Use os filtros para explorar.";
  $("#data-label").textContent = "DADOS DO PORTAL";
  $("#source-label").textContent = "Coletadas do portal";
  $("#portal-feedback").hidden = false;
  $("#portal-feedback").textContent = notes.length + " notas recebidas do portal. Os dados ficam somente nesta aba.";
  render();
  $("#visualizacao").scrollIntoView({behavior:"smooth"});
}

window.addEventListener("message",event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== "nfse-analyzer-extension") return;
  if (event.data.type === "ready") $("#connection-badge").textContent = "Complemento conectado";
  if (event.data.type === "notes") receiveNotes(event.data.notes);
});

["#search-input","#status-filter","#date-from","#date-to"].forEach(selector => {
  $(selector).addEventListener(selector === "#search-input" ? "input" : "change",render);
});

function csvCell(value) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
}
$("#export-csv-button").addEventListener("click",() => {
  if (demo) return;
  const rows = [["Número","Cliente","Emissão","Valor (R$)","Situação","Situação original"]];
  filteredNotes().forEach(note => rows.push([note.number,note.client,note.date,note.value.toFixed(2).replace(".",","),labels[note.status],note.rawStatus]));
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "nfse-analyzer-notas.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});

function downloadBlob(blob,filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function styleHeader(sheet) {
  sheet.getRow(1).height = 27;
  sheet.getRow(1).eachCell(cell => {
    cell.fill = {type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}};
    cell.font = {bold:true,color:{argb:"FFFFFFFF"}};
    cell.alignment = {vertical:"middle",horizontal:"center"};
  });
}

$("#export-button").addEventListener("click",async () => {
  if (demo || typeof ExcelJS === "undefined") return;
  const button = $("#export-button");
  const rows = filteredNotes();
  if (!rows.length) return;
  button.disabled = true;
  button.textContent = "Preparando Excel…";
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NFSe Analyzer";
    const summary = workbook.addWorksheet("Resumo");
    summary.columns = [{width:31},{width:21}];
    summary.addRow(["Indicador","Valor"]);
    const count = {valid:0,cancelled:0,substituted:0,unknown:0};
    const totals = {valid:0,cancelled:0};
    rows.forEach(note => {
      count[note.status]++;
      if (note.status === "valid" || note.status === "cancelled") totals[note.status] += note.value;
    });
    [
      ["Quantidade total lida",rows.length],
      ["Notas válidas",count.valid],
      ["Notas canceladas",count.cancelled],
      ["Notas substituídas",count.substituted],
      ["Notas não identificadas",count.unknown],
      ["Total notas válidas",totals.valid],
      ["Total notas canceladas",totals.cancelled]
    ].forEach(item => summary.addRow(item));
    styleHeader(summary);
    [7,8].forEach(row => { summary.getCell(`B${row}`).numFmt = '"R$" #,##0.00'; });
    summary.views = [{state:"frozen",ySplit:1}];

    const sheet = workbook.addWorksheet("Notas");
    sheet.columns = [
      {header:"Número",width:18},
      {header:"Cliente",width:90},
      {header:"Emissão",width:16},
      {header:"Valor",width:19},
      {header:"Situação",width:22},
      {header:"Situação original",width:35}
    ];
    styleHeader(sheet);
    rows.forEach(note => {
      const row = sheet.addRow([note.number,note.client,note.date,note.value,labels[note.status],note.rawStatus]);
      row.getCell(4).numFmt = '"R$" #,##0.00';
      row.alignment = {vertical:"middle"};
      row.height = 21;
      if (note.status === "cancelled") {
        row.eachCell(cell => { cell.fill = {type:"pattern",pattern:"solid",fgColor:{argb:"FFFCE4D6"}}; });
      } else if (note.status === "substituted") {
        row.eachCell(cell => { cell.fill = {type:"pattern",pattern:"solid",fgColor:{argb:"FFF0EAFF"}}; });
      }
    });
    sheet.autoFilter = {from:"A1",to:`F${rows.length + 1}`};
    sheet.views = [{state:"frozen",ySplit:1}];
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"nfse-analyzer-notas.xlsx");
  } catch (error) {
    console.error("Falha ao exportar Excel",error);
    window.alert("Não foi possível gerar a planilha Excel. Tente novamente.");
  } finally {
    button.textContent = "↧ Exportar XLSX";
    button.disabled = false;
  }
});

$("#year").textContent = new Date().getFullYear();
render();
