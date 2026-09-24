const openSiteButton = document.querySelector("#open-site");
const adnButton = document.querySelector("#test-adn");
const adnStatus = document.querySelector("#adn-status");
const openAdnButton = document.querySelector("#open-adn");
const ADN_DOCS_URL = "https://adn.nfse.gov.br/contribuintes/docs/index.html";
openSiteButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://nfseanalyzer.vercel.app/" });
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
