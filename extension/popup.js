const openSiteButton = document.querySelector("#open-site");
const adnButton = document.querySelector("#test-adn");
openSiteButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://nfseanalyzer.vercel.app/" });
});

adnButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("certificate-status.html") });
});
