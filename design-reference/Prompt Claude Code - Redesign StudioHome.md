# Prompt para Claude Code — Redesign da StudioHome (Landing Pública)

> Cole tudo abaixo no Claude Code, rodando dentro da pasta do repositório `pilatesApp`. Este prompt é **puramente visual/apresentação** — não altera queries do Supabase, schema, RLS nem lógica de envio de e-mail.

---

## 📎 ARQUIVOS DE REFERÊNCIA (LEIA PRIMEIRO)

Coloquei na pasta `design-reference/` o redesenho aprovado da landing page pública. **Antes de codar, abra e use como fonte da verdade exata** de cores, espaçamento, tipografia, seções e componentes:

- `design-reference/StudioHome Redesign.html` — o mockup completo (desktop + mobile) de como a página `/` deve ficar
- `design-reference/img/` — as fotos reais do estúdio já organizadas

A página real fica em `src/pages/StudioHome.jsx` (rota `/` no `src/App.jsx`). Sua tarefa é transformar essa página no que está no mockup, **mantendo intacta toda a lógica** (i18n, formulário de contato, carrossel, redirecionamento de usuários logados, fetch de depoimentos).

---

## ⚠️ REGRAS DE SEGURANÇA

Este é um app em produção com dados sensíveis no Supabase. Para esta tarefa:

1. **NÃO altere nenhuma query Supabase** (`fetchTestimonials`, etc.) nem a lógica de `emailService.sendEmail`.
2. **NÃO altere** `useAuth`, o redirecionamento de usuários logados, nem rotas em `App.jsx`.
3. **NÃO altere schema, RLS, migrations ou arquivos `.sql`.**
4. **NÃO instale dependências novas** — use o que já existe (react-i18next, lucide-react, shadcn/ui, embla carousel).
5. **Trabalhe numa branch:** `git checkout -b redesign/studio-home`. Nada na `main`.
6. **Mudanças permitidas:** JSX de apresentação em `StudioHome.jsx`, os tokens de tema (CSS), e os arquivos de tradução (i18n) — apenas para adicionar/corrigir textos, sem mexer em lógica.

---

## IDENTIDADE VISUAL

- **Cor da marca:** verde-esmeralda `#01b48d` (primária), `#017a6b` (escuro), `#0a5a50` (mais escuro). É a cor que já existe nos e-mails (`emailService.js`) — agora vai para o site todo.
- **Neutros quentes:** fundo areia `#f6f3ec` (substituir o `from-blue-50 to-indigo-100`), texto `#1a2420`.
- **Tipografia:** títulos em **Fraunces** (serifada editorial, importada do Google Fonts); corpo em **Hanken Grotesk**. Adicione os `<link>` das fontes no `index.html`.
- **Idioma:** francês como padrão (já é), **mas tudo consistente** — sem inglês solto.

---

## TAREFA 1 — Hero imersivo (a maior mudança)

Hoje o hero é um carrossel de imagens com um cartão de texto branco embaixo. Substitua por um **hero de tela cheia com imagem de fundo e texto sobreposto**, conforme o mockup:

- Fundo: a foto do estúdio (`capa1.avif`) cobrindo a seção, com um gradiente escuro por cima (da esquerda escura para a direita transparente) para legibilidade.
- Sobreposto, à esquerda:
  - **Selos de confiança** (pills translúcidas): "Physiothérapeute certifiée", "15 ans d'expérience", "Montréal, QC"
  - **Título grande** em Fraunces: *"Le Pilates qui prend soin de votre corps, en petit comité."* (com "votre corps" em itálico/verde claro)
  - Parágrafo curto de descrição
  - **Dois CTAs:** primário "Réserver un cours d'essai" (verde) + secundário branco "Voir les services"
- Mantenha o redirect de usuários logados intacto (o `useEffect` que manda teacher/student para o dashboard).
- Pode manter a rotação de imagens de fundo (`capa1/capa2/capa3`) se quiser — mas como fundo do hero, não como banner separado.

> **CTA "Réserver un essai":** como ainda não há sistema de agendamento, aponte o botão para a seção de contato (`#contact`) ou para o WhatsApp (`https://wa.me/14382748396`). Use a mesma rota em todos os CTAs de agendamento.

---

## TAREFA 2 — Barra de confiança + nav

- **Header:** mantenha logo + nome, o seletor de idioma (FR/EN/PT) e o link "Espace client" (login). Adicione um botão primário **"Réserver un essai"** bem visível (hoje o botão mais forte é o portal — inverta a prioridade: agendar é primário, portal é secundário/link).
- Abaixo do hero, adicione uma **faixa fina verde-escura** com 4 diferenciais e ícones: Physiothérapeute · Attention personnalisée · Tous les niveaux · FR/EN/PT.

