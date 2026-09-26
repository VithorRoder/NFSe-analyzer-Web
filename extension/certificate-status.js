const status = document.querySelector("#status");
const icon = document.querySelector("#icon");
const title = document.querySelector("#title");
const description = document.querySelector("#description");
const retry = document.querySelector("#retry");
const ADN_TEST_URL = "https://adn.nfse.gov.br/contribuintes/DFe/0";

function openCertificateSelection() {
  return new Promise(async (resolve, reject) => {
    let tabId;
    let settled = false;
    const finish = async (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (tabId) await chrome.tabs.remove(tabId).catch(() => {});
      if (error) reject(error);
      else resolve();
    };
    const onUpdated = (updatedId, change) => {
      if (updatedId === tabId && change.status === "complete") finish();
    };
    const onRemoved = removedId => {
      if (removedId === tabId) finish(new Error("A seleção do certificado foi interrompida."));
    };
    const timeout = setTimeout(() => finish(new Error("O ADN demorou demais para abrir. Tente novamente.")), 90000);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    try {
      const tab = await chrome.tabs.create({ url: ADN_TEST_URL, active: true });
      tabId = tab.id;
      if (tab.status === "complete") finish();
    } catch (error) {
      finish(error);
    }
  });
}

async function verifyCertificate() {
  status.className = "checking";
  icon.textContent = "";
  title.textContent = "Verificando certificado em uso…";
  description.textContent = "Uma aba temporária da API oficial será aberta. O Chrome pode solicitar um certificado ou reutilizar a escolha anterior.";

  try {
    await openCertificateSelection();
    title.textContent = "Verificando acesso…";
    description.textContent = "Consultando a API do ADN com o certificado usado pelo Chrome.";
    const response = await chrome.runtime.sendMessage({ type: "NFSE_TEST_ADN" });
    if (!response?.ok) throw new Error(response?.error || "Falha na verificação do ADN.");

    status.className = "success";
    icon.textContent = "✓";
    title.textContent = "Certificado ativo";
    description.textContent = "O certificado em uso no Chrome foi aceito pelo ADN. Esta verificação não confirma uma troca de certificado. Se a lista não apareceu, o Chrome pode ter reutilizado a escolha anterior.";
  } catch (error) {
    status.className = "error";
    icon.textContent = "!";
    title.textContent = "Não foi possível validar o acesso";
    description.textContent = `${error.message || "Erro de conexão."} Confira o certificado no Chrome e tente novamente.`;
  }
}

retry.addEventListener("click", verifyCertificate);
verifyCertificate();
