# Prompt para Claude Code — FASE 1: Reskin Visual (Risco Zero aos Dados)

> Cole tudo abaixo no Claude Code. Este prompt cobre **apenas a camada de apresentação**. Nenhuma query, schema, RLS ou lógica de negócio é alterada.

---

## ⚠️ REGRAS DE SEGURANÇA — LEIA E SIGA À RISCA

Este é um app de Pilates em produção (React 19 + Vite + TailwindCSS v4 + shadcn/ui + Supabase) com **dados sensíveis reais de alunas no banco**. Sua tarefa é um **reskin puramente visual**. Antes de qualquer alteração, internalize estas regras:

1. **NÃO altere nenhuma query Supabase.** Não toque em `supabase.from(...)`, `select`, `insert`, `update`, `delete`, `.eq()`, etc. Os nomes de campos e tabelas permanecem idênticos.
2. **NÃO altere o schema do banco, migrations, RLS, ou qualquer arquivo em `/supabase` ou `/scripts`.**
3. **NÃO altere a lógica de autenticação** (`src/hooks/useAuth.jsx`) nem o fluxo de rotas em `src/App.jsx` (só pode trocar a aparência, não a lógica de redirecionamento).
4. **NÃO corrija bugs de lógica nesta fase** (saldo, check-in, matrículas). Isso é Fase 2/3, em ambiente de staging. Se encontrar um bug, **apenas anote num comentário `// TODO Fase 2:`** e siga em frente.
5. **NÃO instale dependências novas.** Use apenas o que já está no `package.json` (shadcn/ui, lucide-react, tailwind, sonner).
6. **Trabalhe em uma branch nova:** comece rodando `git checkout -b redesign/fase-1-visual`. Não faça commit na `main`.
7. **Mudanças permitidas:** apenas JSX de apresentação (className, estrutura de layout, componentes visuais), `src/index.css`, e textos da interface (tradução pt-BR). Os dados que entram nos componentes vêm das mesmas variáveis de sempre.

Se qualquer instrução abaixo te forçar a violar uma regra, **pare e me pergunte**.

---

## 📎 ARQUIVOS DE REFERÊNCIA VISUAL (LEIA PRIMEIRO)

Coloquei na pasta `design-reference/` do projeto o **layout de referência aprovado** — é a fonte da verdade do visual. **Antes de codar, leia estes dois arquivos e use-os como guia exato de cores, espaçamento, componentes e estrutura:**

- `design-reference/Redesign Josi Pilates.html` — mockup de todas as telas (login, portal da aluna, portal da professora, relatórios)
- `design-reference/styles.css` — o design system completo: tokens de cor, tipografia, classes de card, sidebar, badges, stat tiles, chips de crédito, etc.

O `styles.css` já contém os valores exatos de cor, raio, sombra e tipografia. **Reaproveite esses valores** ao montar os tokens do shadcn e ao estilizar os componentes — não reinvente. O HTML mostra como cada tela deve ficar montada. Sua tarefa é reproduzir esse visual usando os componentes React/shadcn reais do app, ligados aos dados que já existem.

---

## CONTEXTO DO DESIGN

Estou implementando um redesign aprovado. A identidade é:

- **Cor da marca:** verde-esmeralda da logo — `#15a47e` (primária), `#0d7257` (escuro)
- **Neutros quentes:** creme `#f7f5ef` no lugar de cinza frio; texto `#16221d`
- **Acentos:** clay `#c9745a`, amber `#d4901f`, blue `#3f76c9`, violet `#8466c4`
- **Tipografia:** `Hanken Grotesk` (UI) + `Instrument Serif` (títulos editoriais e números grandes)
- **Idioma:** 100% português (pt-BR), horários em formato 24h
- **Nome do app:** "Josi Pilates" (nunca mais "Pilates Studio")

---

## TAREFA 1 — Tokens de design no index.css

O arquivo `src/index.css` está vazio. Defina o tema da marca usando as variáveis CSS do shadcn/ui. Importe as fontes do Google e mapeie os tokens. Use formato compatível com o Tailwind v4 já configurado no projeto:

```css
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

@layer base {
  :root {
    --background: 45 27% 95%;        /* creme #f7f5ef */
    --foreground: 156 19% 11%;       /* ink #16221d */
    --card: 0 0% 100%;
    --card-foreground: 156 19% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 156 19% 11%;
    --primary: 162 77% 36%;          /* brand #15a47e */
    --primary-foreground: 0 0% 100%;
    --secondary: 162 40% 94%;
    --secondary-foreground: 162 60% 22%;
    --muted: 45 20% 94%;
    --muted-foreground: 156 8% 45%;
    --accent: 162 40% 92%;
    --accent-foreground: 162 60% 20%;
    --destructive: 8 62% 53%;        /* rose #d2533f */
    --destructive-foreground: 0 0% 100%;
    --border: 75 14% 90%;
    --input: 75 14% 90%;
    --ring: 162 77% 36%;
    --radius: 0.85rem;
  }
}

body {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.font-serif-display { font-family: 'Instrument Serif', Georgia, serif; }
```

