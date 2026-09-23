if (location.origin === "https://nfseanalyzer.vercel.app") {
  window.postMessage({source:"nfse-analyzer-extension",type:"ready"},location.origin);
  chrome.runtime.onMessage.addListener((message,_sender,sendResponse) => {
    if (message?.type === "NFSE_NOTES" && Array.isArray(message.notes)) {
      window.postMessage({source:"nfse-analyzer-extension",type:"notes",notes:message.notes},location.origin);
      sendResponse({ok:true});
    }
  });
}
