# Complemento Chrome — NFSe Analyzer

O complemento conecta o site [NFSe Analyzer](https://nfseanalyzer.vercel.app/) à API oficial do ADN. O Chrome apresenta o certificado digital quando necessário; o complemento não lê o arquivo `.pfx` nem sua senha. Os XMLs retornados são entregues à aba do site, onde são processados e compactados localmente.

## Instalar para teste

A versão da Chrome Web Store ainda está em rascunho. Até a publicação:

1. [Baixe o repositório em ZIP](https://github.com/VithorRoder/NFSe-analyzer-Web/archive/refs/heads/main.zip) e extraia os arquivos.
2. No Chrome, abra `chrome://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `extension` extraída.
4. Abra ou recarregue [o site](https://nfseanalyzer.vercel.app/).

## Baixar notas pelo ADN

1. Selecione o certificado digital no Chrome quando solicitado.
2. No site, clique em **Baixar XMLs pelo ADN**. Para obter XMLs, PDFs de conferência, planilha e visualizador em um único pacote, marque **Gerar pacote completo em uma operação** e escolha os filtros.
3. Se a conexão falhar, clique no ícone do complemento, use **Abrir ADN e selecionar certificado** e repita o teste de acesso.
4. O ADN é consultado por NSU. Cada ZIP contém até 5.000 documentos; se houver mais, use **Continuar do NSU** na mesma aba.

A consulta retorna documentos autorizados ao certificado e não depende da listagem de notas emitidas do portal. Os filtros de empresa e período são aplicados localmente depois que o lote é recebido. O complemento não valida criptograficamente a assinatura dos XMLs.

## Pacote para a Chrome Web Store

Execute `python scripts/package_extension.py` na raiz do repositório. O ZIP em `dist/` contém o `manifest.json`, os scripts e os ícones da extensão. Ao atualizar o rascunho da loja, envie a nova versão do pacote e revise as informações de privacidade e da ficha do item.