> Verifique se o `index.css` está importado no `src/main.jsx`. Se o projeto usa formato OKLCH ou outro padrão de tokens shadcn, **adapte mantendo os mesmos valores de cor** — não invente cores diferentes.

---

## TAREFA 2 — Componente de Sidebar (novo shell da professora)

Crie `src/components/TeacherLayout.jsx`: um layout com sidebar fixa à esquerda que envolve todas as páginas da professora. O shadcn já tem o componente `sidebar` instalado — use-o, ou construa com `flex`/`grid` simples.

**Itens de navegação** (com ícones lucide-react, links para as rotas que JÁ existem em `App.jsx`):
- Visão geral → `/teacher/dashboard` (ícone `LayoutDashboard`)
- Alunos → `/teacher/students` (`Users`)
- Turmas → `/teacher/classes` (`BookOpen`)
- Check-in → `/teacher/check-in` (`CircleCheck`)
- **Grupo "Relatórios":**
  - Frequência → `/teacher/attendance-report` (`FileText`)
  - Créditos baixos → `/teacher/low-credits-report` (`CreditCard`)
  - Histórico de créditos → `/teacher/credit-history-report` (`History`)
  - E-mails → `/teacher/email-notifications` (`Mail`)
- **Rodapé:** avatar com iniciais de `profile.full_name`, nome, "Professora", e botão de sair chamando `signOut` do `useAuth` (mesma função de hoje).

O item ativo deve usar `useLocation()` do react-router para destacar a rota atual (`bg-primary/10 text-primary`).

Depois, **envolva cada página da professora com `<TeacherLayout>`** — removendo o `<header>` antigo de cada uma (o que tinha só logo + "Sign Out" + botão voltar). O conteúdo de cada página vira o filho do layout. **Não altere a lógica/dados dentro de cada página**, só a moldura.

---

## TAREFA 3 — Reskin das páginas da professora

Para cada página abaixo, mantenha **toda a lógica, estados, queries e handlers intactos** — altere só a apresentação. Aplique este vocabulário visual:

- Cards: `rounded-2xl border border-border bg-card shadow-sm`
- Títulos de página: `font-serif-display text-3xl` (com a palavra de destaque em `text-primary italic`)
- Stat tiles: ícone em quadrado colorido suave + número grande em `font-serif-display` + label
- Badges de tipo de crédito: Individual = azul, Duo = verde-marca, Grupo = violeta
- Botões já herdam o tema novo via tokens

**Páginas:**

### `TeacherDashboard.jsx`
- Saudação editorial no topo ("Bom dia, {primeiro nome}") + data por extenso em pt-BR
- 4 stat tiles: Alunas ativas, Saldo baixo, Aulas hoje, Turmas na semana — usando os MESMOS valores de `stats` que já existem
- Remova os cards de navegação grandes (agora a navegação está na sidebar) e, no lugar, deixe espaço para conteúdo útil (ex.: lista "Aulas de hoje"). Se não houver dado pronto, deixe um card placeholder com `// TODO Fase 2`.
- ⚠️ Este arquivo importa de `firestoreService`. **NÃO corrija isso agora** (é Fase 2). Apenas adicione `// TODO Fase 2: migrar fetchDashboardStats para Supabase` acima da função.

### `TeacherStudents.jsx`
- Transforme a lista de alunas em tabela (`@/components/ui/table`) ou cards limpos
- Saldo exibido como 3 badges coloridos (Ind/Duo/Grupo) + total — lendo os MESMOS campos `individual_credits`, `duo_credits`, `group_credits` que o código já usa
- Coluna de status: "Em dia" (verde) / "Saldo baixo" (amber) / "Sem créditos" (rose) — baseado no total já calculado
- Botões de ação **com rótulo de texto** ("Saldo", "Turmas") em vez de só ícone. Mantenha os mesmos `onClick`/diálogos.
- Busca no topo (o filtro já existe na lógica)

### `TeacherCheckIn.jsx`
- Lista de alunas como linhas: avatar + nome + saldo + seletor de tipo de crédito + botão de presença
- Estado presente = linha com fundo `bg-primary/5 border-primary/30`
- ⚠️ O seletor de crédito tem um bug (estado compartilhado), mas **NÃO corrija agora**. Apenas reskin. Adicione `// TODO Fase 3: estado de crédito por aluna`.

