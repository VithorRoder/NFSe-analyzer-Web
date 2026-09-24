// Organiza localmente os XMLs do ZIP do ADN e relaciona eventos às notas.
const adnZipInput = document.querySelector("#adn-zip-input");
const adnCompany = document.querySelector("#adn-company");
const adnDirection = document.querySelector("#adn-direction");
const adnPeriodKind = document.querySelector("#adn-period-kind");
const adnMonthFrom = document.querySelector("#adn-month-from");
const adnMonthTo = document.querySelector("#adn-month-to");
const adnStatusFilter = document.querySelector("#adn-status-filter");
const adnOrganizeButton = document.querySelector("#adn-organize-button");
const adnIncludePdf = document.querySelector("#adn-include-pdf");
const adnOrganizeFeedback = document.querySelector("#adn-organize-feedback");
const adnPreview = document.querySelector("#adn-batch-preview");
const adnPreviewSearch = document.querySelector("#adn-preview-search");
const adnPreviewBody = document.querySelector("#adn-preview-body");
const adnPreviewSummary = document.querySelector("#adn-preview-summary");
const adnPreviewCount = document.querySelector("#adn-preview-count");
const adnPreviewPrev = document.querySelector("#adn-preview-prev");
const adnPreviewNext = document.querySelector("#adn-preview-next");
const adnDetail = document.querySelector("#adn-note-detail");
const adnDetailContent = document.querySelector("#adn-note-detail-content");
let adnDocuments = null;
let adnPreviewPage = 0;

function adnChild(node, name) {
  return [...(node?.children || [])].find(child => child.localName === name) || null;
}

function adnNode(node, ...path) {
  return path.reduce((current, name) => adnChild(current, name), node);
}

function adnText(node, ...path) {
  return adnNode(node, ...path)?.textContent?.trim() || "";
}

function adnXmlDocument(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("XML inválido no ZIP.");
  return xml.documentElement;
}

function adnMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function adnOptionalMoney(value) {
  return value === "" ? null : adnMoney(value);
}

function adnFiscalFields(root) {
  const fields = [];
  const visit = (node, path) => {
    if (!node) return;
    if (!node.children.length) {
      const value = node.textContent.trim();
      if (value) fields.push({ path, value });
      return;
    }
    for (const child of node.children) visit(child, `${path}/${child.localName}`);
  };
  const info = adnNode(root, "infNFSe");
  const dps = adnNode(info, "DPS", "infDPS");
  visit(adnNode(info, "valores"), "NFSe/valores");
  visit(adnNode(dps, "valores"), "DPS/valores");
  return fields;
}

function adnSafe(value, fallback) {
  return String(value || fallback).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 70) || fallback;
}

