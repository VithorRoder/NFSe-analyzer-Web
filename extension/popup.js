const openSiteButton = document.querySelector("#open-site");
const certificateButton = document.querySelector("#select-certificate");
const certificateNote = document.querySelector("#certificate-note");

function showCertificateState(verified) {
  certificateButton.textContent = verified ? "Certificado Habilitado" : "Validar Certificado";
  certificateButton.classList.toggle("verified", verified);
  certificateButton.title = verified ? "Clique para validar o acesso novamente" : "Validar acesso ao ADN";
  certificateNote.hidden = !verified;
}

chrome.storage.session.get("certificateVerified")
  .then(({ certificateVerified }) => showCertificateState(certificateVerified === true))
  .catch(() => showCertificateState(false));

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "session" && changes.certificateVerified) {
    showCertificateState(changes.certificateVerified.newValue === true);
  }
});
openSiteButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://nfseanalyzer.vercel.app/" });
});

certificateButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("certificate-status.html") });
});
