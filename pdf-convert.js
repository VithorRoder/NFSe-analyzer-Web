// Conversão offline de XMLs/ZIPs já existentes para PDFs de conferência.
const pdfConvertInput = document.querySelector("#pdf-convert-input");
const pdfConvertButton = document.querySelector("#pdf-convert-button");
const pdfConvertFeedback = document.querySelector("#pdf-convert-feedback");

pdfConvertInput.addEventListener("change", () => {
  const files = [...pdfConvertInput.files];
  pdfConvertButton.disabled = !files.length;
  pdfConvertFeedback.textContent = files.length ? `${files.length} arquivo(s) selecionado(s).` : "Selecione arquivos para começar.";
});

async function pdfReadExistingFiles(files) {
  const notes = [];
  const events = [];
  const seen = new Set();
  let entriesRead = 0;
  async function take(bytes, name) {
    if (bytes.length > 5 * 1024 * 1024) throw new Error(`${name}: XML maior que 5 MB.`);
    const root = adnXmlDocument(bytes);
    if (root.localName === "NFSe") {
      const note = adnParseNote(root, bytes, name);
      if (!seen.has(note.key)) { seen.add(note.key); notes.push(note); }
    } else if (root.localName === "evento") events.push(adnParseEvent(root, bytes, name));
    else throw new Error(`${name}: documento XML não reconhecido.`);
    entriesRead++;
    if (entriesRead > 5000) throw new Error("Limite de 5.000 XMLs por conversão.");
  }
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name}: ZIP maior que 100 MB.`);
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.xml$/i.test(entry.name));
      for (const entry of entries) await take(await entry.async("uint8array"), entry.name);
    } else if (/\.xml$/i.test(file.name)) {
      if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: XML maior que 5 MB.`);
      await take(new Uint8Array(await file.arrayBuffer()), file.name);
    }
    else throw new Error(`${file.name}: selecione XML ou ZIP.`);
  }
  if (!notes.length) throw new Error("Nenhuma NFS-e encontrada nos arquivos selecionados.");
  const unmatched = adnLinkEvents(notes, events);
  return { notes, events, unmatched };
}

pdfConvertButton.addEventListener("click", async () => {
  pdfConvertButton.disabled = true;
  try {
    const { notes, events, unmatched } = await pdfReadExistingFiles([...pdfConvertInput.files]);
    const zip = new JSZip();
    for (const [index, note] of notes.entries()) {
      if (index % 10 === 0) {
        pdfConvertFeedback.textContent = `Gerando PDFs: ${index}/${notes.length}…`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      zip.file(`PDF/${note.key}.pdf`, await adnBuildNotePdf(note));
    }
    zip.file("LEIA-ME.txt", `${notes.length} representações em PDF geradas localmente a partir de XMLs. ${events.length} evento(s) lido(s); ${unmatched} sem nota correspondente. Os PDFs não substituem o XML original nem a consulta ao portal oficial.\n`);
    pdfConvertFeedback.textContent = `Compactando ${notes.length} PDF(s)…`;
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nfse-pdfs-convertidos.zip";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    pdfConvertFeedback.textContent = `${notes.length} PDF(s) gerado(s); ${events.length} evento(s) lido(s).`;
  } catch (error) {
    pdfConvertFeedback.textContent = error.message || "Não foi possível converter os arquivos.";
  } finally {
    pdfConvertButton.disabled = false;
  }
});
