const sampleNotes = [
  { number: "000124", client: "Studio Horizonte", date: "18/09/2026", value: 3250, status: "valid" },
  { number: "000123", client: "Almeida & Costa Ltda.", date: "12/09/2026", value: 1800, status: "valid" },
  { number: "000122", client: "Norte Digital", date: "08/09/2026", value: 2400, status: "cancelled" },
  { number: "000121", client: "Clínica Bem Viver", date: "02/09/2026", value: 4750, status: "valid" },
  { number: "000120", client: "Oliveira Consultoria", date: "25/08/2026", value: 2100, status: "valid" }
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const notesBody = document.querySelector("#notes-body");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");

function renderNotes() {
  const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const filtered = sampleNotes.filter(note =>
    (statusFilter.value === "all" || note.status === statusFilter.value) &&
    `${note.number} ${note.client}`.toLocaleLowerCase("pt-BR").includes(query)
  );

  notesBody.replaceChildren();
  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-row";
    cell.textContent = "Nenhuma nota encontrada para esta busca.";
    row.append(cell);
    notesBody.append(row);
  } else {
    filtered.forEach(note => {
      const row = document.createElement("tr");
      [note.number, note.client, note.date, money.format(note.value)].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `status ${note.status}`;
      badge.textContent = note.status === "valid" ? "Válida" : "Cancelada";
      statusCell.append(badge);
      row.append(statusCell);
      notesBody.append(row);
    });
  }
  document.querySelector("#result-count").textContent = `${filtered.length} de ${sampleNotes.length} notas exibidas`;
}

searchInput.addEventListener("input", renderNotes);
statusFilter.addEventListener("change", renderNotes);
renderNotes();

const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const feedback = document.querySelector("#file-feedback");
document.querySelector("#choose-files").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => showFiles(fileInput.files));

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add("drag-over"); });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove("drag-over"); });
}
dropZone.addEventListener("drop", event => showFiles(event.dataTransfer.files));

function showFiles(fileList) {
  const files = Array.from(fileList);
  const xmlFiles = files.filter(file => file.name.toLowerCase().endsWith(".xml"));
  feedback.hidden = false;
  if (!xmlFiles.length) {
    feedback.textContent = "Selecione arquivos com a extensão .xml.";
    return;
  }
  feedback.replaceChildren();
  const summary = document.createElement("strong");
  summary.textContent = `${xmlFiles.length} ${xmlFiles.length === 1 ? "arquivo XML selecionado" : "arquivos XML selecionados"}. `;
  feedback.append(summary, document.createTextNode("A análise dos arquivos estará disponível na próxima etapa."));
  if (files.length !== xmlFiles.length) feedback.append(document.createTextNode(" Arquivos de outros formatos foram ignorados."));
}

document.querySelector("#year").textContent = new Date().getFullYear();