function adnParseNote(root, bytes, sourceName) {
  const info = adnNode(root, "infNFSe");
  const dps = adnNode(info, "DPS", "infDPS");
  const key = String(info?.getAttribute("Id") || "").replace(/^NFS/, "");
  if (!info || !dps || !/^\d{50}$/.test(key)) throw new Error("NFS-e sem chave válida no ZIP.");
  const issuer = adnNode(info, "emit");
  const recipient = adnNode(dps, "toma");
  return {
    key, bytes, sourceName, events: [], status: "valid", fiscalFields: adnFiscalFields(root),
    number: adnText(info, "nNFSe"),
    issue: adnText(dps, "dhEmi").slice(0, 10) || adnText(info, "dhProc").slice(0, 10),
    competence: adnText(dps, "dCompet").slice(0, 7),
    issuerId: adnText(issuer, "CNPJ") || adnText(issuer, "CPF"),
    issuerName: adnText(issuer, "xNome"),
    recipientId: adnText(recipient, "CNPJ") || adnText(recipient, "CPF"),
    recipientName: adnText(recipient, "xNome"),
    service: adnText(dps, "serv", "cServ", "xDescServ"),
    serviceCode: adnText(dps, "serv", "cServ", "cTribNac"),
    serviceValue: adnMoney(adnText(dps, "valores", "vServPrest", "vServ")),
    netValue: adnOptionalMoney(adnText(info, "valores", "vLiq")),
    issValue: adnOptionalMoney(adnText(info, "valores", "vISSQN")),
    cofinsValue: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "piscofins", "vCofins")),
    pisValue: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "piscofins", "vPis")),
    issBase: adnOptionalMoney(adnText(info, "valores", "vBC")),
    issRate: adnOptionalMoney(adnText(info, "valores", "pAliqAplic")),
    totalRetained: adnOptionalMoney(adnText(info, "valores", "vTotalRet")),
    pisCofinsBase: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "piscofins", "vBCPisCofins")),
    pisRate: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "piscofins", "pAliqPis")),
    cofinsRate: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "piscofins", "pAliqCofins")),
    issRetentionCode: adnText(dps, "valores", "trib", "tribMun", "tpRetISSQN"),
    pisCofinsRetentionCode: adnText(dps, "valores", "trib", "tribFed", "piscofins", "tpRetPisCofins"),
    csllRetained: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "vRetCSLL")),
    irrfRetained: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "vRetIRRF")),
    socialSecurityRetained: adnOptionalMoney(adnText(dps, "valores", "trib", "tribFed", "vRetCP")),
    conditionalDiscount: adnOptionalMoney(adnText(dps, "valores", "vDescCondIncond", "vDescCond")),
    unconditionalDiscount: adnOptionalMoney(adnText(dps, "valores", "vDescCondIncond", "vDescIncond"))
  };
}

function adnParseEvent(root, bytes, sourceName) {
  const info = adnNode(root, "infEvento");
  const request = adnNode(info, "pedRegEvento", "infPedReg");
  const key = adnText(request, "chNFSe");
  const eventType = [...(request?.children || [])].find(child => /^e\d{6}$/.test(child.localName))?.localName || "";
  if (!/^\d{50}$/.test(key) || !eventType) throw new Error("Evento sem chave ou tipo válido no ZIP.");
  return { key, eventType, date: adnText(request, "dhEvento"), bytes, sourceName };
}

function adnLinkEvents(notes, events) {
  const byKey = new Map(notes.map(note => [note.key, note]));
  let unmatched = 0;
  for (const event of events) {
    const note = byKey.get(event.key);
    if (!note) { unmatched++; continue; }
    note.events.push(event);
    if (event.eventType === "e105102") note.status = "substituted";
    else if (event.eventType === "e101101" && note.status !== "substituted") note.status = "cancelled";
  }
  return unmatched;
}

async function adnReadZip(file) {
  if (file.size > 100 * 1024 * 1024) throw new Error("O ZIP deve ter no máximo 100 MB.");
  const archive = await JSZip.loadAsync(file);
  const entries = Object.values(archive.files).filter(entry => !entry.dir && entry.name.toLowerCase().endsWith(".xml"));
  if (!entries.length || entries.length > 5000) throw new Error("Selecione um ZIP do ADN com até 5.000 XMLs.");
  const notes = [];
  const events = [];
  for (let index = 0; index < entries.length; index++) {
    if (index % 50 === 0) adnOrganizeFeedback.textContent = `Lendo XMLs: ${index}/${entries.length}…`;
    const entry = entries[index];
    const bytes = await entry.async("uint8array");
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Há um XML maior que 5 MB no ZIP.");
    const root = adnXmlDocument(bytes);
    if (root.localName === "NFSe") notes.push(adnParseNote(root, bytes, entry.name));
    else if (root.localName === "evento") events.push(adnParseEvent(root, bytes, entry.name));
    else throw new Error("O ZIP contém um XML que não é NFS-e nem evento.");
  }
  const unmatched = adnLinkEvents(notes, events);
  return { notes, events, unmatched };
}

function adnSelectedNotes() {
  const from = adnMonthFrom.value;
  const to = adnMonthTo.value;
  if (from && to && from > to) throw new Error("O mês inicial deve ser anterior ao final.");
  return adnDocuments.notes.filter(note => {
    const month = adnPeriodKind.value === "competence" ? note.competence : note.issue.slice(0, 7);
    const role = note.issuerId === adnCompany.value ? "issued" :
      note.recipientId === adnCompany.value ? "received" : "other";
    return (!adnCompany.value || (role !== "other" && (!adnDirection.value || adnDirection.value === role))) &&
      (!adnStatusFilter.value || note.status === adnStatusFilter.value) &&
      (!from || month >= from) && (!to || month <= to);
  });
}

