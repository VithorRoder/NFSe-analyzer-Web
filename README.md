# NFSe Analyzer Web

Site estático para baixar e analisar NFS-e emitidas e recebidas pela API oficial do ADN. A interface usa HTML, CSS e JavaScript sem build.

## Executar o site

Abra index.html ou rode python -m http.server 8000 e acesse http://localhost:8000.

O endereço público configurado para o complemento é https://nfseanalyzer.vercel.app/.

O site apresenta a instalação da extensão como primeiro passo e mantém um [guia de uso separado](guia.html) com validação do certificado, consulta ao ADN e conferência do pacote.

## Baixar XMLs do ADN

Instale o [complemento Chrome pela Chrome Web Store](https://chromewebstore.google.com/detail/ohkpaipmjfkncgmcnjjheplfcocjnpno) ([instruções de instalação](extension/README.md)) e selecione o certificado digital no Chrome. Clique em **Baixar pacote completo** no site. A extensão consulta a API oficial do ADN em lotes por NSU, percorre automaticamente todos os documentos autorizados e só monta o relatório após o fim da consulta. Escolha empresa, direção, mês e formato antes de iniciar; os filtros são aplicados localmente aos documentos recebidos. O CNPJ/CPF pode ficar vazio quando uma única empresa aparece como prestadora ou tomadora em todas as notas; o site a identifica e classifica a direção também no modo **Emitidas e recebidas**. Se houver ambiguidade, o ZIP original será salvo e a página solicitará o documento. **Parar e salvar parcial** encerra após o lote atual e guarda os XMLs recebidos, sem gerar planilha parcial. Em caso de interrupção, a seção **Consolidar ZIPs do ADN** continua disponível para juntar os arquivos salvos.

Essa consulta abrange os documentos autorizados ao certificado, inclusive tipos além da NFS-e quando retornados pelo ADN. A senha do certificado não é solicitada pelo site ou pelo complemento; os XMLs são processados na aba do navegador.

## Consolidar ZIPs do ADN

Na seção **Consolidar ZIPs do ADN**, selecione todos os ZIPs originais gerados pela mesma consulta. O site confere a sequência dos NSUs desde o início até a confirmação de fim e bloqueia o relatório se faltar um lote. A página relaciona os eventos às notas pela chave de acesso: `e101101` marca cancelamento e `e105102` marca cancelamento por substituição. Quando um mesmo CNPJ/CPF aparece como prestador ou tomador de todas as notas, ele é selecionado automaticamente e o filtro começa em **Emitidas e recebidas**. A tela mostra separadamente a quantidade de emitidas e recebidas; também permite filtrar por mês de emissão ou competência e situação. O visualizador na página permite buscar e abrir cada nota, inclusive os campos fiscais originais do XML. O novo ZIP contém os XMLs originais em pastas por empresa, direção, competência e situação, os eventos correspondentes, uma planilha Excel com resumo e detalhes financeiros e um visualizador HTML que funciona sem rede. A planilha tem uma aba **Campos fiscais XML** com caminho e valor original de cada campo de valores e tributos, preservando a distinção entre campo ausente e zero. A opção **Incluir PDFs das notas** cria uma representação local de cada NFS-e com sua situação e os eventos associados. Esses PDFs servem para conferência e não substituem o XML original ou a consulta ao portal oficial. Todo o processamento acontece no navegador; a assinatura digital não é validada criptograficamente.

O visualizador HTML do ZIP percorre todas as notas por páginas de 100, com busca, filtros de situação, direção e emissão, ordenação e resumo de contagens e valores dos serviços válidos, além de cartões separados para ISS, PIS, Cofins e retenções informadas nos XMLs das notas que correspondem aos filtros. Ao abrir uma nota, mostra bases, alíquotas, tributos, retenções, descontos, eventos e os campos fiscais originais. Juros, multas e acréscimos aparecem somente quando constam do XML.

## Converter XMLs ou ZIP em PDFs

Na seção **Converter XMLs ou ZIP em PDFs**, selecione arquivos XML soltos ou um ZIP já baixado. O site associa eventos encontrados no ZIP às respectivas notas e baixa um ZIP com os PDFs de conferência, sem nova consulta ao ADN.

## XMLs já baixados

Na seção **Também tenho arquivos XML**, selecione até 1.000 XMLs de NFS-e (até 5 MB por arquivo). O site lê os campos disponíveis localmente, mostra uma prévia e gera um ZIP com os XMLs originais organizados por prestador e competência e uma planilha de detalhes (serviço, ISSQN, PIS e Cofins quando informados). Arquivos repetidos pela chave da NFS-e são ignorados. A presença da assinatura é conferida, mas sua validade criptográfica não é verificada. Situação e eventos não são inferidos apenas do XML; confira-os no portal.

## Limites

Os PDFs criados localmente ainda não reproduzem todos os campos, o QR Code ou o leiaute oficial do DANFSe da [Nota Técnica 008/2026, versão 1.02](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc/nt-008-se-cgnfse-danfse-20260714-v1-02.pdf).