### `AttendanceReport.jsx`, `lowCreditsReport.jsx`, `CreditHistoryReport.jsx`
- Layout unificado: barra de filtros no topo dentro de um card, tabela shadcn estilizada abaixo
- Badges coloridos para tipos e variações (+verde / −rose)
- Mantenha os mesmos filtros, queries e export CSV existentes

### `EmailNotifications.jsx`
- Já está em pt-BR — apenas aplique o novo visual (cards, badges, layout em 2 colunas: lista de destinatárias + prévia do e-mail)
- Mantenha toda a lógica de seleção e envio

---

## TAREFA 4 — Reskin do Portal da Aluna (mobile-first)

### `StudentDashboard.jsx`
- Header editorial: "Olá, {primeiro nome}" + data por extenso
- **Card de saldo** em gradiente verde da marca com o total grande
- Abaixo, 3 chips coloridos: Individual / Duo / Grupo
  - ⚠️ Hoje o código mostra `profile?.class_balance`. Os campos por tipo são `individual_credits`, `duo_credits`, `group_credits`. **Para esta fase visual**, exiba os 3 campos por tipo nos chips (são leitura simples, sem lógica nova) e o total como a soma deles. Isto é leitura pura — permitido. Adicione `// TODO Fase 2: validar campo de saldo total com o backend`.
- Card "Próxima aula" em destaque (use a primeira aula da agenda já carregada)
- Grade semanal e atividade recente como listas limpas
- Remova o botão "Book a Class (Coming Soon)" desabilitado

### `StudentHistory.jsx`
- Card de resumo no topo (aulas no mês + % presença — calculado a partir dos dados JÁ carregados, sem query nova)
- Histórico de presença e de créditos como listas com badges de status coloridos
- Status em pt-BR: present→"Presente", absent_notified→"Falta avisada", absent_unnotified→"Falta"

---

## TAREFA 5 — Login, Branding e Microcópia

### `Login.jsx`
- Substitua o fundo `from-blue-50 to-indigo-100` por um layout de painel duplo: lado esquerdo com o verde da marca + logo + frase; lado direito com o formulário limpo
- Em telas pequenas, empilhe (só o formulário visível)
- Adicione toggle de mostrar/ocultar senha (ícones `Eye`/`EyeOff`)
- Traduza tudo: "Entrar", "E-mail", "Senha", "Esqueceu a senha?", "Continuar com Google", "Não tem conta? Cadastre-se"

### Branding global
- Troque **todas** as ocorrências de `"Pilates Studio"` por `"Josi Pilates"` em todos os arquivos JSX
- Atualize o `alt` do componente `Logo` e o `<title>` em `index.html`
- A logo já está em `/logo.jpg` — aumente o tamanho onde fizer sentido

### Tradução & formato (apenas strings de UI, não dados)
- Crie um helper `src/lib/format.js` com:
  ```js
  export const getDayName = (d) => ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][d]
  export const formatTime = (t) => new Date(`2000-01-01T${t}`).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
  export const formatDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  ```
- Substitua os arrays de dias em inglês e os `toLocaleTimeString('en-US', { hour12: true })` por essas funções em todas as páginas

### Toasts (opcional, baixo risco)
- O `sonner` já está instalado. Adicione `<Toaster richColors position="top-right" />` no `App.jsx` e troque os `<Alert>` de sucesso/erro por `toast.success(...)` / `toast.error(...)`. Mantenha os `<Alert>` de erro de formulário se preferir — isto é opcional.

---

## ✅ VALIDAÇÃO FINAL

Antes de me entregar, confirme:

- [ ] Está na branch `redesign/fase-1-visual`, nada commitado na `main`
- [ ] `git diff` NÃO mostra nenhuma mudança em queries Supabase, schema, RLS, `/scripts` ou `useAuth`
- [ ] O app builda sem erro (`pnpm build` ou `npm run build`)
- [ ] Todas as rotas existentes continuam funcionando (login → dashboard → cada página)
- [ ] Nenhuma dependência nova no `package.json`
- [ ] Bugs de lógica foram apenas marcados com `// TODO Fase 2/3`, não corrigidos
- [ ] App 100% em português, "Josi Pilates" em todo lugar

Ao terminar, me mostre um resumo do `git diff --stat` e a lista de `// TODO` que você deixou para as próximas fases.

---

*Trabalhe arquivo por arquivo. Comece pela Tarefa 1 (tokens) e Tarefa 2 (sidebar), pois elas dão a base visual para todas as outras.*