const adnFormatMoney = value => value == null ? "Não informado" :
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const adnStatusNames = { valid: "Válida", cancelled: "Cancelada", substituted: "Substituída" };

function adnRenderBatchPreview() {
  if (!adnDocuments) { adnPreview.hidden = true; return; }
  const selected = adnSelectedNotes();
  const query = adnPreviewSearch.value.trim().toLocaleLowerCase("pt-BR");
  const matches = query ? selected.filter(note =>
    [note.key, note.number, note.issuerName, note.recipientName, note.issuerId, note.recipientId]
      .some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(query))) : selected;
  const valid = selected.filter(note => note.status === "valid");
  adnPreviewSummary.textContent = `${selected.length} nota(s) selecionada(s) · ${valid.length} válida(s) · ` +
    `${selected.length - valid.length} cancelada(s) ou substituída(s) · ` +
    `Total válido: ${adnFormatMoney(valid.reduce((sum, note) => sum + note.serviceValue, 0))}`;
  const pageSize = 100;
  adnPreviewPage = Math.min(adnPreviewPage, Math.max(0, Math.ceil(matches.length / pageSize) - 1));
  adnPreviewBody.replaceChildren();
  for (const note of matches.slice(adnPreviewPage * pageSize, (adnPreviewPage + 1) * pageSize)) {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.className = `adn-row-${note.status}`;
    for (const value of [note.number || "—", note.issue || "—", note.issuerName || note.issuerId || "—",
      note.recipientName || note.recipientId || "—", adnFormatMoney(note.serviceValue), adnStatusNames[note.status]]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const open = () => adnShowNoteDetail(note);
    row.addEventListener("click", open);
    row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    adnPreviewBody.append(row);
  }
  adnPreviewCount.textContent = `${matches.length ? adnPreviewPage * pageSize + 1 : 0}–${Math.min(matches.length, (adnPreviewPage + 1) * pageSize)} de ${matches.length} resultado(s).`;
  adnPreviewPrev.disabled = adnPreviewPage === 0;
  adnPreviewNext.disabled = (adnPreviewPage + 1) * pageSize >= matches.length;
  adnPreview.hidden = false;
}

function adnShowNoteDetail(note) {
  adnDetailContent.replaceChildren();
  const rows = [
    ["Chave", note.key], ["Número", note.number], ["Emissão", note.issue],
    ["Competência", note.competence], ["Situação", adnStatusNames[note.status]],
    ["Prestador", `${note.issuerId} — ${note.issuerName}`],
    ["Tomador", `${note.recipientId} — ${note.recipientName}`],
    ["Serviço", note.service], ["Código do serviço", note.serviceCode],
    ["Valor do serviço", adnFormatMoney(note.serviceValue)],
    ["Valor líquido", adnFormatMoney(note.netValue)],
    ["ISS", adnFormatMoney(note.issValue)], ["PIS", adnFormatMoney(note.pisValue)],
    ["Cofins", adnFormatMoney(note.cofinsValue)],
    ["Eventos", note.events.map(event => `${event.eventType} (${event.date})`).join("; ") || "Nenhum"]
  ];
  const list = document.createElement("dl");
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value || "Não informado";
    list.append(term, detail);
  }
  adnDetailContent.append(list);
  const heading = document.createElement("h4");
  heading.textContent = "Campos fiscais originais do XML";
  adnDetailContent.append(heading);
  const fiscal = document.createElement("dl");
  for (const field of note.fiscalFields) {
    const term = document.createElement("dt");
    term.textContent = field.path;
    const detail = document.createElement("dd");
    detail.textContent = field.value;
    fiscal.append(term, detail);
  }
  adnDetailContent.append(fiscal);
  adnDetail.showModal();
}

