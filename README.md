# NFSe Analyzer Web

Site estático para analisar NFS-e emitidas do [Portal Nacional da NFS-e](https://www.nfse.gov.br/EmissorNacional). A interface usa HTML, CSS e JavaScript sem build.

## Executar o site

Abra index.html ou rode python -m http.server 8000 e acesse http://localhost:8000.

O endereço público configurado para o complemento é https://nfseanalyzer.vercel.app/.

## Coletar notas

Instale o [complemento Chrome](extension/README.md). Depois faça login no portal, abra **NFS-e emitidas**, aplique os filtros desejados e clique no botão de coleta do complemento. Ele lê as páginas da listagem e transfere os registros diretamente para a aba do site. O site oferece busca, filtros por situação e período, resumo e exportação Excel ou CSV. A planilha Excel inclui abas Resumo e Notas, colunas dimensionadas, valores monetários formatados e destaque para notas canceladas e substituídas. As exportações respeitam os filtros ativos.

Nenhuma senha é solicitada pelo site ou pelo complemento. As notas não são enviadas ao servidor deste projeto; a análise fica na memória da aba.

## Baixar XMLs do ADN

Com o certificado digital selecionado no Chrome e o complemento atualizado, clique em **Baixar XMLs em ZIP** no site. A extensão consulta a API oficial do ADN em lotes por NSU; o site descompacta os XMLs e prepara o ZIP localmente. São até 5.000 documentos por ZIP. Se houver mais, use **Continuar do NSU** na mesma aba para obter a parte seguinte. **Parar e salvar parcial** encerra após o lote atual. O progresso e o último NSU aparecem na página. Para consultar e exportar em uma só operação, marque **Gerar pacote completo em uma operação** e escolha empresa, direção, mês e formato. Ao filtrar por emitidas ou recebidas, o CNPJ/CPF pode ficar vazio quando uma única empresa é comum a todas as notas do lote; nesse caso, ela será identificada automaticamente. Se houver ambiguidade, o ZIP original será salvo e a página solicitará o documento. A consulta ao ADN ainda percorre os NSUs autorizados ao certificado; os filtros são aplicados localmente depois do recebimento de cada lote.

Essa consulta abrange os documentos autorizados ao certificado, inclusive tipos além da NFS-e quando retornados pelo ADN. Ela não usa os filtros de data ou situação da listagem do portal. O XML e a senha do certificado não são enviados ao servidor deste projeto.

## Organizar um ZIP do ADN

Na seção **Organizar um ZIP baixado do ADN**, selecione o ZIP gerado pelo site. A página relaciona os eventos às notas pela chave de acesso: `e101101` marca cancelamento e `e105102` marca cancelamento por substituição. Quando um mesmo CNPJ/CPF aparece como prestador ou tomador de todas as notas, ele é selecionado automaticamente e o filtro começa em **Emitidas**. A tela mostra separadamente a quantidade de emitidas e recebidas; também permite filtrar por mês de emissão ou competência e situação. O visualizador na página permite buscar e abrir cada nota, inclusive os campos fiscais originais do XML. O novo ZIP contém os XMLs originais em pastas por empresa, direção, competência e situação, os eventos correspondentes, uma planilha Excel com resumo e detalhes financeiros e um visualizador HTML que funciona sem rede. A planilha tem uma aba **Campos fiscais XML** com caminho e valor original de cada campo de valores e tributos, preservando a distinção entre campo ausente e zero. A opção **Incluir PDFs das notas** cria uma representação local de cada NFS-e com sua situação e os eventos associados. Esses PDFs servem para conferência e não substituem o XML original ou a consulta ao portal oficial. Todo o processamento acontece no navegador; a assinatura digital não é validada criptograficamente.

## Converter XMLs ou ZIP em PDFs

Na seção **Converter XMLs ou ZIP em PDFs**, selecione arquivos XML soltos ou um ZIP já baixado. O site associa eventos encontrados no ZIP às respectivas notas e baixa um ZIP com os PDFs de conferência, sem nova consulta ao ADN.

## XMLs já baixados

Na seção **Também tenho arquivos XML**, selecione até 1.000 XMLs de NFS-e (até 5 MB por arquivo). O site lê os campos disponíveis localmente, mostra uma prévia e gera um ZIP com os XMLs originais organizados por prestador e competência e uma planilha de detalhes (serviço, ISSQN, PIS e Cofins quando informados). Arquivos repetidos pela chave da NFS-e são ignorados. A presença da assinatura é conferida, mas sua validade criptográfica não é verificada. Situação e eventos não são inferidos apenas do XML; confira-os no portal.

## Limites

O portal pode mudar a estrutura da tabela ou da paginação. Situações ambíguas são marcadas como **Não identificada** e não são somadas como válidas. Os PDFs criados localmente ainda não reproduzem todos os campos, o QR Code ou o leiaute oficial do DANFSe da [Nota Técnica 008/2026, versão 1.02](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc/nt-008-se-cgnfse-danfse-20260714-v1-02.pdf). A listagem do portal continua limitada às notas emitidas.
