# Reflexo em Órbita

Minijogo de reflexos do ASTRO, com o Astrinho em 3D. Reaja ao sinal vermelho
usando Espaço ou tocando/clicando na tela.

## Executar localmente

Requer Node.js 22.12+ e npm.

```sh
npm ci
npm run dev
```

Para gerar e visualizar a versão de produção:

```sh
npm run build
npm run preview
```

## Como jogar

- Reaja em menos de **400 ms** para vencer.
- Comece com Espaço ou tocando/clicando na tela. Faça o mesmo quando o sinal aparecer.
- A pendência surge entre 2 e 6 segundos. Quando ela for identificada, a tela e o Astrinho ficam vermelhos; reaja em menos que o limite escolhido.
- Cada partida tem até três chances. Uma vitória encerra a partida imediatamente.
- Na tela inicial, segure **Ver estado de pendência** para ver uma prévia do sinal.
- Os efeitos sonoros são gerados pelo navegador; use o botão de alto-falante para silenciá-los.
- Os recordes são locais ao navegador e não são compartilhados entre visitantes.

## GitHub Pages

O workflow em `.github/workflows/deploy-pages.yml` gera o site e publica o
conteúdo de `dist/` no GitHub Pages sempre que há um push para `main`. O caminho
de build para o repositório `Astro-Inter/reflexo-em-orbita` é configurado no
`vite.config.ts` somente no GitHub Actions; o desenvolvimento local continua na
raiz.
