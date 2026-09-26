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

function adnIdentifyCompany(notes) {
  if (!notes.length) return "";
  const common = new Set([notes[0].issuerId, notes[0].recipientId].filter(Boolean));
  for (const note of notes.slice(1)) {
    for (const id of common) {
      if (id !== note.issuerId && id !== note.recipientId) common.delete(id);
    }
    if (!common.size) return "";
  }
  return common.size === 1 ? [...common][0] : "";
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
  return { key, id: info?.getAttribute("Id") || "", eventType, date: adnText(request, "dhEvento"), bytes, sourceName };
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

async function adnOpenZip(file) {
  if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name}: o ZIP deve ter no máximo 100 MB.`);
  const archive = await JSZip.loadAsync(file);
  const entries = Object.values(archive.files).filter(entry => !entry.dir && entry.name.toLowerCase().endsWith(".xml"));
  if (entries.length > 5050) throw new Error(`${file.name}: o ZIP contém mais de 5.050 XMLs.`);
  const metadataFile = archive.file("CONSULTA-ADN.txt") || archive.file("LEIA-ME.txt");
  const metadata = metadataFile ? await metadataFile.async("string") : "";
  const start = metadata.match(/^NSU inicial:\s*(\d+)\s*$/m);
  const end = metadata.match(/^Último NSU:\s*(\d+)\s*$/m);
  const complete = metadata.match(/^Consulta completa:\s*(sim|não)\s*$/m);
  if (!start || !end || !complete) throw new Error(`${file.name}: não foi possível confirmar o intervalo de NSUs. Selecione os ZIPs originais baixados pelo site.`);
  const range = { start: Number(start[1]), end: Number(end[1]), complete: complete[1] === "sim" };
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.end < range.start ||
    (!entries.length && !(range.complete && range.start === range.end))) {
    throw new Error(`${file.name}: intervalo de NSUs ou conteúdo inválido.`);
  }
  const raw = entries.every(entry => entry.name.startsWith("XML_ADN/"));
  if (raw) {
    const declaredCount = metadata.match(/^Documentos:\s*(\d+)\s*$/m);
    const nsus = entries.map(entry => Number(entry.name.match(/\/NSU-(\d+)-/)?.[1]));
    if (!declaredCount || Number(declaredCount[1]) !== entries.length ||
      nsus.some(nsu => !Number.isSafeInteger(nsu) || nsu <= range.start || nsu > range.end) ||
      new Set(nsus).size !== nsus.length || (nsus.length && Math.max(...nsus) !== range.end)) {
      throw new Error(`${file.name}: a quantidade de documentos ou os NSUs não correspondem ao manifesto do ZIP.`);
    }
  }
  return { file, entries, range, raw };
}

async function adnReadZips(files) {
  if (!files.length) throw new Error("Selecione todos os ZIPs da consulta ao ADN.");
  const opened = [];
  for (const file of files) opened.push(await adnOpenZip(file));
  opened.sort((a, b) => a.range.start - b.range.start);
  if (opened[0].range.start !== 0) throw new Error("Falta o primeiro ZIP da consulta (NSU inicial 0).");
  for (let index = 1; index < opened.length; index++) {
    if (opened[index - 1].range.complete) throw new Error("Há ZIPs após a conclusão da consulta. Selecione apenas os lotes da mesma consulta.");
    if (opened[index].range.start !== opened[index - 1].range.end) {
      throw new Error(`Falta um lote entre os NSUs ${opened[index - 1].range.end} e ${opened[index].range.start}.`);
    }
  }
  if (!opened.at(-1).range.complete) throw new Error("A consulta ainda não terminou. Baixe os próximos lotes e selecione todos os ZIPs antes de gerar o relatório.");
  if (opened.some(item => !item.raw)) {
    throw new Error("Para gerar o relatório consolidado, selecione os ZIPs originais de XMLs do ADN, sem pacotes já filtrados.");
  }
  const notes = [];
  const events = [];
  const noteKeys = new Set();
  const eventIds = new Set();
  for (const [fileIndex, { file, entries }] of opened.entries()) {
    for (let index = 0; index < entries.length; index++) {
      if (index % 50 === 0) adnOrganizeFeedback.textContent = `Lendo ZIP ${fileIndex + 1}/${opened.length}: ${index}/${entries.length} XMLs…`;
      const entry = entries[index];
      const bytes = await entry.async("uint8array");
      if (bytes.length > 5 * 1024 * 1024) throw new Error(`${file.name}: há um XML maior que 5 MB.`);
      const root = adnXmlDocument(bytes);
      if (root.localName === "NFSe") {
        const note = adnParseNote(root, bytes, entry.name);
        if (noteKeys.has(note.key)) throw new Error(`A nota ${note.key} aparece em mais de um ZIP. Confira os lotes selecionados.`);
        noteKeys.add(note.key);
        notes.push(note);
      } else if (root.localName === "evento") {
        const event = adnParseEvent(root, bytes, entry.name);
        if (event.id && eventIds.has(event.id)) throw new Error(`O evento ${event.id} aparece em mais de um ZIP. Confira os lotes selecionados.`);
        if (event.id) eventIds.add(event.id);
        events.push(event);
      } else throw new Error(`${file.name}: o ZIP contém um XML que não é NFS-e nem evento.`);
    }
  }
  const unmatched = adnLinkEvents(notes, events);
  return { notes, events, unmatched, zipCount: opened.length, firstNsu: opened[0].range.start, lastNsu: opened.at(-1).range.end };
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
    adnOrganizeFeedback.textContent = `Consulta completa até o NSU ${adnDocuments.lastNsu}: ${adnDocuments.notes.length} NFS-e e ${adnDocuments.events.length} evento(s) em ${adnDocuments.zipCount} ZIP(s). ` +
      (company ? `Para a empresa selecionada: ${issued} emitida(s) e ${received} recebida(s). ` : "Selecione uma empresa para separar emitidas e recebidas. ") +
      `${notes.length} nota(s) correspondem aos filtros. ` +
      (adnDocuments.unmatched ? `${adnDocuments.unmatched} evento(s) sem nota correspondente.` : "Todos os eventos foram associados.");
  } catch (error) {
    adnOrganizeFeedback.textContent = error.message;
  }
}

function adnReportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "";
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : value;
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
    ["PIS das válidas", valid.filter(note => note.pisValue != null).length,
      valid.reduce((sum, note) => sum + (note.pisValue || 0), 0)],
    ["Cofins das válidas", valid.filter(note => note.cofinsValue != null).length,
      valid.reduce((sum, note) => sum + (note.cofinsValue || 0), 0)]
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
    const row = details.addRow({ ...note, issue: adnReportDate(note.issue), direction, status: { valid: "Válida", cancelled: "Cancelada", substituted: "Substituída" }[note.status], eventCount: note.events.length });
    if (note.status !== "valid") row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: note.status === "cancelled" ? "FFFDEEEE" : "FFF3EEFC" } };
    row.getCell(3).numFmt = "dd/mm/yyyy";
    row.getCell(3).alignment = { horizontal: "left" };
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

function adnViewerHtml(notes, companyId) {
  const data = notes.map(note => ({
    key: note.key, number: note.number, issue: note.issue, competence: note.competence,
    issuer: note.issuerName, issuerId: note.issuerId, recipient: note.recipientName,
    recipientId: note.recipientId, status: adnStatusNames[note.status],
    direction: companyId ? (note.issuerId === companyId ? "Emitida" : note.recipientId === companyId ? "Recebida" : "Outra") : "—",
    service: note.service, serviceCode: note.serviceCode,
    serviceValue: note.serviceValue, netValue: note.netValue,
    issValue: note.issValue, issBase: note.issBase, issRate: note.issRate,
    pisValue: note.pisValue, cofinsValue: note.cofinsValue, pisCofinsBase: note.pisCofinsBase,
    pisRate: note.pisRate, cofinsRate: note.cofinsRate,
    totalRetained: note.totalRetained, issRetentionCode: note.issRetentionCode,
    pisCofinsRetentionCode: note.pisCofinsRetentionCode,
    csllRetained: note.csllRetained, irrfRetained: note.irrfRetained,
    socialSecurityRetained: note.socialSecurityRetained,
    conditionalDiscount: note.conditionalDiscount, unconditionalDiscount: note.unconditionalDiscount,
    events: note.events.map(event => ({ type: event.eventType, date: event.date })),
    fiscalFields: note.fiscalFields
  }));
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visualizador de NFS-e · NFSe Analyzer</title>
<style>
:root{font:15px system-ui,sans-serif;color:#18392d;background:#f6f9f6}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button{cursor:pointer}main{max-width:1440px;margin:auto;padding:36px 28px 70px}.eyebrow{color:#178451;font-size:12px;font-weight:800;letter-spacing:2px}.heading{display:flex;align-items:end;justify-content:space-between;gap:20px;flex-wrap:wrap}h1{font-size:clamp(28px,4vw,42px);letter-spacing:-1px;margin:7px 0}.sub{color:#6b7891;margin:0}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin:30px 0}.card,.panel{background:#fff;border:1px solid #d8e7dc;border-radius:17px;box-shadow:0 8px 30px #123d2110}.card{padding:20px}.card span{color:#75829b;font-size:13px}.card strong{display:block;font-size:clamp(20px,2vw,28px);margin-top:8px;overflow-wrap:anywhere}.card small{color:#8c98ad}.valid-number{color:#178451}.filters{display:flex;gap:12px;flex-wrap:wrap;align-items:end;padding:20px;margin-bottom:18px}.filters label{display:grid;gap:6px;font-weight:700;font-size:12px;color:#65728a}.filters input,.filters select{height:42px;border:1px solid #cfddd2;border-radius:9px;background:#fff;color:#18392d;padding:0 12px}.filters .search{flex:2;min-width:240px}.filters .search input{width:100%}.filters .date{min-width:155px}.filters .date input{width:100%}.panel{overflow:hidden}.table-wrap{overflow:auto;max-height:660px}table{width:100%;border-collapse:collapse;min-width:990px}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid #ebeff6}th{position:sticky;top:0;background:#edf5ee;color:#697791;text-transform:uppercase;font-size:11px;letter-spacing:.6px;z-index:1}tbody tr{cursor:pointer}tbody tr:hover,tbody tr:focus{background:#e8f5ec;outline:0}td{font-size:13px}td.money{font-weight:700;white-space:nowrap}td:nth-child(5){max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}td.muted{color:#8a96aa}.pill{display:inline-block;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:700;white-space:nowrap}.pill.valid{background:#e7f6ee;color:#25805d}.pill.cancelled{background:#fff0e7;color:#ae6135}.pill.substituted{background:#f0ebfb;color:#7656ad}.pager{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;padding:17px 20px;color:#65728a}.pager-controls{display:flex;align-items:center;gap:12px}.pager button,.close{border:1px solid #cfddd2;background:#fff;color:#176f42;border-radius:9px;padding:9px 14px;font-weight:700}.pager button:disabled{opacity:.45;cursor:default}.empty{padding:30px;color:#7b879c;text-align:center}dialog{border:0;border-radius:18px;padding:0;width:min(900px,95vw);max-height:90vh;overflow:auto;box-shadow:0 22px 70px #14223b55}dialog::backdrop{background:#10281b99}.detail-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:15px;background:#fff;border-bottom:1px solid #e6eaf3;padding:22px 28px}.detail-head h2{margin:3px 0;font-size:23px}.detail-body{padding:24px 28px 30px}.group{margin-bottom:27px}.group h3{font-size:15px;margin:0 0 13px;color:#344765}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.field{padding:12px 14px;background:#f7f9fd;border:1px solid #edf1f7;border-radius:10px;min-width:0}.field dt{font-size:11px;color:#74819a;font-weight:700;margin-bottom:5px}.field dd{margin:0;overflow-wrap:anywhere;font-size:13px}.raw{display:grid;gap:7px}.raw .field{display:grid;grid-template-columns:minmax(180px,1fr) minmax(0,1fr);gap:10px}.notice{font-size:12px;color:#71809a;line-height:1.5}.hidden{display:none!important}@media(max-width:800px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.fields{grid-template-columns:1fr}}@media(max-width:500px){main{padding:25px 14px}.summary{gap:9px}.card{padding:15px}.filters{padding:15px}.filters label,.filters .search{min-width:100%}.detail-head,.detail-body{padding:18px}.raw .field{grid-template-columns:1fr}}
</style></head><body><main>
<div class="heading"><div><span class="eyebrow">NFSE ANALYZER · VISUALIZADOR LOCAL</span><h1>Notas fiscais do lote</h1><p class="sub">Explore todas as notas e os dados fiscais informados nos XMLs.</p></div></div>
<div class="summary" aria-label="Resumo das notas filtradas"><div class="card"><span>Notas no filtro</span><strong id="total-count">0</strong><small>Inclui todas as situações</small></div><div class="card"><span>Notas válidas</span><strong id="valid-count">0</strong><small>Canceladas e substituídas à parte</small></div><div class="card"><span>Valor dos serviços válidos</span><strong class="valid-number" id="valid-total">—</strong><small>Somente notas válidas</small></div><div class="card"><span>PIS / Cofins das válidas</span><strong id="valid-taxes">—</strong><small>Valores informados nos XMLs</small></div></div>
<section class="filters panel" aria-label="Filtros"><label class="search">Buscar<input id="search" type="search" placeholder="Número, chave, prestador, tomador ou documento"></label><label>Situação<select id="status"><option value="">Todas</option><option>Válida</option><option>Cancelada</option><option>Substituída</option></select></label><label>Direção<select id="direction"><option value="">Todas</option><option>Emitida</option><option>Recebida</option><option>Outra</option></select></label><label class="date">Emissão de<input id="from" type="date"></label><label class="date">Até<input id="to" type="date"></label><label>Ordenar<select id="sort"><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option><option value="highest">Maior valor</option><option value="lowest">Menor valor</option></select></label></section>
<div class="panel"><div class="table-wrap"><table><thead><tr><th>Número</th><th>Emissão</th><th>Prestador</th><th>Tomador</th><th>Serviço</th><th>Valor</th><th>Situação</th></tr></thead><tbody id="rows"></tbody></table><p id="empty" class="empty hidden">Nenhuma nota corresponde aos filtros.</p></div><div class="pager"><span id="count"></span><div class="pager-controls"><button id="prev" type="button">Anterior</button><span id="page"></span><button id="next" type="button">Próxima</button></div></div></div>
<p class="notice">Os valores exibidos vêm dos XMLs e eventos presentes neste lote. Campos ausentes aparecem como “Não informado”. O visualizador não faz apuração tributária nem valida a assinatura digital.</p>
</main><dialog id="detail" aria-labelledby="detail-title"><div class="detail-head"><div><span class="eyebrow">DETALHES DA NFS-E</span><h2 id="detail-title"></h2></div><button class="close" id="close" type="button">Fechar</button></div><div class="detail-body" id="content"></div></dialog>
<script>
const data=${json};
const $=id=>document.getElementById(id);
const money=n=>n==null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const percent=n=>n==null?'Não informado':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4}).format(n)+'%';
const value=v=>v==null||v===''?'Não informado':String(v);
const date=v=>v&&v.length===10&&v[4]==='-'&&v[7]==='-'?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):value(v);
const pageSize=100;
let page=0;
function addGroup(parent,title,items){const section=document.createElement('section');section.className='group';const heading=document.createElement('h3');heading.textContent=title;section.append(heading);const list=document.createElement('dl');list.className='fields';for(const [label,item] of items){const wrap=document.createElement('div');wrap.className='field';const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value(item);wrap.append(dt,dd);list.append(wrap)}section.append(list);parent.append(section)}
function show(note){$('detail-title').textContent='Nota '+value(note.number);const content=$('content');content.replaceChildren();addGroup(content,'Identificação',[['Chave',note.key],['Número',note.number],['Emissão',date(note.issue)],['Competência',note.competence],['Situação',note.status],['Direção',note.direction],['Prestador',note.issuer],['Documento do prestador',note.issuerId],['Tomador',note.recipient],['Documento do tomador',note.recipientId],['Código do serviço',note.serviceCode],['Descrição do serviço',note.service]]);addGroup(content,'Valores e descontos',[['Valor do serviço',money(note.serviceValue)],['Valor líquido informado',money(note.netValue)],['Desconto condicional',money(note.conditionalDiscount)],['Desconto incondicional',money(note.unconditionalDiscount)]]);addGroup(content,'Tributos e alíquotas informados',[['ISS',money(note.issValue)],['Base ISS',money(note.issBase)],['Alíquota ISS',percent(note.issRate)],['PIS',money(note.pisValue)],['Cofins',money(note.cofinsValue)],['Base PIS/Cofins',money(note.pisCofinsBase)],['Alíquota PIS',percent(note.pisRate)],['Alíquota Cofins',percent(note.cofinsRate)]]);addGroup(content,'Retenções informadas',[['Total retido',money(note.totalRetained)],['CSLL retida',money(note.csllRetained)],['IRRF retido',money(note.irrfRetained)],['Previdência retida',money(note.socialSecurityRetained)],['ISS retido (código XML)',note.issRetentionCode],['PIS/Cofins retido (código XML)',note.pisCofinsRetentionCode]]);const adjustments=note.fiscalFields.filter(f=>/juro|multa|acresc|encargo/i.test(f.path));addGroup(content,'Juros, multas e acréscimos no XML',adjustments.length?adjustments.map(f=>[f.path,f.value]):[['Campos correspondentes','Não informados no XML']]);addGroup(content,'Eventos',note.events.length?note.events.map(e=>[e.type,e.date||'Data não informada']):[['Eventos associados','Nenhum']]);const section=document.createElement('section');section.className='group';const heading=document.createElement('h3');heading.textContent='Todos os campos fiscais originais do XML';section.append(heading);const list=document.createElement('dl');list.className='raw';for(const f of note.fiscalFields){const wrap=document.createElement('div');wrap.className='field';const dt=document.createElement('dt');dt.textContent=f.path;const dd=document.createElement('dd');dd.textContent=f.value;wrap.append(dt,dd);list.append(wrap)}if(!note.fiscalFields.length){const p=document.createElement('p');p.className='notice';p.textContent='Nenhum campo fiscal encontrado neste XML.';section.append(p)}else section.append(list);content.append(section);$('detail').showModal()}
function render(){const q=$('search').value.trim().toLocaleLowerCase('pt-BR'),status=$('status').value,direction=$('direction').value,from=$('from').value,to=$('to').value,sort=$('sort').value;const list=data.filter(n=>(!status||n.status===status)&&(!direction||n.direction===direction)&&(!from||n.issue>=from)&&(!to||n.issue<=to)&&(!q||[n.key,n.number,n.issuer,n.issuerId,n.recipient,n.recipientId,n.service].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q))));updateSummary(list);list.sort((a,b)=>sort==='oldest'?a.issue.localeCompare(b.issue):sort==='highest'?b.serviceValue-a.serviceValue:sort==='lowest'?a.serviceValue-b.serviceValue:b.issue.localeCompare(a.issue));const pages=Math.max(1,Math.ceil(list.length/pageSize));page=Math.min(Math.max(0,page),pages-1);const body=$('rows');body.replaceChildren();for(const note of list.slice(page*pageSize,(page+1)*pageSize)){const tr=document.createElement('tr');tr.tabIndex=0;for(const [i,item] of [note.number||'—',date(note.issue),note.issuer||note.issuerId||'—',note.recipient||note.recipientId||'—',note.service||'—',money(note.serviceValue),note.status].entries()){const td=document.createElement('td');if(i===5)td.className='money';if(i===6){const badge=document.createElement('span');badge.className='pill '+(item==='Válida'?'valid':item==='Cancelada'?'cancelled':'substituted');badge.textContent=item;td.append(badge)}else td.textContent=item;tr.append(td)}tr.addEventListener('click',()=>show(note));tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(note)}});body.append(tr)}$('empty').classList.toggle('hidden',list.length>0);$('count').textContent=list.length?(page*pageSize+1)+'–'+Math.min(list.length,(page+1)*pageSize)+' de '+list.length+' resultado(s)':'Nenhuma nota no filtro';$('page').textContent=list.length?'Página '+(page+1)+' de '+pages:'';$('prev').disabled=page===0;$('next').disabled=page>=pages-1}
function updateSummary(list){const valid=list.filter(n=>n.status==='Válida');$('total-count').textContent=list.length;$('valid-count').textContent=valid.length;$('valid-total').textContent=money(valid.reduce((sum,n)=>sum+(n.serviceValue||0),0));$('valid-taxes').textContent=money(valid.reduce((sum,n)=>sum+(n.pisValue||0),0))+' / '+money(valid.reduce((sum,n)=>sum+(n.cofinsValue||0),0))}
for(const id of ['search','status','direction','from','to','sort'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()});$('prev').addEventListener('click',()=>{page--;render()});$('next').addEventListener('click',()=>{page++;render()});$('close').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('click',e=>{if(e.target===$('detail'))$('detail').close()});render();
</script></body></html>`;
}

