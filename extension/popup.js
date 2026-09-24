const button = document.querySelector("#collect");
const status = document.querySelector("#status");
const adnButton = document.querySelector("#test-adn");
const adnStatus = document.querySelector("#adn-status");
const openAdnButton = document.querySelector("#open-adn");
const ADN_DOCS_URL = "https://adn.nfse.gov.br/contribuintes/docs/index.html";
let portalTab;

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
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

button.addEventListener("click", async () => {
  if (!portalTab) return;
  button.disabled = true;
  status.textContent = "Lendo as notas. Mantenha a aba do portal aberta…";
  try {
    const response = await chrome.runtime.sendMessage({ type: "NFSE_COLLECT", tabId: portalTab.id });
    if (!response?.ok) throw new Error(response?.error || "Falha na coleta.");
    status.textContent = response.count + " notas enviadas ao site.";
  } catch (error) {
    status.textContent = error.message || "Não foi possível coletar as notas.";
  } finally {
    button.disabled = false;
  }
});

adnButton.addEventListener("click", async () => {
  adnButton.disabled = true;
  openAdnButton.style.display = "none";
  adnStatus.textContent = "Consultando a API oficial. O Chrome pode solicitar o certificado…";
  try {
    const response = await chrome.runtime.sendMessage({ type: "NFSE_TEST_ADN" });
    if (!response?.ok) throw new Error(response?.error || "A conexão falhou.");
    const code = response.status;
    adnStatus.textContent = code === 401 || code === 403
      ? `API respondeu HTTP ${code}: acesso não autorizado. Confira o certificado selecionado.`
      : `API respondeu HTTP ${code}. A conexão chegou ao servidor; isso ainda não confirma permissão para baixar notas do CNPJ.`;
  } catch (error) {
    adnStatus.textContent = `A conexão pelo complemento falhou (${error.message || "erro de conexão"}). Abra o ADN no Chrome, selecione o certificado do CNPJ e depois repita o teste.`;
    openAdnButton.style.display = "block";
  } finally {
    adnButton.disabled = false;
  }
});

openAdnButton.addEventListener("click", () => {
  chrome.tabs.create({ url: ADN_DOCS_URL });
});
