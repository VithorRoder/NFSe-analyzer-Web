// Representação local para conferência; o XML do ADN continua sendo o documento fiscal.
async function adnBuildNotePdf(note) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const xml = adnXmlDocument(note.bytes);
  const info = adnNode(xml, "infNFSe");
  const dps = adnNode(info, "DPS", "infDPS");
  const issuer = adnNode(info, "emit");
  const recipient = adnNode(dps, "toma");
  const service = adnNode(dps, "serv");
  const values = adnNode(dps, "valores");
  const taxes = adnNode(values, "trib");
  const doc = await PDFDocument.create();
  doc.setTitle(`NFS-e ${note.number || note.key}`);
  doc.setCreator("NFSe Analyzer");
  let page = doc.addPage([595.28, 841.89]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.17, 0.27);
  const muted = rgb(0.37, 0.43, 0.52);
  const blue = rgb(0.28, 0.39, 0.81);
  const light = rgb(0.94, 0.96, 1);
  const margin = 36;
  const width = 523;
  let y = 800;

  // A fonte padrão do PDF usa WinAnsi. Substitui caracteres fora desse repertório.
  const safe = value => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e\xa0-\xff]/g, " ");
  const draw = (value, x, baseline, size = 9, font = regular, color = ink) =>
    page.drawText(safe(value), { x, y: baseline, size, font, color });
  const fit = (value, maxWidth, size = 9, font = regular) => {
    let result = safe(value);
    if (font.widthOfTextAtSize(result, size) <= maxWidth) return result;
    while (result.length && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) result = result.slice(0, -1);
    return `${result}...`;
  };
  const lines = (value, maxWidth, size = 9, limit = 4) => {
    const words = safe(value).split(/\s+/).filter(Boolean);
    const result = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(next, size) <= maxWidth) line = next;
      else {
        if (line) result.push(line);
        line = word;
      }
    }
    if (line) result.push(line);
    if (result.length > limit) {
      result.length = limit;
      result[limit - 1] = fit(`${result[limit - 1]}...`, maxWidth, size);
    }
    return result;
  };
  const money = value => value === "" ? "Nao informado" :
    `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = value => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
    return match ? `${match[3]}/${match[2]}/${match[1]}${match[4] ? ` ${match[4]}` : ""}` : (value || "Nao informado");
  };
  const field = (label, value, x, baseline, maxWidth) => {
    draw(label.toUpperCase(), x, baseline, 7, bold, muted);
    draw(fit(value || "Nao informado", maxWidth, 9), x, baseline - 13, 9);
  };
  const section = title => {
    page.drawRectangle({ x: margin, y: y - 6, width, height: 24, color: light });
    draw(title, margin + 9, y + 2, 9, bold, blue);
    y -= 33;
  };
  const rule = () => page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 0.5, color: rgb(0.82, 0.85, 0.9) });
  const footer = () => {
    draw("Confira a autenticidade e a situacao atual no portal oficial pela chave de acesso.", margin, 53, 8, regular, muted);
    draw("XML original preservado no mesmo ZIP. PDF gerado pelo NFSe Analyzer.", margin, 40, 8, regular, muted);
  };
  const id = node => adnText(node, "CNPJ") || adnText(node, "CPF") || adnText(node, "NIF");
  const party = (title, node) => {
    section(title);
    field("Nome / razao social", adnText(node, "xNome"), margin + 8, y, width - 16);
    y -= 31;
    field("CNPJ / CPF / NIF", id(node), margin + 8, y, 250);
    field("Inscricao municipal", adnText(node, "IM"), margin + 280, y, 230);
    y -= 31;
    const address = adnNode(node, "end", "endNac") || adnNode(node, "end");
    const street = [adnText(address, "xLgr"), adnText(address, "nro"), adnText(address, "xCpl"), adnText(address, "xBairro")].filter(Boolean).join(", ");
    field("Endereco", street, margin + 8, y, width - 16);
    y -= 31;
    field("Municipio / UF / CEP", [adnText(address, "cMun") || adnText(node, "cMun"), adnText(address, "UF"), adnText(address, "CEP")].filter(Boolean).join(" / "), margin + 8, y, 250);
    field("Contato", [adnText(node, "fone"), adnText(node, "email")].filter(Boolean).join(" / "), margin + 280, y, 230);
    y -= 36;
  };

  page.drawRectangle({ x: margin, y: 758, width, height: 66, color: light });
  draw("NFS-e | Documento auxiliar", margin + 13, 796, 17, bold, blue);
  draw("Representacao gerada localmente a partir do XML do ADN", margin + 13, 778, 8, regular, muted);
  const situation = { valid: "VALIDA", cancelled: "CANCELADA", substituted: "SUBSTITUIDA" }[note.status] || "NAO IDENTIFICADA";
  const statusColor = note.status === "cancelled" ? rgb(0.7, 0.22, 0.22) : note.status === "substituted" ? rgb(0.43, 0.3, 0.7) : rgb(0.16, 0.46, 0.34);
  draw(situation, margin + 13, 763, 10, bold, statusColor);
  if (adnText(info, "tpAmb") === "2") draw("SEM VALIDADE JURIDICA - HOMOLOGACAO", margin + 250, 763, 8, bold, statusColor);
  y = 724;
  section("IDENTIFICACAO DA NFS-e");
  field("Chave de acesso", note.key, margin + 8, y, width - 16);
  y -= 30;
  field("Numero da NFS-e", note.number, margin + 8, y, 160);
  field("Competencia", date(adnText(dps, "dCompet")), margin + 185, y, 150);
  field("Emissao NFS-e", date(adnText(info, "dhProc")), margin + 356, y, 160);
  y -= 30;
  field("DPS numero / serie", [adnText(dps, "nDPS"), adnText(dps, "serie")].filter(Boolean).join(" / "), margin + 8, y, 160);
  field("Emissao DPS", date(adnText(dps, "dhEmi")), margin + 185, y, 150);
  field("Emitente", adnText(info, "tpEmit"), margin + 356, y, 160);
  y -= 36;
  party("PRESTADOR DE SERVICOS", issuer);
  party("TOMADOR DE SERVICOS", recipient);
  section("SERVICO PRESTADO");
  field("Codigo de tributacao nacional / municipal", [adnText(service, "cServ", "cTribNac"), adnText(service, "cServ", "cTribMun")].filter(Boolean).join(" / "), margin + 8, y, 280);
  field("Codigo NBS", adnText(service, "cServ", "cNBS"), margin + 320, y, 190);
  y -= 30;
  draw("DESCRICAO DO SERVICO", margin + 8, y, 7, bold, muted);
  const description = lines(adnText(service, "cServ", "xDescServ"), width - 16, 8.5, 4);
  for (const line of description.length ? description : ["Nao informado"]) {
    y -= 12;
    draw(line, margin + 8, y, 8.5);
  }
  y -= 19;
  if (y < 300) {
    footer();
    page = doc.addPage([595.28, 841.89]);
    y = 782;
    draw(`NFS-e ${note.number || note.key} | ${situation}`, margin, 803, 12, bold, blue);
  }
  section("VALORES E TRIBUTOS");
  field("Valor do servico", money(adnText(values, "vServPrest", "vServ")), margin + 8, y, 160);
  field("Valor liquido", money(adnText(info, "valores", "vLiq")), margin + 185, y, 160);
  field("ISSQN", money(adnText(info, "valores", "vISSQN")), margin + 356, y, 160);
  y -= 30;
  field("PIS", money(adnText(taxes, "tribFed", "piscofins", "vPis")), margin + 8, y, 160);
  field("COFINS", money(adnText(taxes, "tribFed", "piscofins", "vCofins")), margin + 185, y, 160);
  field("ISS retido", adnText(taxes, "tribMun", "tpRetISSQN"), margin + 356, y, 160);
  y -= 37;
  rule();
  if (note.events.length) {
    y -= 19;
    draw("EVENTOS ASSOCIADOS", margin + 8, y, 8, bold, muted);
    for (const event of note.events.slice(0, 3)) {
      y -= 13;
      draw(`${event.eventType} - ${date(event.date)}`, margin + 8, y, 8);
    }
  }
  footer();
  return doc.save();
}