document.querySelector("#adn-detail-close").addEventListener("click", () => adnDetail.close());
adnPreviewSearch.addEventListener("input", () => { adnPreviewPage = 0; adnRenderBatchPreview(); });
adnPreviewPrev.addEventListener("click", () => { adnPreviewPage--; adnRenderBatchPreview(); });
adnPreviewNext.addEventListener("click", () => { adnPreviewPage++; adnRenderBatchPreview(); });

function adnPreviewSelection() {
  if (!adnDocuments) return;
  try {
    const notes = adnSelectedNotes();
    adnRenderBatchPreview();
    const company = adnCompany.value;
    const issued = company ? adnDocuments.notes.filter(note => note.issuerId === company).length : 0;
    const received = company ? adnDocuments.notes.filter(note => note.recipientId === company && note.issuerId !== company).length : 0;
    adnOrganizeFeedback.textContent = `${adnDocuments.notes.length} NFS-e e ${adnDocuments.events.length} evento(s) no ZIP. ` +
      (company ? `Para a empresa selecionada: ${issued} emitida(s) e ${received} recebida(s). ` : "Selecione uma empresa para separar emitidas e recebidas. ") +
      `${notes.length} nota(s) correspondem aos filtros. ` +
      (adnDocuments.unmatched ? `${adnDocuments.unmatched} evento(s) sem nota correspondente.` : "Todos os eventos foram associados.");
  } catch (error) {
    adnOrganizeFeedback.textContent = error.message;
  }
}

