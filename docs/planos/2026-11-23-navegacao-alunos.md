# Plano: navegação de Alunos (busca/filtro na URL, um só "voltar", rolagem)
Data: 2026-11-23 · Branch: fix/navegacao-alunos

## Objetivo
Na lista de Alunos, a busca e o filtro de status passam a ficar na URL. Abrir a ficha de um aluno e voltar
traz a lista como estava (mesma busca, mesmo filtro), já rolada até o card desse aluno. No celular a ficha
tem um "voltar" só (o "← Voltar" do topo). Abrir Alunos pelo menu (ou pelo painel) começa sempre no topo.

## Fora do escopo
- Rolagem das outras telas da professora (só a lista de Alunos ganha o controle de rolagem).
- Traduzir os textos fixos em português/inglês que já existem na lista ("Gestão de Alunos", "Ativos",
  "Search students...", etc.).
- Mudar o "← Voltar" das outras telas (continua igual: volta no histórico ou vai para a Visão geral).

## Contexto lido
- `src/pages/TeacherStudents.jsx` — `searchTerm` já lê `?search=` só na montagem (useState), mas não grava;
  `statusFilter` é useState puro (`'active'` padrão; valores `active|inactive|all|online`). Enquanto carrega,
  devolve só o spinner (sem layout). Entradas para a ficha: botão "Ver" (`navigate`, ~l.1058), badge online
  (`<Link>`, ~l.990), faixa de pedidos online (`<Link>`, ~l.884) e `BirthdayBanner` (~l.875).
- `src/pages/StudentSummary.jsx` — seta própria `<Link to="/teacher/students">` (~l.306), aparece no celular
  e no computador; empurra uma entrada nova no histórico (perde busca/filtro).
- `src/components/TeacherLayout.jsx` — `handleBack` (só no celular, `md:hidden`): `history.state.idx > 0`
  → `navigate(-1)`, senão `/teacher/dashboard`. Menu: `<Link to="/teacher/students">`.
- `src/components/BirthdayBanner.jsx` — `<Link>` para a ficha; usado também em `TeacherDashboard.jsx`.
- `src/App.jsx` — `BrowserRouter` (react-router-dom 7), páginas `lazy`; sem `ScrollRestoration` nem
  "rolar ao topo". Quem rola é a janela (`main` não tem altura fixa).
- Outros links: `TeacherCheckIn.jsx` usa `/teacher/students?search=<nome>` (manter o nome `search`);
  `TeacherDashboard.jsx` faz `navigate('/teacher/students')`.

## Decisões
- **Por que hoje abre no meio:** o `BrowserRouter` não mexe na rolagem; a janela fica na altura da tela
  anterior (Visão geral, ficha). O spinner de carregamento é curto, mas no celular (sobretudo iPhone) a
  posição nem sempre volta a 0 antes de os cards chegarem, e a lista aparece na altura antiga. A correção
  não depende da causa exata: depois que os cards renderizam, a lista **decide** a rolagem (card ou topo).
- **Params:** `search` (texto; omitido se vazio), `status` (omitido quando `active`; valor inválido = `active`),
  `student` (id do último aluno aberto a partir da lista). Nada de nomes em português na URL.
- **Gravação sempre com `replace: true`** (digitar, trocar filtro, marcar o aluno): o histórico não ganha
  uma entrada por letra, e "voltar" da lista sai da lista.
- **Montar os params do zero** (função pura), nunca com `setSearchParams(prev => ...)` (no RR 7 o `prev`
  é o da renderização, não o mais novo). Trocar busca ou filtro **apaga** `student`.
- **Campo de busca continua com estado local** (inicializado da URL) e grava na URL no mesmo `onChange`.
  Não ligar o `<Input>` direto em `searchParams`: no RR 7 a atualização de localização roda em
  `startTransition`, e input controlado por transição perde letras/cursor. O filtro (Select) pode ler
  direto da URL.
- **Marcar o card antes de sair:** `rememberStudent(id)` grava `student=id` (com `replace`) mantendo
  `search`/`status`; logo depois vem a navegação para a ficha (push). No `<Link>` o `onClick` do usuário
  roda antes da navegação do Link, então basta `onClick={() => rememberStudent(id)}` (sem
  `preventDefault`). No botão "Ver": `rememberStudent(id)` e depois `navigate(...)`.
- **Quando rolar:** um efeito roda quando `loading` vira `false` e a cada nova entrada do histórico
  (`location.key`), **exceto** navegações `REPLACE` depois da primeira vez (são as nossas gravações).
  Se há `student` e existe `#student-card-<id>` → `scrollIntoView({ block: 'center' })` (o centro evita o
  cabeçalho fixo do celular); senão → `window.scrollTo(0, 0)`. Aluno que saiu do filtro (ex.: inativado na
  ficha) → topo.
