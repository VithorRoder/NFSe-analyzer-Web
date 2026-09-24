// Os documentos do ADN passam diretamente do complemento para esta aba.
const adnExportButton = document.querySelector("#adn-export-button");
const adnStopButton = document.querySelector("#adn-stop-button");
const adnFeedback = document.querySelector("#adn-feedback");
const adnFullPackage = document.querySelector("#adn-full-package");
const adnDirectFilters = document.querySelector("#adn-direct-filters");
const adnDirectCompany = document.querySelector("#adn-direct-company");
const adnDirectDirection = document.querySelector("#adn-direct-direction");
const adnDirectFrom = document.querySelector("#adn-direct-from");
const adnDirectTo = document.querySelector("#adn-direct-to");
const adnDirectFormat = document.querySelector("#adn-direct-format");
const ADN_ZIP_LIMIT = 5000;
const adnPending = new Map();
let adnRunning = false;
let adnStopRequested = false;
let adnNextNsu = 0;

adnFullPackage.addEventListener("change", () => {
  adnDirectFilters.hidden = !adnFullPackage.checked;
  adnExportButton.textContent = adnFullPackage.checked ? "Baixar pacote completo" : "Baixar XMLs em ZIP";
});

window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== location.origin ||
    event.data?.source !== "nfse-analyzer-extension" || event.data.type !== "adn-batch-result") return;
  const pending = adnPending.get(event.data.requestId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  adnPending.delete(event.data.requestId);
  pending.resolve(event.data);
});

function requestAdnBatch(nsu) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      adnPending.delete(requestId);
      reject(new Error("O complemento não respondeu. Recarregue a extensão e tente novamente."));
    }, 40000);
    adnPending.set(requestId, { resolve, timeout });
    window.postMessage({ source: "nfse-analyzer-site", type: "adn-batch", requestId, nsu }, location.origin);
  });
}

function safeAdnName(value, fallback) {
  return String(value || fallback).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 70) || fallback;
}

