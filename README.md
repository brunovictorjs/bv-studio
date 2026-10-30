# BV Studio · Agendamento para salões e barbearias

Demo de um software de agendamento multiunidade, feita para apresentar a clientes. Segue o design system **BV** (grafite, carvão e branco, Jost + JetBrains Mono, cantos retos, sem sombras) e funciona em **português e inglês**.

São três apps dentro de um projeto:

| Área | Rota | Para quem |
| --- | --- | --- |
| Landing | `/` | Apresentação do produto |
| Painel | `/admin` | Administrador e balconista: visão geral, vendas, balcão, pedidos, agenda, conversas da IA, avaliações, catálogo, ofertas, unidades, usuários, assistente IA e configurações |
| App do profissional | `/pro` | Agenda do dia, conferir código, atendimento ao vivo, extras, conclusão, avulso, ganhos, avaliações e avisos |
| Site do cliente | `/app` | Escolher unidade, catálogo, carrinho, agendar em 3 passos, pagar (Pix, cartão ou balcão), pedidos, cancelamento, avaliação, favoritos, perfil e WhatsApp simulado |

A barra no topo troca de área, de idioma e de tema, e restaura os dados. No painel e no app do profissional dá para trocar o usuário da demo (admin, balconista ou qualquer profissional).

## Como os dados funcionam

- **O banco fica no navegador** (`localStorage`). Na primeira visita, `POST /api/seed` gera cerca de 6 semanas de pedidos com datas relativas a hoje. Quando o dia vira, os dados se regeneram sozinhos para a agenda nunca ficar vazia.
- **As regras de negócio ficam no back-end do Next.js.** Cada ação envia o banco atual, aplica a regra e devolve o banco novo:
  - `POST /api/actions/:name` → `{ db, result }`, por exemplo `checkout.reserve`, `pro.checkIn`, `desk.settle`, `offer.save`
  - `POST /api/queries/:name` → `{ data }`, por exemplo `dashboard`, `agenda`, `availabilityDay`, `proEarnings`
  - O corpo vai comprimido com gzip (cerca de 190 KB por chamada).
- Pagamentos (Stripe), WhatsApp (Z-API) e IA são **simulados**. A assistente do WhatsApp responde por regras no servidor: pedidos, preços, horários livres e endereço. Ela encaminha para uma pessoa quando o cliente pede ou quando o assunto é sensível.

Regras que já estão implementadas: disponibilidade por profissional (horário próprio, intervalo, férias e turno extra), escolha de "qualquer profissional", ofertas por dia da semana sem conflito, horário segurado enquanto o cliente paga, código do pedido e código de conclusão, encaixe de cliente atrasado com prazo até virar falta, extras lançados pelo profissional que viram saldo no balcão, troco, entrega de produtos com código, comissão por profissional com exceção por categoria, taxas do Stripe, estorno no prazo, avaliações que entram na home e bloqueio de mudanças de agenda quando há clientes marcados.

## Stack

Next.js 16 (App Router, Route Handlers) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · GSAP · Zod

```
src/
  app/                 páginas (admin, pro, app) e rotas /api
  server/              regras de negócio: actions, queries, scheduling, seed
  lib/domain/          tipos e regras puras compartilhadas
  lib/client/          store no navegador, cliente da API, hooks
  i18n/                idioma: cada texto é um par [pt, en] perto da tela que o usa
  components/          kit visual, shells mobile, gráficos, animações
```

## Rodar local

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Publicar na Vercel

1. Suba o repositório para o GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório e mantenha o preset **Next.js**.
3. Faça o deploy. Não precisa de variável de ambiente nem de banco.

## Adaptar para um cliente

- Cores e tipografia: tokens em `src/app/globals.css` (`--surface-*`, `--ink*`, `--hairline`) e fontes em `src/app/layout.tsx`.
- Logo: `public/brand/bv-logo.png`, desenhada por máscara CSS, então assume a cor do tema.
- Nome, unidades, serviços e equipe da demo: `src/server/seed/catalog.ts`.

---

Desenvolvido por **Bruno Victor** · Desenvolvedor de Software · `@brunovictor.jsx`
