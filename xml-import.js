// Importação local de XMLs oficiais; o arquivo original é preservado no ZIP.
const xmlInput = document.querySelector("#xml-files");
const xmlExportButton = document.querySelector("#xml-export-button");
const xmlFeedback = document.querySelector("#xml-feedback");
const xmlPreview = document.querySelector("#xml-preview");
let importedXmls = [];

function xmlChild(node, name) {
  return [...(node?.children || [])].find(child => child.localName === name) || null;
}

function xmlAt(node, path) {
  return path.reduce((current, name) => xmlChild(current, name), node);
}

function xmlText(node, path) {
  return xmlAt(node, path)?.textContent?.trim() || "";
}

function xmlAmount(node, path) {
  const value = Number(xmlText(node, path));
  return Number.isFinite(value) ? value : null;
}

function xmlDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function safePathPart(value, fallback) {
  return (value || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+$/, "_").slice(0, 100);
}

function parseNfseXml(content, fileName) {
  const documentXml = new DOMParser().parseFromString(content, "application/xml");
  if (documentXml.getElementsByTagName("parsererror").length || documentXml.documentElement.localName !== "NFSe") {
    throw new Error(`${fileName}: não é um XML de NFS-e válido para esta importação.`);
  }
  const info = xmlChild(documentXml.documentElement, "infNFSe");
  const dps = xmlAt(info, ["DPS", "infDPS"]);
  if (!info || !dps || !xmlChild(documentXml.documentElement, "Signature")) {
    throw new Error(`${fileName}: faltam os campos principais ou a assinatura da NFS-e.`);
  }
  const key = info.getAttribute("Id") || "";
  const issuer = xmlAt(info, ["emit"]);
  const recipient = xmlAt(dps, ["toma"]);
  return {
    key,
    number: xmlText(info, ["nNFSe"]),
    issueDate: xmlDate(xmlText(dps, ["dhEmi"]) || xmlText(info, ["dhProc"])),
    competence: xmlText(dps, ["dCompet"]).slice(0, 7),
    issuerId: xmlText(issuer, ["CNPJ"]) || xmlText(issuer, ["CPF"]),
    issuerName: xmlText(issuer, ["xNome"]),
    recipientId: xmlText(recipient, ["CNPJ"]) || xmlText(recipient, ["CPF"]),
    recipientName: xmlText(recipient, ["xNome"]),
    serviceCode: xmlText(dps, ["serv", "cServ", "cTribNac"]),
    serviceDescription: xmlText(dps, ["serv", "cServ", "xDescServ"]),
    serviceValue: xmlAmount(dps, ["valores", "vServPrest", "vServ"]),
    netValue: xmlAmount(info, ["valores", "vLiq"]),
    issValue: xmlAmount(info, ["valores", "vISSQN"]),
    pisValue: xmlAmount(dps, ["valores", "trib", "tribFed", "piscofins", "vPis"]),
    cofinsValue: xmlAmount(dps, ["valores", "trib", "tribFed", "piscofins", "vCofins"]),
    pisCofinsBase: xmlAmount(dps, ["valores", "trib", "tribFed", "piscofins", "vBCPisCofins"]),
    fileName
  };
}