async function adnCreatePackage(notes, companyId, { includePdf = true, includeXlsx = true, includeViewer = true, onProgress = () => {} } = {}) {
  const referenceCompany = companyId || adnIdentifyCompany(notes);
  if (!referenceCompany) throw new Error("Informe o CNPJ/CPF da empresa para classificar as notas emitidas e recebidas.");
  const zip = new JSZip();
  let eventCount = 0;
  for (const [index, note] of notes.entries()) {
    const selectedId = referenceCompany;
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
    zip.file("RELATORIOS/notas-adn.xlsx", await adnBuildReport(notes, referenceCompany));
  }
  if (includeViewer) zip.file("VISUALIZADOR/index.html", adnViewerHtml(notes, referenceCompany));
  zip.file("LEIA-ME.txt", `XMLs originais preservados. ${notes.length} NFS-e e ${eventCount} eventos associados. Situação derivada dos eventos e101101 (cancelamento) e e105102 (cancelamento por substituição). Relatório, PDFs e visualizador são representações locais para conferência e não substituem o XML ou a consulta ao portal oficial. A assinatura digital não foi validada.\n`);
  return { zip, eventCount };
}

adnZipInput.addEventListener("change", async () => {
  adnDocuments = null;
  adnOrganizeButton.disabled = true;
  adnPreview.hidden = true;
  adnPreviewBody.replaceChildren();
  adnPreviewSummary.textContent = "";
  adnCompany.replaceChildren(new Option("Todas", ""));
  adnDirection.value = "";
  adnDirection.disabled = true;
  const files = [...(adnZipInput.files || [])];
  if (!files.length) return;
  try {
    adnDocuments = await adnReadZips(files);
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
      adnDirection.value = "";
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