- **Card:** `id={`student-card-${student.id}`}` no `<Card>` (o Card do shadcn repassa props ao `div`).
- **"Voltar" da ficha:** função única `goBack(navigate, fallback)` em `src/lib/navigation.js` (mesma regra
  de hoje: `history.state.idx > 0` → `navigate(-1)`, senão `navigate(fallback)`). `TeacherLayout` ganha a
  prop opcional `backTo` (padrão `/teacher/dashboard`). A ficha passa
  `backTo={`/teacher/students?student=${studentId}`}`: aberta por link direto, o voltar cai na lista (no
  topo do filtro padrão, rolada até o aluno). Com histórico, `navigate(-1)` volta à entrada
  `?search=..&status=..&student=<id>` gravada antes de sair.
- **Seta da ficha:** some no celular (`hidden md:inline-flex`), fica no computador (onde o "← Voltar" do
  topo não existe) e passa a usar `goBack` com o mesmo `backTo`, em vez do `<Link>`. `aria-label` =
  `t('common.back')` (chave que já existe).
- **Menu "Alunos" estando já na lista** (mesma rota, outra URL, componente não desmonta): navegação PUSH →
  o efeito de busca recarrega `searchTerm` da URL (vazio) e o de rolagem leva ao topo.

## Passos
### 1. [SONNET] Funções puras dos params e do voltar
- Arquivos novos: `src/lib/studentListParams.js`, `src/lib/navigation.js`.
- Fazer:
  - `STUDENT_STATUS_FILTERS = ['active', 'inactive', 'all', 'online']`.
  - `readStudentListParams(searchParams)` → `{ search, status, student }` (`search` `''` se faltar; `status`
    fora da lista → `'active'`; `student` `null` se faltar).
  - `buildStudentListParams({ search, status, student })` → `URLSearchParams` novo, só com o que não é
    padrão (`search` não vazio, `status !== 'active'`, `student` presente).
  - `goBack(navigate, fallback = '/teacher/dashboard')` com a regra do `idx` acima.
- Pronto quando: as funções existem, sem React, e os testes do passo 5 passam.

### 2. [SONNET] TeacherLayout usa `goBack` e aceita `backTo`
- Arquivo: `src/components/TeacherLayout.jsx`.
- Fazer: assinatura `({ children, backTo })`; `handleBack = () => goBack(navigate, backTo || '/teacher/dashboard')`.
  Nada mais muda (botão, `md:hidden`, textos).
- Pronto quando: telas que não passam `backTo` se comportam como hoje.

### 3. [SONNET] Ficha do aluno: um só voltar, pelo histórico
- Arquivo: `src/pages/StudentSummary.jsx`.
- Fazer: `const backTo = `/teacher/students?student=${studentId}``; passar `backTo={backTo}` aos **dois**
  `<TeacherLayout>` (o de "não encontrado" e o principal). Trocar o `<Link to="/teacher/students"><Button…>`
  por um `<Button>` com `onClick={() => goBack(navigate, backTo)}`, `aria-label={t('common.back')}` e
  `hidden md:inline-flex` somado às classes atuais. Importar `useNavigate`; tirar `Link` do import se não
  sobrar uso.
- Pronto quando: no celular só aparece o "← Voltar" do topo; no computador só a seta da página; as duas
  voltam no histórico.

### 4. [SONNET] Lista: busca/filtro na URL, marcar o card e rolar
- Arquivos: `src/pages/TeacherStudents.jsx`, `src/components/BirthdayBanner.jsx`.
- Fazer em `TeacherStudents.jsx`:
  - `const [searchParams, setSearchParams] = useSearchParams()`, `useLocation()`, `useNavigationType()`;
    `const { status: statusFilter, student: focusStudentId } = readStudentListParams(searchParams)` (apagar o
    `useState('active')`). `searchTerm` continua `useState(() => readStudentListParams(searchParams).search)`.
  - `writeListParams(next)` = `setSearchParams(buildStudentListParams(next), { replace: true })`.
  - Input: `onChange` → `setSearchTerm(v)` + `writeListParams({ search: v, status: statusFilter })`.
  - Select: `onValueChange={v => writeListParams({ search: searchTerm, status: v })}`.
  - `rememberStudent(id)` = `writeListParams({ search: searchTerm, status: statusFilter, student: id })`.
    Usar no botão "Ver" (antes do `navigate`), no `onClick` do `<Link>` do badge online e dos links da
    faixa de pedidos online, e passar `onStudentClick={rememberStudent}` ao `<BirthdayBanner>`.
  - `id={`student-card-${student.id}`}` no `<Card>` de cada aluno.
  - Efeito da busca, deps `[location.key]`: se `navigationType !== 'REPLACE'`, `setSearchTerm(` search da
    URL `)` (com o comentário `eslint-disable-next-line react-hooks/exhaustive-deps -- …` como no resto do
    arquivo).
  - Efeito da rolagem (`useLayoutEffect`), deps `[loading, location.key]`, com `handledKeyRef = useRef(null)`:
    ```js
    if (loading) return
    if (handledKeyRef.current !== null && navigationType === 'REPLACE') return
    if (handledKeyRef.current === location.key) return
    handledKeyRef.current = location.key
    const el = focusStudentId && document.getElementById(`student-card-${focusStudentId}`)
    if (el) el.scrollIntoView({ block: 'center' })
    else window.scrollTo(0, 0)
    ```
