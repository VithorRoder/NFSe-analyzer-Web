# Complemento Chrome — NFSe Analyzer

Este complemento lê a tabela de **NFS-e emitidas** na aba autenticada do portal nacional e entrega as notas diretamente à aba de https://nfseanalyzer.vercel.app/. O site exibe totais e filtros de válidas, canceladas, substituídas e situações não identificadas. A coleta não lê senha ou cookies e não envia dados fiscais a um servidor do projeto.

## Instalar para teste

1. Baixe o repositório como ZIP no GitHub e extraia os arquivos, ou clone o repositório.
2. No Chrome, abra chrome://extensions.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e escolha a pasta extension extraída.
5. Fixe o ícone do NFSe Analyzer na barra do Chrome.
6. Se o site já estava aberto, recarregue a aba para ativar a conexão com o complemento.

O complemento ainda não está publicado na Chrome Web Store. A instalação acima é a forma de testar esta primeira versão.

## Pacote para a Chrome Web Store

No repositório, execute `python scripts/package_extension.py`. O arquivo gerado em `dist/` contém `manifest.json` na raiz, os scripts e os ícones PNG. Envie esse ZIP pelo painel de desenvolvedor da Chrome Web Store após testar a coleta com uma conta real e completar as informações de privacidade da loja.

## Usar

1. Abra https://nfseanalyzer.vercel.app/ em uma aba.
2. Abra https://www.nfse.gov.br/EmissorNacional em outra aba e faça login normalmente.
3. Acesse **NFS-e emitidas** e ajuste os filtros do próprio portal para o conjunto desejado.
4. Com a aba do portal ativa, clique no ícone do complemento e em **Coletar notas desta listagem**.
5. O complemento percorre os links de paginação pg=N, abre o site e entrega as notas. No site, você pode buscar, filtrar por situação e data, e exportar o resultado em CSV ou XLSX. Quando o portal expõe o comando de XML na linha, a tabela mostra **Baixar XML**. Esse botão volta à página da nota no portal e aciona o comando original. Resolva o CAPTCHA manualmente quando solicitado. Depois de atualizar o complemento, recarregue o site e faça uma nova coleta para receber os vínculos das páginas.

## Testar acesso à API com certificado

Depois de instalar o certificado A1 no armazenamento de certificados usado pelo Chrome, recarregue o complemento em `chrome://extensions` e clique em **Testar acesso ao ADN** no popup. O teste faz uma única consulta com NSU 0 à API de produção e mostra o código HTTP, sem ler ou enviar o arquivo `.pfx` ou sua senha ao site. O Chrome pode pedir que você selecione o certificado. Um código HTTP indica que a conexão chegou ao servidor, mas não comprova autorização para consultar as notas do CNPJ. HTTP 401/403 indica que a consulta não foi autorizada. Falhas de rede ou certificado também podem aparecer como erro genérico; o teste não baixa XMLs.

Se aparecer **Failed to fetch**, use **Abrir ADN e selecionar certificado**. O Chrome abre a documentação oficial do ADN; selecione o certificado do CNPJ caso seja solicitado. Em seguida, abra o popup e repita o teste. Se a página também não abrir ou o teste continuar falhando, o erro pode estar na configuração do certificado ou na conexão TLS do Chrome. O complemento não consegue identificar a causa exata apenas pela mensagem `Failed to fetch`.

## Limites desta versão

- A leitura depende da estrutura atual da tabela do portal. Mudanças no HTML podem exigir ajustes.
- A paginação automática usa links com parâmetro pg=N, como no aplicativo Python original. Se o portal usar outro tipo de paginação, somente a página atual será coletada.
- Quando a situação não aparece claramente na coluna correspondente, a nota fica como **Não identificada** e é excluída do total válido.
- Esta versão lê a listagem de **notas emitidas**. Não consulta eventos históricos pela API oficial e não valida assinaturas XML.
- Os dados ficam na memória da aba do site. Fechar ou atualizar a aba limpa a análise.
