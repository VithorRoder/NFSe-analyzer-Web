# NFSe Analyzer Web

Site estático para analisar NFS-e emitidas do [Portal Nacional da NFS-e](https://www.nfse.gov.br/EmissorNacional). A interface usa HTML, CSS e JavaScript sem build.

## Executar o site

Abra index.html ou rode python -m http.server 8000 e acesse http://localhost:8000.

O endereço público configurado para o complemento é https://nfseanalyzer.vercel.app/.

## Coletar notas

Instale o [complemento Chrome](extension/README.md). Depois faça login no portal, abra **NFS-e emitidas**, aplique os filtros desejados e clique no botão de coleta do complemento. Ele lê as páginas da listagem e transfere os registros diretamente para a aba do site. O site oferece busca, filtros por situação e período, resumo e exportação Excel ou CSV. A planilha Excel inclui abas Resumo e Notas, colunas dimensionadas, valores monetários formatados e destaque para notas canceladas e substituídas. As exportações respeitam os filtros ativos.

Nenhuma senha é solicitada pelo site ou pelo complemento. As notas não são enviadas ao servidor deste projeto; a análise fica na memória da aba.

## Baixar XMLs do ADN

Com o certificado digital selecionado no Chrome e o complemento atualizado, clique em **Baixar XMLs em ZIP** no site. A extensão consulta a API oficial do ADN em lotes por NSU; o site descompacta os XMLs e prepara o ZIP localmente. São até 5.000 documentos por ZIP. Se houver mais, use **Continuar do NSU** na mesma aba para obter a parte seguinte. **Parar e salvar parcial** encerra após o lote atual. O progresso e o último NSU aparecem na página.

Essa consulta abrange os documentos autorizados ao certificado, inclusive tipos além da NFS-e quando retornados pelo ADN. Ela não usa os filtros de data ou situação da listagem do portal. O XML e a senha do certificado não são enviados ao servidor deste projeto.

## XMLs já baixados

Na seção **Também tenho arquivos XML**, selecione até 1.000 XMLs de NFS-e (até 5 MB por arquivo). O site lê os campos disponíveis localmente, mostra uma prévia e gera um ZIP com os XMLs originais organizados por prestador e competência e uma planilha de detalhes (serviço, ISSQN, PIS e Cofins quando informados). Arquivos repetidos pela chave da NFS-e são ignorados. A presença da assinatura é conferida, mas sua validade criptográfica não é verificada. Situação e eventos não são inferidos apenas do XML; confira-os no portal.

## Limites

O portal pode mudar a estrutura da tabela ou da paginação. Situações ambíguas são marcadas como **Não identificada** e não são somadas como válidas. A consulta ADN salva os XMLs, mas não gera DANFSe nem valida assinaturas digitais. A listagem do portal continua limitada às notas emitidas.