function adnBuildReport(notes, companyId) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NFSe Analyzer";
  const summary = workbook.addWorksheet("Resumo");
  const valid = notes.filter(note => note.status === "valid");
  const cancelled = notes.filter(note => note.status === "cancelled");
  const substituted = notes.filter(note => note.status === "substituted");
  summary.addRows([
    ["Relatório do ADN", "NFS-e", "Valor dos serviços (R$)"],
    ["Válidas", valid.length, valid.reduce((sum, note) => sum + note.serviceValue, 0)],
    ["Canceladas", cancelled.length, cancelled.reduce((sum, note) => sum + note.serviceValue, 0)],
    ["Substituídas", substituted.length, substituted.reduce((sum, note) => sum + note.serviceValue, 0)],
    ["Total de documentos", notes.length, notes.reduce((sum, note) => sum + note.serviceValue, 0)],
    ["Total válido", valid.length, valid.reduce((sum, note) => sum + note.serviceValue, 0)],
    ["Retenções informadas", notes.filter(note => note.totalRetained != null).length,
      notes.reduce((sum, note) => sum + (note.totalRetained || 0), 0)],
    ["PIS informado", notes.filter(note => note.pisValue != null).length,
      notes.reduce((sum, note) => sum + (note.pisValue || 0), 0)],
    ["Cofins informado", notes.filter(note => note.cofinsValue != null).length,
      notes.reduce((sum, note) => sum + (note.cofinsValue || 0), 0)]
  ]);
  summary.columns = [{ width: 27 }, { width: 17 }, { width: 29 }];
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF455FCE" } };
  for (let row = 2; row <= 9; row++) summary.getCell(`C${row}`).numFmt = '"R$" #,##0.00';
  const shades = { 2: "FFE9F7F0", 3: "FFFDEEEE", 4: "FFF3EEFC", 5: "FFF0F2F5", 6: "FFE9F7F0" };
  for (const [row, color] of Object.entries(shades)) {
    summary.getRow(Number(row)).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    summary.getRow(Number(row)).font = { bold: true };
  }
  const details = workbook.addWorksheet("Notas");
  details.columns = [
    ["Chave", "key", 53], ["Número", "number", 15], ["Emissão", "issue", 16],
    ["Competência", "competence", 17], ["Situação", "status", 18],
    ["Direção", "direction", 17],
    ["Prestador CNPJ/CPF", "issuerId", 22], ["Prestador", "issuerName", 45],
    ["Tomador CNPJ/CPF", "recipientId", 22], ["Tomador", "recipientName", 45],
    ["Código serviço", "serviceCode", 18], ["Descrição serviço", "service", 65],
    ["Valor serviço", "serviceValue", 19], ["Valor líquido", "netValue", 19],
    ["ISS", "issValue", 16], ["PIS", "pisValue", 16], ["Cofins", "cofinsValue", 16],
    ["Eventos", "eventCount", 12], ["Base ISS", "issBase", 18],
    ["Alíquota ISS (%)", "issRate", 18], ["Total retido", "totalRetained", 18],
    ["Base PIS/Cofins", "pisCofinsBase", 19],
    ["Desconto condicional", "conditionalDiscount", 22],
    ["Desconto incondicional", "unconditionalDiscount", 24],
    ["Alíquota PIS (%)", "pisRate", 18], ["Alíquota Cofins (%)", "cofinsRate", 20],
    ["ISS retido (código XML)", "issRetentionCode", 23],
    ["PIS/Cofins retido (código XML)", "pisCofinsRetentionCode", 30],
    ["CSLL retida", "csllRetained", 18], ["IRRF retido", "irrfRetained", 18],
    ["Previdência retida", "socialSecurityRetained", 21]
  ].map(([header, key, width]) => ({ header, key, width }));
  details.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  details.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF455FCE" } };
  for (const note of notes) {
    const direction = companyId ? (note.issuerId === companyId ? "Emitida" : note.recipientId === companyId ? "Recebida" : "Outra") : "—";
    const row = details.addRow({ ...note, direction, status: { valid: "Válida", cancelled: "Cancelada", substituted: "Substituída" }[note.status], eventCount: note.events.length });
    if (note.status !== "valid") row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: note.status === "cancelled" ? "FFFDEEEE" : "FFF3EEFC" } };
    for (const column of [13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 29, 30, 31]) row.getCell(column).numFmt = '"R$" #,##0.00';
    for (const column of [20, 25, 26]) row.getCell(column).numFmt = '0.00"%"';
  }
  details.autoFilter = { from: "A1", to: `AE${Math.max(1, notes.length + 1)}` };
  details.views = [{ state: "frozen", ySplit: 1 }];
  const fiscal = workbook.addWorksheet("Campos fiscais XML");
  fiscal.columns = [
    { header: "Chave da NFS-e", key: "key", width: 53 },
    { header: "Número", key: "number", width: 15 },
    { header: "Caminho no XML", key: "path", width: 70 },
    { header: "Valor original", key: "value", width: 30 }
  ];
  fiscal.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  fiscal.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF455FCE" } };
  for (const note of notes) {
    for (const field of note.fiscalFields) fiscal.addRow({ key: note.key, number: note.number, ...field });
  }
  fiscal.views = [{ state: "frozen", ySplit: 1 }];
  fiscal.autoFilter = { from: "A1", to: `D${Math.max(1, fiscal.rowCount)}` };
  return workbook.xlsx.writeBuffer();
}

