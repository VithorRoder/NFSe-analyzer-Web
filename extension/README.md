# Complemento Chrome — NFSe Analyzer

O complemento conecta o site [NFSe Analyzer](https://nfseanalyzer.vercel.app/) à API oficial do ADN. O Chrome apresenta o certificado digital quando necessário; o complemento não lê o arquivo `.pfx` nem sua senha. Os XMLs retornados são entregues à aba do site, onde são processados e compactados localmente.

## Instalar pela Chrome Web Store

Abra a [página do NFSe Analyzer na Chrome Web Store](https://chromewebstore.google.com/detail/ohkpaipmjfkncgmcnjjheplfcocjnpno) e clique em **Usar no Chrome**. Depois, abra ou recarregue [o site](https://nfseanalyzer.vercel.app/).

## Instalar manualmente para desenvolvimento e testes

1. [Baixe o repositório em ZIP](https://github.com/VithorRoder/NFSe-analyzer-Web/archive/refs/heads/main.zip) e extraia os arquivos.
2. No Chrome, abra `chrome://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `extension` extraída.
4. Abra ou recarregue [o site](https://nfseanalyzer.vercel.app/).

## Baixar notas pelo ADN

1. Selecione o certificado digital no Chrome quando solicitado.
2. No site, clique em **Baixar pacote completo** e escolha os filtros. A consulta percorre todos os lotes por NSU e gera XMLs, PDFs de conferência, planilha e visualizador ao terminar.
3. No ícone do complemento, use **Verificar certificado em uso**. O Chrome abrirá temporariamente a API oficial e poderá solicitar a escolha do certificado. Quando a API confirmar o acesso, aparecerá **Certificado ativo**. Essa verificação não identifica o certificado usado nem confirma que houve uma troca. Se a lista não aparecer, o Chrome pode ter reutilizado a escolha anterior. Para escolher outro certificado no mesmo perfil, digite `chrome://restart` na barra de endereços do Chrome; depois, verifique novamente e escolha o outro certificado.
4. Se a consulta for interrompida, o site salva os XMLs recebidos sem uma planilha parcial. Você pode consolidar os ZIPs salvos na seção **Consolidar ZIPs do ADN**.

A consulta retorna documentos autorizados ao certificado e não depende da listagem de notas emitidas do portal. Os filtros de empresa e período são aplicados localmente depois que o lote é recebido. O complemento não valida criptograficamente a assinatura dos XMLs.

## Pacote para a Chrome Web Store

Execute `python scripts/package_extension.py` na raiz do repositório. O ZIP em `dist/` contém o `manifest.json`, os scripts e os ícones da extensão. Ao publicar uma atualização na loja, envie a nova versão do pacote e revise as informações de privacidade e da ficha do item.