async function decodeAdnXml(base64) {
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error("O documento não está compactado em GZIP.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const originalBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(originalBytes);
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  if (documentXml.getElementsByTagName("parsererror").length || !documentXml.documentElement) {
    throw new Error("O ADN retornou um XML inválido.");
  }
  return originalBytes;
}

async function saveAdnZip(zip, startNsu, endNsu, count, complete) {
  zip.file("LEIA-ME.txt", `Documentos XML recebidos diretamente da API oficial do ADN com o certificado selecionado no Chrome.\nNSU inicial: ${startNsu}\nÚltimo NSU: ${endNsu}\nDocumentos: ${count}\nConsulta completa: ${complete ? "sim" : "não"}\nA situação e a assinatura digital dos documentos não foram verificadas pelo NFSe Analyzer.\n`);
  await saveAdnArchive(zip, `nfse-adn-nsu-${startNsu + 1}-a-${endNsu}.zip`, count);
}

async function saveAdnArchive(zip, name, count) {
  adnFeedback.textContent = `Compactando ${count} documento(s)…`;
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

adnStopButton.addEventListener("click", () => {
  adnStopRequested = true;
  adnStopButton.disabled = true;
  adnFeedback.textContent = "Encerrando após o lote atual e preparando o ZIP parcial…";
});

adnExportButton.addEventListener("click", async () => {
  if (adnRunning) return;
  const full = adnFullPackage.checked;
  const company = adnDirectCompany.value.replace(/\D/g, "");
  const directionFilter = adnDirectDirection.value;
  const format = adnDirectFormat.value;
  const from = adnDirectFrom.value;
  const to = adnDirectTo.value;
  if (full && ((company && ![11, 14].includes(company.length)) || (directionFilter && !company) || (from && to && from > to))) {
    adnFeedback.textContent = "Confira o CNPJ/CPF e o período. Para filtrar a direção, informe a empresa.";
    return;
  }
  adnRunning = true;
  adnStopRequested = false;
  adnExportButton.disabled = true;
  adnStopButton.hidden = false;
  adnStopButton.disabled = false;
  const startNsu = adnNextNsu;
  let cursor = startNsu;
  let count = 0;
  let complete = false;
  let error = null;
  const zip = new JSZip();
  const notes = [];
  const events = [];
  try {
    while (!adnStopRequested && count < ADN_ZIP_LIMIT) {
      adnFeedback.textContent = `Consultando o ADN: ${count} documento(s), último NSU ${cursor}…`;
      const result = await requestAdnBatch(cursor);
      if (!result?.ok) throw new Error(result?.error || "Falha na consulta ao ADN.");
      if (!Array.isArray(result.items) || result.items.length > 50) throw new Error("Lote inválido recebido do ADN.");
      if (result.finished || result.items.length === 0) { complete = true; break; }
      for (const item of result.items) {
        if (!Number.isSafeInteger(item.nsu) || item.nsu <= cursor) throw new Error("Sequência de NSU inválida.");
        const xmlBytes = await decodeAdnXml(item.archive);
        const type = safeAdnName(item.type, "DOCUMENTO");
        const key = safeAdnName(item.key, "sem-chave");
        zip.file(`XML_ADN/${type}/NSU-${item.nsu}-${key}.xml`, xmlBytes);
        if (full) {
          const root = adnXmlDocument(xmlBytes);
          if (root.localName === "NFSe") notes.push(adnParseNote(root, xmlBytes, `NSU-${item.nsu}.xml`));
          else if (root.localName === "evento") events.push(adnParseEvent(root, xmlBytes, `NSU-${item.nsu}.xml`));
        }
        cursor = item.nsu;
        count++;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (caught) {
    error = caught;
  }
  try {
    if (count) {
      let exported = 0;
      if (full) {
        adnLinkEvents(notes, events);
        const selected = notes.filter(note => {
          const direction = note.issuerId === company ? "issued" : note.recipientId === company ? "received" : "other";
          const month = note.issue.slice(0, 7);
          return (!company || (direction !== "other" && (!directionFilter || directionFilter === direction))) &&
            (!from || month >= from) && (!to || month <= to);
        });
        if (selected.length) {
          const packageResult = await adnCreatePackage(selected, company, {
            includePdf: format === "all", includeXlsx: format !== "xml-only",
            onProgress: message => { adnFeedback.textContent = message; }
          });
          packageResult.zip.file("CONSULTA-ADN.txt", `NSU inicial: ${startNsu}\nÚltimo NSU: ${cursor}\nDocumentos recebidos: ${count}\nNFS-e selecionadas: ${selected.length}\nConsulta completa: ${complete && !error ? "sim" : "não"}\n`);
          await saveAdnArchive(packageResult.zip, `nfse-pacote-nsu-${startNsu + 1}-a-${cursor}.zip`, selected.length);
          exported = selected.length;
        } else {
          await saveAdnZip(zip, startNsu, cursor, count, complete && !error);
          adnFeedback.textContent = "Nenhuma NFS-e correspondeu aos filtros; o ZIP original foi salvo.";
        }
      } else await saveAdnZip(zip, startNsu, cursor, count, complete && !error);
      adnNextNsu = complete ? 0 : cursor;
      adnExportButton.textContent = complete ? (full ? "Baixar pacote completo" : "Baixar XMLs em ZIP") : `Continuar do NSU ${cursor}`;
      if (full && exported) adnFeedback.textContent = `Pacote preparado: ${exported} NFS-e selecionada(s), NSU até ${cursor}${complete ? "." : "; continue para o próximo lote."}`;
    }
    if (!(full && count && !error)) adnFeedback.textContent = error
      ? `${error.message} ${count ? `ZIP parcial com ${count} documento(s) salvo; continue do NSU ${cursor}.` : "Nenhum XML foi baixado."}`
      : complete
        ? `Concluído: ${count} documento(s) no ZIP.`
        : count
          ? `ZIP com ${count} documento(s) preparado. Continue do NSU ${cursor} para obter os próximos.`
          : "Consulta interrompida antes do primeiro documento.";
  } catch (saveError) {
    adnFeedback.textContent = `Não foi possível gerar o ZIP: ${saveError.message}`;
  } finally {
    adnRunning = false;
    adnExportButton.disabled = false;
    adnStopButton.hidden = true;
  }
});