function adnViewerHtml(notes) {
  const data = notes.map(note => ({
    key: note.key, number: note.number, issue: note.issue, competence: note.competence,
    issuer: note.issuerName, issuerId: note.issuerId, recipient: note.recipientName,
    recipientId: note.recipientId, status: adnStatusNames[note.status],
    service: note.service, serviceValue: note.serviceValue, netValue: note.netValue,
    events: note.events.map(event => `${event.eventType} ${event.date}`),
    fiscalFields: note.fiscalFields
  }));
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visualizador de NFS-e</title>
<style>body{font:16px system-ui;margin:0;color:#1b2741;background:#f5f7ff}main{max-width:1200px;margin:auto;padding:30px}h1{margin:0 0 10px}p{color:#65728a}input,select{padding:12px;border:1px solid #dbe2f0;border-radius:9px;font:inherit}section{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}table{width:100%;border-collapse:collapse;background:white}th,td{padding:12px;text-align:left;border-bottom:1px solid #e5e9f3}th{background:#eef2ff}tbody tr{cursor:pointer}tbody tr:hover{background:#f5f7ff}.wrap{overflow:auto;border-radius:14px;box-shadow:0 3px 20px #17244310}dialog{border:0;border-radius:15px;padding:25px;max-width:780px;width:90%;max-height:85vh;overflow:auto}dialog::backdrop{background:#14223b99}dl{display:grid;grid-template-columns:minmax(140px,1fr) 2fr;gap:8px;overflow-wrap:anywhere}dt{font-weight:700}button{padding:9px 16px;border:0;border-radius:8px;background:#5669d8;color:white;cursor:pointer}</style>
<main><h1>Notas fiscais do lote</h1><p id="summary"></p><section><input id="search" type="search" placeholder="Buscar número, nome ou chave"><select id="status"><option value="">Todas as situações</option><option>Válida</option><option>Cancelada</option><option>Substituída</option></select></section><div class="wrap"><table><thead><tr><th>Número</th><th>Emissão</th><th>Prestador</th><th>Tomador</th><th>Valor</th><th>Situação</th></tr></thead><tbody id="rows"></tbody></table></div><p id="count"></p></main><dialog id="detail"><button id="close">Fechar</button><h2>Detalhes da nota</h2><div id="content"></div></dialog>
<script>const data=${json};const $=id=>document.getElementById(id);const money=n=>n==null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);const field=(dl,k,v)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=String(v??'Não informado');dl.append(dt,dd)};function show(n){const c=$('content');c.replaceChildren();const dl=document.createElement('dl');for(const [k,v] of Object.entries({Chave:n.key,Número:n.number,Emissão:n.issue,Competência:n.competence,Prestador:n.issuer,Documento_prestador:n.issuerId,Tomador:n.recipient,Documento_tomador:n.recipientId,Situação:n.status,Serviço:n.service,Valor_serviço:money(n.serviceValue),Valor_líquido:money(n.netValue),Eventos:n.events.join('; ')||'Nenhum'}))field(dl,k.replaceAll('_',' '),v);c.append(dl);const h=document.createElement('h3');h.textContent='Campos fiscais do XML';c.append(h);const tax=document.createElement('dl');for(const f of n.fiscalFields)field(tax,f.path,f.value);c.append(tax);$('detail').showModal()}function render(){const q=$('search').value.toLocaleLowerCase('pt-BR'),s=$('status').value;const list=data.filter(n=>(!s||n.status===s)&&(!q||[n.key,n.number,n.issuer,n.recipient].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q))));const body=$('rows');body.replaceChildren();for(const n of list.slice(0,200)){const tr=document.createElement('tr');tr.tabIndex=0;for(const value of [n.number,n.issue,n.issuer,n.recipient,money(n.serviceValue),n.status]){const td=document.createElement('td');td.textContent=value||'—';tr.append(td)}tr.onclick=()=>show(n);tr.onkeydown=e=>{if(e.key==='Enter')show(n)};body.append(tr)}$('count').textContent='Mostrando '+Math.min(list.length,200)+' de '+list.length+' resultado(s).'}$('summary').textContent=data.length+' NFS-e · Total válido: '+money(data.filter(n=>n.status==='Válida').reduce((a,n)=>a+(n.serviceValue||0),0));$('search').oninput=render;$('status').onchange=render;$('close').onclick=()=>$('detail').close();render();</script></html>`;
}

async function adnCreatePackage(notes, companyId, { includePdf = true, includeXlsx = true, includeViewer = true, onProgress = () => {} } = {}) {
  const zip = new JSZip();
  let eventCount = 0;
  for (const [index, note] of notes.entries()) {
    const selectedId = companyId || note.issuerId;
    const company = adnSafe(selectedId, "sem-documento");
    const direction = note.issuerId === selectedId ? "EMITIDAS" : note.recipientId === selectedId ? "RECEBIDAS" : "OUTRAS";
    const competence = /^\d{4}-\d{2}$/.test(note.competence) ? note.competence : "sem-competencia";
    const status = { valid: "VALIDAS", cancelled: "CANCELADAS", substituted: "SUBSTITUIDAS" }[note.status];
    const folder = `EMPRESAS/${company}/${direction}/${competence}/${status}`;
    zip.file(`${folder}/XML/${note.key}.xml`, note.bytes);
    if (includePdf) {
      if (index % 10 === 0) { onProgress(`Gerando PDFs: ${index}/${notes.length}…`); await new Promise(resolve => setTimeout(resolve, 0)); }
      zip.file(`${folder}/PDF/${note.key}.pdf`, await adnBuildNotePdf(note));
    }
    for (const [eventIndex, event] of note.events.entries()) {
      zip.file(`${folder}/EVENTOS/${note.key}-${event.eventType}-${eventIndex + 1}.xml`, event.bytes);
      eventCount++;
    }
  }
  if (includeXlsx) {
    onProgress(`Gerando planilha para ${notes.length} nota(s)…`);
    zip.file("RELATORIOS/notas-adn.xlsx", await adnBuildReport(notes, companyId));
  }
  if (includeViewer) zip.file("VISUALIZADOR/index.html", adnViewerHtml(notes));
  zip.file("LEIA-ME.txt", `XMLs originais preservados. ${notes.length} NFS-e e ${eventCount} eventos associados. Situação derivada dos eventos e101101 (cancelamento) e e105102 (cancelamento por substituição). Relatório, PDFs e visualizador são representações locais para conferência e não substituem o XML ou a consulta ao portal oficial. A assinatura digital não foi validada.\n`);
  return { zip, eventCount };
}

adnZipInput.addEventListener("change", async () => {
  adnDocuments = null;
  adnOrganizeButton.disabled = true;
  adnCompany.replaceChildren(new Option("Todas", ""));
  adnDirection.value = "";
  adnDirection.disabled = true;
  const file = adnZipInput.files?.[0];
  if (!file) return;
  try {
    adnDocuments = await adnReadZip(file);
    const companies = new Map();
    const frequency = new Map();
    for (const note of adnDocuments.notes) {
      if (note.issuerId) companies.set(note.issuerId, note.issuerName);
      if (note.recipientId && !companies.has(note.recipientId)) companies.set(note.recipientId, note.recipientName);
      for (const id of new Set([note.issuerId, note.recipientId].filter(Boolean))) {
        frequency.set(id, (frequency.get(id) || 0) + 1);
      }
    }
    for (const [id, name] of [...companies].sort((a, b) => a[0].localeCompare(b[0]))) {
      adnCompany.add(new Option(`${id} — ${name}`, id));
    }
    const common = [...frequency].filter(([, count]) => count === adnDocuments.notes.length);
    if (common.length === 1) {
      adnCompany.value = common[0][0];
      adnDirection.value = "issued";
    }
    adnDirection.disabled = !adnCompany.value;
    adnPreviewSelection();
    adnOrganizeButton.disabled = false;
  } catch (error) {
    adnOrganizeFeedback.textContent = error.message || "Não foi possível ler o ZIP.";
  }
});

for (const control of [adnCompany, adnDirection, adnPeriodKind, adnMonthFrom, adnMonthTo, adnStatusFilter]) {
  control.addEventListener("change", () => {
    if (control === adnCompany) {
      adnDirection.disabled = !adnCompany.value;
      if (!adnCompany.value) adnDirection.value = "";
    }
    adnPreviewSelection();
  });
}

adnOrganizeButton.addEventListener("click", async () => {
  if (!adnDocuments) return;
  adnOrganizeButton.disabled = true;
  try {
    const notes = adnSelectedNotes();
    if (!notes.length) throw new Error("Nenhuma nota corresponde aos filtros escolhidos.");
    const { zip, eventCount } = await adnCreatePackage(notes, adnCompany.value, {
      includePdf: adnIncludePdf.checked,
      onProgress: message => { adnOrganizeFeedback.textContent = message; }
    });
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nfse-adn-organizado.zip";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    adnOrganizeFeedback.textContent = `ZIP preparado: ${notes.length} NFS-e, ${eventCount} evento(s), planilha${adnIncludePdf.checked ? ` e ${notes.length} PDF(s)` : ""}.`;
  } catch (error) {
    adnOrganizeFeedback.textContent = error.message || "Não foi possível organizar o ZIP.";
  } finally {
    adnOrganizeButton.disabled = false;
  }
});
