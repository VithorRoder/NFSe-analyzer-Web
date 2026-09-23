const button = document.querySelector("#collect");
const status = document.querySelector("#status");
let portalTab;

chrome.tabs.query({active:true,currentWindow:true}).then(([tab]) => {
  if (!tab || new URL(tab.url).origin !== "https://www.nfse.gov.br") {
    button.disabled = true;
    status.textContent = "Abra a aba do portal da NFS-e para iniciar.";
    return;
  }
  portalTab = tab;
}).catch(() => {
  button.disabled = true;
  status.textContent = "Não foi possível identificar a aba do portal.";
});

button.addEventListener("click",async () => {
  if (!portalTab) return;
  button.disabled = true;
  status.textContent = "Lendo as notas. Mantenha a aba do portal aberta…";
  try {
    const response = await chrome.runtime.sendMessage({type:"NFSE_COLLECT",tabId:portalTab.id});
    if (!response?.ok) throw new Error(response?.error || "Falha na coleta.");
    status.textContent = response.count + " notas enviadas ao site.";
  } catch (error) {
    status.textContent = error.message || "Não foi possível coletar as notas.";
  } finally {
    button.disabled = false;
  }
});
