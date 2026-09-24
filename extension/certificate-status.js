const status = document.querySelector("#status");
const icon = document.querySelector("#icon");
const title = document.querySelector("#title");
const description = document.querySelector("#description");
const retry = document.querySelector("#retry");

async function verifyCertificate() {
  status.className = "checking";
  icon.textContent = "";
  title.textContent = "Verificando certificado…";
  description.textContent = "O Chrome pode solicitar que você selecione seu certificado digital.";

  try {
    const response = await chrome.runtime.sendMessage({ type: "NFSE_TEST_ADN" });
    if (!response?.ok) throw new Error(response?.error || "Falha na verificação do ADN.");

    status.className = "success";
    icon.textContent = "✓";
    title.textContent = "Certificado válido";
    description.textContent = "A API de distribuição do ADN respondeu com acesso autorizado. Esta aba será fechada automaticamente.";
    setTimeout(async () => {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) await chrome.tabs.remove(tab.id);
    }, 2400);
  } catch (error) {
    status.className = "error";
    icon.textContent = "!";
    title.textContent = "Não foi possível validar o acesso";
    description.textContent = `${error.message || "Erro de conexão."} Confira o certificado no Chrome e tente novamente.`;
  }
}

retry.addEventListener("click", verifyCertificate);
verifyCertificate();
