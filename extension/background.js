const SITE_URL = "https://nfseanalyzer.vercel.app/";
const PORTAL_ORIGIN = "https://www.nfse.gov.br";
let collecting = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === "NFSE_OPEN_XML") {
    if (!sender.tab?.url?.startsWith(SITE_URL)) {
      sendResponse({ ok: false, error: "Solicitação fora do NFSe Analyzer." });
      return;
    }
    openPortalXml(message.pageUrl, message.xmlUrl)
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message || "Falha ao abrir o XML no portal." }));
    return true;
  }
  if (message?.type !== "NFSE_COLLECT") return;
  if (collecting) {
    sendResponse({ ok: false, error: "Já existe uma coleta em andamento." });
    return;
  }
  collecting = true;
  collect(message.tabId)
    .then(count => sendResponse({ ok: true, count }))
    .catch(error => sendResponse({ ok: false, error: error.message || "Falha na coleta." }))
    .finally(() => { collecting = false; });
  return true;
});

async function openPortalXml(pageUrlText, xmlUrlText) {
  const pageUrl = new URL(pageUrlText);
  const xmlUrl = new URL(xmlUrlText);
  if (pageUrl.origin !== PORTAL_ORIGIN || pageUrl.pathname !== "/EmissorNacional/Notas/Emitidas" ||
    xmlUrl.origin !== PORTAL_ORIGIN || !/^\/EmissorNacional\/Notas\/Download\/NFSe\/[A-Za-z0-9]+\/?$/i.test(xmlUrl.pathname)) {
    throw new Error("Link de XML inválido.");
  }
  const tabs = await chrome.tabs.query({ url: PORTAL_ORIGIN + "/*" });
  const portal = tabs.find(tab => {
    try { return new URL(tab.url).pathname === pageUrl.pathname; } catch { return false; }
  });
  if (!portal) throw new Error("Abra a página de notas emitidas no portal e tente novamente.");
  if (portal.url !== pageUrl.href) await navigate(portal.id, pageUrl.href);
  await chrome.tabs.update(portal.id, { active: true });
  await chrome.windows.update(portal.windowId, { focused: true });
  for (let attempt = 0; attempt < 8; attempt++) {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: portal.id },
      func: clickPortalXml,
      args: [xmlUrl.href]
    });
    if (injection?.result) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Não encontrei o comando Download XML nessa página do portal. Refaça a coleta e tente novamente.");
}

function clickPortalXml(xmlUrl) {
  const link = [...document.querySelectorAll("a[href]")].find(item => item.href === xmlUrl);
  if (!link) return false;
  link.click();
  return true;
}

async function collect(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || new URL(tab.url).origin !== PORTAL_ORIGIN) {
    throw new Error("Abra o portal da NFS-e na aba atual.");
  }
  const notes = [];
  const visited = new Set();
  for (let page = 0; page < 100; page++) {
    const current = await chrome.tabs.get(tabId);
    if (!current.url || new URL(current.url).origin !== PORTAL_ORIGIN) throw new Error("A aba saiu do portal.");
    if (visited.has(current.url)) break;
    visited.add(current.url);
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readPortalPage
    });
    const result = injection?.result;
    if (!result || !Array.isArray(result.notes)) throw new Error("Não foi possível ler a página.");
    if (page === 0 && !result.notes.length) {
      throw new Error("Nenhuma nota encontrada. Abra NFS-e emitidas e deixe a listagem visível.");
    }
    notes.push(...result.notes);
    if (notes.length > 10000) throw new Error("A listagem excedeu o limite de 10 mil notas.");
    if (!result.nextUrl || visited.has(result.nextUrl)) break;
    const next = new URL(result.nextUrl);
    if (next.origin !== PORTAL_ORIGIN || next.pathname !== new URL(current.url).pathname) break;
    await navigate(tabId, next.href);
  }
  const sites = await chrome.tabs.query({ url: SITE_URL + "*" });
  let site = sites.find(tab => tab.url?.startsWith(SITE_URL));
  if (!site) site = await chrome.tabs.create({ url: SITE_URL, active: false });
  await waitForReady(site.id);
  await sendNotes(site.id, notes);
  await chrome.tabs.update(site.id, { active: true });
  return notes.length;
}

async function sendNotes(tabId, notes) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "NFSE_NOTES", notes });
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  throw new Error("Recarregue a aba do NFSe Analyzer depois de instalar o complemento e tente novamente.");
}