---

## TAREFA 3 — Seção "À propos"

- Layout em 2 colunas: foto da Josiane (`instructor-photo.jpg.avif`) à esquerda com um selo flutuante "15+ ans", texto à direita.
- Título em Fraunces, parágrafos, e **badges de credenciais** com ícone (Physiothérapeute certifiée, Instructrice Pilates, Prévention des blessures).
- Use as chaves de tradução que já existem (`studioHome.about.*`) — só reestilize.

---

## TAREFA 4 — Serviços com cards de preço

Substitua os 3 cards atuais (que usam fotos históricas em P&B) por **cards de preço claros**, conforme o mockup:

- Cada card: ícone no topo, nome (Privé / Duo / Groupe), descrição curta, **preço grande em destaque** (dès 80$ / 125$ intro / dès 40$), lista de 3 benefícios com check, e um **botão por card**.
- **Destaque o "Duo"** como "Le plus populaire" (borda verde + selo).
- ⚠️ Troque as fotos históricas: use fotos reais das aulas. Se ainda não houver foto de cada tipo, use o ícone + card limpo (como no mockup) e deixe `// TODO: substituir por foto real da aula` — **não** volte a usar as fotos de arquivo P&B.
- Preços vêm das chaves `studioHome.services.*` que já existem nos arquivos de tradução.

---

## TAREFA 5 — Nova seção "Horaires & emplacement"

Crie uma seção nova (fundo verde-escuro) com:
- **Horários** (do schema em `index.html`): Lun–Ven 17:00–20:00, Samedi 08:00–14:00, Dimanche Fermé.
- **Endereço:** 10145 Av. Hamel, Montréal, QC H2C 2X1, telefone/WhatsApp +1 438 274 8396, e-mail.
- **Mapa:** descomente e use o `<iframe>` do Google Maps que já está comentado no final da seção de contato do `StudioHome.jsx` — mova-o para cá e ajuste o `src` para o endereço real (10145 Av. Hamel). Estilize com cantos arredondados.

---

## TAREFA 6 — Contato em francês (corrigir mistura de idioma)

O formulário de contato está hardcoded em inglês. **Traduza para francês** usando chaves i18n novas (não hardcode):

- "First Name" → "Prénom", "Last Name" → "Nom", "Email" → "Courriel", "Message" → "Message"
- "Send" → "Envoyer le message", "Sending..." → "Envoi…"
- "Message Sent!" → "Message envoyé !", e o texto de sucesso
- Subtítulo "Get in touch with us" → remover ou traduzir

Adicione as chaves nos 3 arquivos de tradução (fr, en, pt) e use `t('studioHome.contact.*')`. **Mantenha o `handleContactSubmit` e o `emailService.sendEmail` exatamente como estão.**

Visualmente: troque os **ícones emoji** (`@`, `💬`, `📍`) em bolinhas coloridas por ícones reais do lucide-react (Mail, Phone, MapPin) em quadrados verdes suaves.

---

## TAREFA 7 — Depoimentos e rodapé

- **Depoimentos:** mantenha o carrossel e o fetch do Supabase. Ajustes: aumente o intervalo de auto-avanço de **3s para ~6s** (mais legível), e faça o clique **pausar e retomar** em vez de travar permanente (hoje `setAutoAdvancePaused(true)` nunca volta). Reestilize os cards conforme o mockup (estrelas douradas, avatar com iniciais).
- **Rodapé:** expanda para 4 colunas — marca + redes sociais, Navigation, Horaires, Contact — conforme o mockup. Mantenha os links de Privacy/Terms existentes.

---

## TAREFA 8 — Faixa de CTA

Antes do contato, adicione uma **faixa de chamada** com foto de fundo (`capa2.avif`) + overlay verde: título "Prête à commencer votre parcours ?" e botões "Réserver un cours d'essai" + WhatsApp.

---

## ✅ VALIDAÇÃO

- [ ] Branch `redesign/studio-home`, nada na `main`
- [ ] `git diff` não toca em queries Supabase, `emailService`, `useAuth`, `.sql` ou rotas
- [ ] App builda sem erro
- [ ] Página `/` abre, idioma FR consistente (sem inglês solto no contato)
- [ ] Usuário logado ainda é redirecionado ao dashboard correto
- [ ] Formulário de contato continua enviando e-mail normalmente
- [ ] Nenhuma dependência nova
- [ ] Fotos de arquivo P&B removidas dos cards de serviço

Ao terminar, me mostre o `git diff --stat` e a lista de chaves i18n que você adicionou.

---

*Comece pela Tarefa 1 (hero) e pelos tokens de cor — é o que mais transforma a percepção da página. Trabalhe seção por seção, conferindo contra o `design-reference/StudioHome Redesign.html`.*
