const openSiteButton = document.querySelector("#open-site");
const certificateButton = document.querySelector("#select-certificate");
openSiteButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://nfseanalyzer.vercel.app/" });
});

certificateButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("certificate-status.html") });
});
