// Organiza localmente os XMLs do ZIP do ADN e relaciona eventos às notas.
const adnZipInput = document.querySelector("#adn-zip-input");
const adnCompany = document.querySelector("#adn-company");
const adnDirection = document.querySelector("#adn-direction");
const adnPeriodKind = document.querySelector("#adn-period-kind");
const adnMonthFrom = document.querySelector("#adn-month-from");
const adnMonthTo = document.querySelector("#adn-month-to");
const adnStatusFilter = document.querySelector("#adn-status-filter");
const adnOrganizeButton = document.querySelector("#adn-organize-button");
const adnOrganizeFeedback = document.querySelector("#adn-organize-feedback");
let adnDocuments = null;

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
    key, bytes, sourceName, events: [], status: "valid",
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
    netValue: adnMoney(adnText(info, "valores", "vLiq")),
    issValue: adnMoney(adnText(info, "valores", "vISSQN")),
    pisValue: adnMoney(adnText(dps, "valores", "trib", "tribFed", "piscofins", "vPis")),
    cofinsValue: adnMoney(adnText(dps, "valores", "trib", "tribFed", "piscofins", "vCofins"))
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

function adnPreviewSelection() {
  if (!adnDocuments) return;
  try {
    const notes = adnSelectedNotes();
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
    ["Total válido", valid.length, valid.reduce((sum, note) => sum + note.serviceValue, 0)]
  ]);
  summary.columns = [{ width: 27 }, { width: 17 }, { width: 29 }];
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF455FCE" } };
  for (let row = 2; row <= 6; row++) summary.getCell(`C${row}`).numFmt = '"R$" #,##0.00';
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
    ["Eventos", "eventCount", 12]
  ].map(([header, key, width]) => ({ header, key, width }));
  details.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  details.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF455FCE" } };
  for (const note of notes) {
    const direction = companyId ? (note.issuerId === companyId ? "Emitida" : note.recipientId === companyId ? "Recebida" : "Outra") : "—";
    const row = details.addRow({ ...note, direction, status: { valid: "Válida", cancelled: "Cancelada", substituted: "Substituída" }[note.status], eventCount: note.events.length });
    if (note.status !== "valid") row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: note.status === "cancelled" ? "FFFDEEEE" : "FFF3EEFC" } };
    for (const column of [13, 14, 15, 16, 17]) row.getCell(column).numFmt = '"R$" #,##0.00';
  }
  details.autoFilter = { from: "A1", to: `R${Math.max(1, notes.length + 1)}` };
  details.views = [{ state: "frozen", ySplit: 1 }];
  return workbook.xlsx.writeBuffer();
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
    const zip = new JSZip();
    let eventCount = 0;
    for (const note of notes) {
      const companyId = adnCompany.value || note.issuerId;
      const company = adnSafe(companyId, "sem-documento");
      const direction = note.issuerId === companyId ? "EMITIDAS" : note.recipientId === companyId ? "RECEBIDAS" : "OUTRAS";
      const competence = /^\d{4}-\d{2}$/.test(note.competence) ? note.competence : "sem-competencia";
      const status = { valid: "VALIDAS", cancelled: "CANCELADAS", substituted: "SUBSTITUIDAS" }[note.status];
      const folder = `EMPRESAS/${company}/${direction}/${competence}/${status}`;
      zip.file(`${folder}/XML/${note.key}.xml`, note.bytes);
      for (const [index, event] of note.events.entries()) {
        zip.file(`${folder}/EVENTOS/${note.key}-${event.eventType}-${index + 1}.xml`, event.bytes);
        eventCount++;
      }
    }
    adnOrganizeFeedback.textContent = `Gerando planilha para ${notes.length} nota(s)…`;
    zip.file("RELATORIOS/notas-adn.xlsx", await adnBuildReport(notes, adnCompany.value));
    zip.file("LEIA-ME.txt", `XMLs originais preservados. ${notes.length} NFS-e e ${eventCount} eventos associados. Situação derivada dos eventos e101101 (cancelamento) e e105102 (cancelamento por substituição). O relatório é de apoio; a assinatura digital não foi validada.\n`);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nfse-adn-organizado.zip";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    adnOrganizeFeedback.textContent = `ZIP preparado: ${notes.length} NFS-e, ${eventCount} evento(s), planilha de conferência.`;
  } catch (error) {
    adnOrganizeFeedback.textContent = error.message || "Não foi possível organizar o ZIP.";
  } finally {
    adnOrganizeButton.disabled = false;
  }
});
