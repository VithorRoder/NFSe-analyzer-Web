# NFSe Analyzer Web

Site estático para analisar NFS-e emitidas do [Portal Nacional da NFS-e](https://www.nfse.gov.br/EmissorNacional). A interface usa HTML, CSS e JavaScript sem build.

## Executar o site

Abra index.html ou rode python -m http.server 8000 e acesse http://localhost:8000.

O endereço público configurado para o complemento é https://nfseanalyzer.vercel.app/.

## Coletar notas

Instale o [complemento Chrome](extension/README.md). Depois faça login no portal, abra **NFS-e emitidas**, aplique os filtros desejados e clique no botão de coleta do complemento. Ele lê as páginas da listagem e transfere os registros diretamente para a aba do site. O site oferece busca, filtros por situação e período, resumo e exportação Excel ou CSV. A planilha Excel inclui abas Resumo e Notas, colunas dimensionadas, valores monetários formatados e destaque para notas canceladas e substituídas. As exportações respeitam os filtros ativos.

Nenhuma senha é solicitada pelo site ou pelo complemento. As notas não são enviadas ao servidor deste projeto; a análise fica na memória da aba.

## Limites

O portal pode mudar a estrutura da tabela ou da paginação. Situações ambíguas são marcadas como **Não identificada** e não são somadas como válidas. Esta versão cobre a listagem de notas emitidas, não a API oficial nem o histórico completo de eventos.