function navigate(tabId, url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error("O portal demorou para abrir a próxima página.")); }, 20000);
    const listener = (id, change) => {
      if (id === tabId && change.status === "complete") { cleanup(); setTimeout(resolve, 450); }
    };
    function cleanup() { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener); }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.update(tabId, { url }).catch(error => { cleanup(); reject(error); });
  });
}

async function waitForReady(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error("O site demorou para abrir.")); }, 20000);
    const listener = (id, change) => {
      if (id === tabId && change.status === "complete") { cleanup(); resolve(); }
    };
    function cleanup() { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener); }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Esta função roda na aba do portal. Ela lê somente o DOM visível, sem cookies ou credenciais.
function readPortalPage() {
  const plain = value => String(value || "").replace(/\s+/g, " ").trim();
  const normalize = value => plain(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tables = [...document.querySelectorAll("table")];
  const table = tables.find(item => {
    const text = normalize(item.querySelector("thead")?.textContent || "");
    return item.querySelector("tbody tr td") && (text.includes("emissao") || text.includes("situacao") || text.includes("emitida para"));
  }) || tables.find(item => item.querySelector("tbody tr td"));
  if (!table) return { notes: [], nextUrl: null };
  const headers = [...table.querySelectorAll("thead th")].map(th => normalize(th.textContent));
  const index = terms => headers.findIndex(header => terms.some(term => header.includes(term)));
  const dateIndex = index(["emissao", "data"]);
  const clientIndex = index(["emitida para", "tomador", "cliente"]);
  const valueIndex = index(["preco servico", "valor", "total"]);
  const statusIndex = index(["situacao", "status"]);
  const numberIndex = index(["numero", "nfs-e", "nfse"]);
  const notes = [];
  [...table.querySelectorAll("tbody tr")].forEach((row, rowIndex) => {
    const cells = [...row.querySelectorAll("td")].map(td => plain(td.textContent));
    const all = cells.join(" ");
    const date = (cells[dateIndex >= 0 ? dateIndex : 0] || all).match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || "";
    if (!date) return;
    const client = cells[clientIndex >= 0 ? clientIndex : 1] || "";
    const valueText = valueIndex >= 0 ? cells[valueIndex] : [...cells].reverse().find(cell => /(?:R\$\s*)?\d[\d.]*,\d{2}/.test(cell));
    const amount = valueText?.match(/(?:R\$\s*)?(\d[\d.]*,\d{2})/);
    const value = amount ? Number(amount[1].replace(/\./g, "").replace(",", ".")) : 0;
    const statusCell = row.querySelectorAll("td")[statusIndex >= 0 ? statusIndex : 3];
    const rawStatus = plain(statusCell?.textContent);
    const iconStatus = [...(statusCell?.querySelectorAll("[title],[aria-label],[data-bs-original-title],[data-original-title]") || [])]
      .map(element => [element.title, element.getAttribute("aria-label"), element.getAttribute("data-bs-original-title"), element.getAttribute("data-original-title")].filter(Boolean).join(" "))
      .join(" ");
    const statusText = normalize(rawStatus + " " + iconStatus);
    let status = "unknown";
    if (statusText.includes("substitu")) status = "substituted";
    else if (statusText.includes("cancel")) status = "cancelled";
    else if (/\b(emitida|valida|ativa|normal|regular)\b/.test(statusText)) status = "valid";
    const xmlLink = [...row.querySelectorAll("a[href]")].find(link => {
      try {
        const url = new URL(link.href, location.href);
        return url.origin === location.origin &&
          (/download\s+xml/i.test(plain(link.textContent)) || /\/Notas\/Download\/NFSe\//i.test(url.pathname));
      } catch { return false; }
    });
    notes.push({
      number: cells[numberIndex] || "",
      client, date, value, status, rawStatus: rawStatus || iconStatus,
      xmlUrl: xmlLink?.href || "",
      pageUrl: location.href,
      pageRow: rowIndex
    });
  });
  const page = Number(new URL(location.href).searchParams.get("pg") || 1);
  const next = [...document.querySelectorAll("a[href]")].find(link => {
    try {
      const url = new URL(link.href);
      return url.origin === location.origin && Number(url.searchParams.get("pg")) === page + 1;
    } catch { return false; }
  });
  return { notes, nextUrl: next?.href || null };
}