- Fazer em `BirthdayBanner.jsx`: prop opcional `onStudentClick`; no `<Link>` de cada aluno,
  `onClick={() => onStudentClick?.(student.id)}`. Na Visão geral (sem a prop) nada muda.
- Pronto quando: digitar/filtrar muda a URL sem criar entradas no histórico; "Ver" → voltar traz a mesma
  busca e filtro com o card do aluno no meio da tela; menu "Alunos" abre no topo e limpa busca/filtro;
  `?search=` vindo do Check-in continua funcionando.

### 5. [SONNET] Testes automáticos
- Arquivo novo: `src/tests/studentListParams.test.js` (vitest, no estilo de `birthdays.test.js`).
- Casos: ler params vazios → `{ search: '', status: 'active', student: null }`; `status=xyz` → `active`;
  montar só com padrão → string vazia; com tudo → `search=…&status=online&student=…` (com espaço/acento
  ida e volta igual); `status: 'active'` não entra na URL; `goBack` com `window.history.replaceState({ idx: 2 }, '')`
  chama `navigate(-1)` e com `{ idx: 0 }`/`null` chama `navigate(fallback)` (usar `vi.fn()`; o ambiente já é jsdom em `vite.config.js`).
- Pronto quando: `npm test` passa com os testes novos.

## Textos (pt / en / fr)
Nenhum texto novo. A seta da ficha usa `common.back` (já existe: Voltar / Back / Retour).

## Banco de dados
- SQL: não.
- Ordem: não se aplica.
- Edge Function a publicar: nenhuma.

## Testes
- Automáticos: `npm run lint`, `npm test`, `npm run build` + `src/tests/studentListParams.test.js`.
- Manual depois do deploy (celular e computador):
  1. Visão geral rolada até embaixo → ☰ → Alunos: a lista abre **no topo**. Idem pelo botão "Alunos" do painel.
  2. Buscar "ma" e filtrar "Todos": a URL mostra `?search=ma&status=all`. Rolar, tocar em "Ver" de um aluno
     no meio da lista → na ficha, no celular só há o "← Voltar" do topo; tocar nele: volta à lista com "ma"
     e "Todos", com o card do aluno no meio da tela. No computador, a seta da página faz o mesmo.
  3. Repetir pelo badge "Online", pela faixa de pedidos online e pelo link de aniversário.
  4. Na lista, digitar e trocar o filtro várias vezes e depois usar o voltar do navegador/celular: sai da
     lista de uma vez (não volta letra por letra).
  5. Abrir a ficha por link direto (colar a URL da ficha numa aba nova) → voltar: cai na lista (filtro
     "Ativos"), rolada até esse aluno.
  6. Estando na lista com busca, tocar em Alunos no menu: busca e filtro limpos, topo.
  7. Check-in → nome do aluno: a lista abre filtrada por esse nome, no topo.
  8. Inativar o aluno na ficha (filtro "Ativos") e voltar: a lista abre no topo, sem erro.
  9. Recarregar a lista com `?search=…&status=inactive`: busca e filtro aplicados.

## Riscos e como voltar atrás
- Risco baixo (só navegação e leitura da tela; sem banco, sem créditos). Risco possível: digitação na busca
  "pulando" letras se alguém ligar o input direto na URL — por isso o estado local (ver Decisões).
- Revisão do `revisor`: **dispensada** — mudança de interface/navegação, sem dados, auth, créditos ou emails
  (regra 4 de `escolha-de-esforco.md`); basta lint + testes + build + conferir o diff contra este plano.
- Voltar atrás: Revert do PR no GitHub, ou Vercel → Deployments → deploy anterior → Promote to Production.
  Sem SQL de reversão.
