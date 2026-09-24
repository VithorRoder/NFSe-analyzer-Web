const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (event.data?.source !== "nfse-analyzer-extension" || event.data.type !== "ready") return;
  const badge = document.querySelector("#connection-badge");
  if (badge) badge.textContent = "Complemento conectado";
});
