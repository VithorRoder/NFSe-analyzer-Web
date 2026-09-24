if (location.origin === "https://nfseanalyzer.vercel.app") {
  window.postMessage({ source: "nfse-analyzer-extension", type: "ready" }, location.origin);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "NFSE_NOTES" && Array.isArray(message.notes)) {
      window.postMessage({ source: "nfse-analyzer-extension", type: "notes", notes: message.notes }, location.origin);
      sendResponse({ ok: true });
    }
  });
  window.addEventListener("message", event => {
    if (event.source === window && event.origin === location.origin &&
      event.data?.source === "nfse-analyzer-site" && event.data.type === "adn-batch") {
      chrome.runtime.sendMessage({ type: "NFSE_ADN_BATCH", nsu: event.data.nsu })
        .then(response => window.postMessage({
          source: "nfse-analyzer-extension", type: "adn-batch-result",
          requestId: event.data.requestId, ...response
        }, location.origin))
        .catch(error => window.postMessage({
          source: "nfse-analyzer-extension", type: "adn-batch-result",
          requestId: event.data.requestId, ok: false,
          error: error.message || "Falha ao comunicar com o complemento."
        }, location.origin));
      return;
    }
    if (event.source !== window || event.origin !== location.origin ||
      event.data?.source !== "nfse-analyzer-site" || event.data.type !== "open-xml") return;
    chrome.runtime.sendMessage({
      type: "NFSE_OPEN_XML",
      pageUrl: event.data.pageUrl,
      xmlUrl: event.data.xmlUrl
    }).then(response => {
      window.postMessage({
        source: "nfse-analyzer-extension",
        type: "xml-open-result",
        requestId: event.data.requestId,
        ok: !!response?.ok,
        error: response?.error || ""
      }, location.origin);
    }).catch(error => {
      window.postMessage({
        source: "nfse-analyzer-extension",
        type: "xml-open-result",
        requestId: event.data.requestId,
        ok: false,
        error: error.message || "Falha ao comunicar com o complemento."
      }, location.origin);
    });
  });
}
