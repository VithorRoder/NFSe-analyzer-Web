if (location.origin === "https://nfseanalyzer.vercel.app") {
  window.postMessage({ source: "nfse-analyzer-extension", type: "ready" }, location.origin);
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
    }
  });
}
