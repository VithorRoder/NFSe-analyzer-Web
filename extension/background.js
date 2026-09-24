const SITE_URL = "https://nfseanalyzer.vercel.app/";
const ADN_TEST_URL = "https://adn.nfse.gov.br/contribuintes/DFe/0";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === "NFSE_TEST_ADN") {
    if (sender.url !== chrome.runtime.getURL("certificate-status.html")) return;
    testAdnConnection()
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error.message || "Falha na conexão com o ADN." }));
    return true;
  }
  if (message?.type === "NFSE_ADN_BATCH") {
    if (sender.tab?.url?.startsWith(SITE_URL) !== true) {
      sendResponse({ ok: false, error: "Solicitação fora do NFSe Analyzer." });
      return;
    }
    getAdnBatch(message.nsu)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error.message || "Falha ao consultar o ADN." }));
    return true;
  }
});

async function testAdnConnection() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(ADN_TEST_URL, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`O ADN respondeu HTTP ${response.status}. Confira o certificado selecionado.`);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.LoteDFe) ||
      (Array.isArray(data.Erros) && data.Erros.length > 0)) {
      throw new Error("O ADN não retornou uma resposta válida da distribuição de documentos.");
    }
    return { status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

async function getAdnBatch(nsu) {
  if (!Number.isSafeInteger(nsu) || nsu < 0) throw new Error("NSU inválido.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`https://adn.nfse.gov.br/contribuintes/DFe/${nsu}`, {
      method: "GET", cache: "no-store", redirect: "error", signal: controller.signal
    });
    if (response.status === 404) return { items: [], finished: true };
    if (!response.ok) throw new Error(`O ADN respondeu HTTP ${response.status}.`);
    const data = await response.json();
    if (Array.isArray(data.Erros) && data.Erros.length) {
      throw new Error("O ADN informou um erro ao consultar o lote.");
    }
    if (!Array.isArray(data.LoteDFe) || data.LoteDFe.length > 50) {
      throw new Error("Resposta inesperada do ADN.");
    }
    if (data.LoteDFe.reduce((size, item) => size + String(item.ArquivoXml || "").length, 0) > 12000000) {
      throw new Error("O lote excedeu o tamanho esperado.");
    }
    const items = data.LoteDFe.map(item => {
      const itemNsu = Number(item.NSU);
      if (!Number.isSafeInteger(itemNsu) || itemNsu <= nsu ||
        typeof item.ArquivoXml !== "string" || item.ArquivoXml.length > 10000000) {
        throw new Error("Documento inválido na resposta do ADN.");
      }
      return {
        nsu: itemNsu,
        key: String(item.ChaveAcesso || ""),
        type: String(item.TipoDocumento || ""),
        archive: item.ArquivoXml
      };
    });
    return { items, finished: items.length === 0 };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Falha de conexão com o ADN. Abra o ADN pelo complemento, selecione o certificado e tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