function showXmlPreview() {
  xmlPreview.replaceChildren();
  if (!importedXmls.length) {
    xmlPreview.hidden = true;
    xmlExportButton.disabled = true;
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Número", "Emissão", "Prestador", "Tomador", "Serviço (R$)"].forEach(label => {
    const cell = document.createElement("th");
    cell.textContent = label;
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement("tbody");
  importedXmls.slice(0, 20).forEach(note => {
    const row = document.createElement("tr");
    [note.number, note.issueDate, note.issuerName, note.recipientName,
      note.serviceValue == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(note.serviceValue)
    ].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value || "—";
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  xmlPreview.append(table);
  xmlPreview.hidden = false;
  xmlExportButton.disabled = false;
}

xmlInput.addEventListener("change", async () => {
  importedXmls = [];
  showXmlPreview();
  const files = [...xmlInput.files];
  if (!files.length) {
    xmlFeedback.textContent = "Nenhum XML selecionado.";
    return;
  }
  if (files.length > 1000 || files.some(file => file.size > 5_000_000)) {
    xmlFeedback.textContent = "Selecione até 1.000 XMLs, com no máximo 5 MB por arquivo.";
    return;
  }
  const errors = [];
  const seen = new Set();
  for (const file of files) {
    try {
      const note = parseNfseXml(await file.text(), file.name);
      note.file = file;
      const identity = note.key || file.name;
      if (seen.has(identity)) continue;
      seen.add(identity);
      importedXmls.push(note);
    } catch (error) {
      errors.push(error.message);
    }
  }
  showXmlPreview();
  xmlFeedback.textContent = `${importedXmls.length} XML(s) importado(s).` +
    (errors.length ? ` ${errors.length} arquivo(s) ignorado(s): ${errors.slice(0, 2).join(" ")}` : "") +
    " A presença da assinatura foi conferida, mas sua validade criptográfica não foi verificada.";
});

async function buildXmlReport(notes) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NFSe Analyzer";
  const summary = workbook.addWorksheet("Resumo");
  summary.columns = [{ width: 32 }, { width: 22 }];
  summary.addRow(["Indicador", "Valor"]);
  summary.addRow(["XMLs importados", notes.length]);
  summary.addRow(["Total dos serviços", notes.reduce((sum, note) => sum + (note.serviceValue || 0), 0)]);
  summary.addRow(["Total líquido informado", notes.reduce((sum, note) => sum + (note.netValue || 0), 0)]);
  summary.getRow(1).eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  [3, 4].forEach(row => { summary.getCell(`B${row}`).numFmt = '"R$" #,##0.00'; });

  const details = workbook.addWorksheet("Detalhes XML");
  const columns = [
    ["Número", "number", 14], ["Chave", "key", 55], ["Emissão", "issueDate", 15],
    ["Competência", "competence", 15], ["CNPJ/CPF prestador", "issuerId", 22],
    ["Prestador", "issuerName", 55], ["CNPJ/CPF tomador", "recipientId", 22],
    ["Tomador", "recipientName", 55], ["Código serviço", "serviceCode", 18],
    ["Descrição do serviço", "serviceDescription", 90], ["Valor serviço", "serviceValue", 19],
    ["Valor líquido", "netValue", 19], ["ISSQN", "issValue", 19],
    ["Base PIS/Cofins", "pisCofinsBase", 19], ["PIS", "pisValue", 19],
    ["Cofins", "cofinsValue", 19]
  ];
  details.columns = columns.map(([header, key, width]) => ({ header, key, width }));
  details.getRow(1).eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  notes.forEach(note => {
    const row = details.addRow(note);
    [11, 12, 13, 14, 15, 16].forEach(column => { row.getCell(column).numFmt = '"R$" #,##0.00'; });
  });
  details.views = [{ state: "frozen", ySplit: 1 }];
  details.autoFilter = { from: "A1", to: `P${notes.length + 1}` };
  return workbook.xlsx.writeBuffer();
}

xmlExportButton.addEventListener("click", async () => {
  if (!importedXmls.length) return;
  xmlExportButton.disabled = true;
  xmlExportButton.textContent = "Preparando ZIP…";
  try {
    const zip = new JSZip();
    importedXmls.forEach((note, index) => {
      const issuer = safePathPart(note.issuerId, "prestador-nao-identificado");
      const competence = safePathPart(note.competence, "competencia-nao-informada");
      const name = safePathPart(note.key || note.fileName.replace(/\.xml$/i, ""), `nota-${index + 1}`);
      zip.file(`XML_OFICIAIS/${issuer}/${competence}/${name}.xml`, note.file);
    });
    zip.file("RELATORIOS/notas-detalhadas.xlsx", await buildXmlReport(importedXmls));
    zip.file("LEIA-ME.txt", "XMLs originais importados pelo usuário. Relatório gerado localmente pelo NFSe Analyzer. Situação e eventos não foram verificados; a assinatura digital não foi validada criptograficamente.\n");
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nfse-analyzer-xmls-e-relatorio.zip";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error("Falha ao gerar ZIP dos XMLs", error);
    xmlFeedback.textContent = "Não foi possível gerar o ZIP. Tente novamente.";
  } finally {
    xmlExportButton.textContent = "↧ Baixar ZIP com XMLs e relatório";
    xmlExportButton.disabled = false;
  }
});
