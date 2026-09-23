# NFSe Analyzer Web

Protótipo estático da interface web do NFSe Analyzer, feito com HTML, CSS e JavaScript sem dependências de build.

## Executar

Abra `index.html` no navegador ou rode um servidor estático local, por exemplo:

```powershell
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Estado atual

- Interface responsiva com área de seleção e arraste de arquivos XML.
- Painel com dados **ilustrativos** e tabela com busca e filtro funcionais.
- Os XMLs selecionados não são lidos nem enviados. A análise real, identificação de cancelamentos e exportação serão implementadas em uma próxima etapa.

Pode ser publicado como site estático no Netlify ou Vercel, usando a raiz do repositório como diretório de publicação.
