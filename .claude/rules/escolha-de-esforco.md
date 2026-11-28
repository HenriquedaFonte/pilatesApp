# Escolha de modelo e agentes

**Regra do dono (2026-11-19): todo planejamento é feito pelo Opus, em detalhe, para o Sonnet executar sem erro.**
A sessão principal roda em **Sonnet** (esforço medium). Ela executa; não planeja tarefa que não seja trivial.

| Quem | Modelo | Faz |
|---|---|---|
| Sessão principal | Sonnet | Executa passos [SONNET] do plano e tarefas triviais |
| `planejador` | Opus | Planeja qualquer tarefa não trivial em `docs/planos/` |
| `dev-critico` | Opus | Executa passos [OPUS] do plano |
| `revisor` | Opus | Revisa o diff contra o plano, uma vez por PR, antes do push — **só nas tarefas de risco** (seção 4) |

## 1. Trivial? Faço direto (sem plano)
Só quando é **tudo** isso: 1 ou 2 arquivos, sem lógica nova, sem dados. Exemplos:
- corrigir um texto ou tradução comum em `src/locales/` (fora textos legais);
- ajuste de cor, espaçamento, fonte, imagem, meta tag;
- atualizar documentação ou `docs/PENDENCIAS.md`.

## 2. Qualquer outra coisa → `planejador` (Opus) primeiro
Funcionalidade, bug com lógica, mudança em 3+ arquivos, refactor, ou qualquer item da lista crítica abaixo.
1. Aviso o dono em uma linha: "Isso é [X] → planejador (Opus)."
2. Passo ao `planejador` o pedido completo do dono (ele começa sem o histórico).
3. Mostro ao dono um resumo do plano (passos e [SONNET]/[OPUS]) e espero o "ok" antes de executar.

## 2b. Plano enxuto (regra do dono, 2026-11-21: economizar tokens)
- O plano diz **o quê e por quê**: objetivo, decisões, arquivos, regras de negócio, critérios "pronto quando", lista de testes e textos pt/en/fr. **Não cola o código inteiro**: o código é escrito uma vez só, por quem executa o passo.
- Só entra trecho de código quando for armadilha real (SQL/RLS, regex, cálculo de dinheiro ou data, API da biblioteca com pegadinha), com poucas linhas.
- Meta: plano de poucas páginas, não centenas de linhas.

## 3. Execução do plano
- **[SONNET]** → eu executo, exatamente como está escrito. Não invento, não amplio o escopo.
- **[OPUS]** → `dev-critico`, passando o caminho do plano e o número do passo.
- Se um passo estiver ambíguo, der erro que o plano não previu, ou exigir decisão: **paro e devolvo ao `planejador`**. Não improviso.
- Ao terminar cada passo, marco `✅` no plano.

## 4. Revisão do Opus antes do push
- **O `revisor` só entra quando a tarefa toca um destes itens:** banco (migration, RLS, trigger, função SQL), autenticação/papéis/permissões, créditos/pagamentos/check-in/histórico de créditos, Edge Functions e envio de emails, dados pessoais ou segurança, textos legais. Passa **uma vez, antes do push** — nunca a cada passo.
- **Pula a revisão** (basta lint + testes + build + conferir o diff contra o plano): tarefa trivial, tela ou relatório **somente leitura** que não exponha dado pessoal novo, e mudança de interface/texto sem lógica de dados. Na dúvida se toca algum item acima, chamar o `revisor`.
- Ordem: execução completa → lint/testes/build ok → `revisor` com o caminho do plano e a branch → push.
- O `revisor` só recebe o plano e o diff; não releia o projeto inteiro para ele.
- **REPROVADO** ou problema grave/médio: corrige quem fez o passo (Sonnet para [SONNET], `dev-critico` para [OPUS]) e chama o `revisor` de novo **só se a correção mexeu em SQL ou código**. Se a correção foi só em texto, comentário ou documentação, a sessão principal confere o diff contra a lista do revisor e segue, sem segunda volta. Máximo 2 voltas; depois disso, paro e mostro os problemas ao dono.
- Problema leve: corrijo ou anoto em `docs/PENDENCIAS.md`, e digo ao dono qual escolhi.
- No bloco "Próxima sessão", informar o resultado da revisão em uma linha (ou "revisão do Opus dispensada: [motivo]").

## Lista crítica (sempre [OPUS])
- Banco de dados: migrations, RLS, triggers, funções SQL, constraints
- Autenticação, papéis (professor/aluno), permissões, criação de usuários
- Check-in, créditos, pagamentos, histórico de créditos, relatórios
- Edge Functions e envio de emails (`send-email`, Resend)
- Segurança e dados pessoais dos alunos
- Textos legais (Política de Privacidade, Termos de Uso, Regras do Estúdio)

## Garantia de não quebrar
- Antes do push: `npm run lint`, `npm test`, `npm run build`, com o resultado real. Falhou → não pusha.
- Tarefa de risco (seção 4): só pusha com o `revisor` aprovado. As demais: lint, testes e build verdes.
- Conferir o diff contra o plano: nenhum arquivo fora do plano.
- Um assunto por PR. SQL separado de tela quando der.
- O bloco "Próxima sessão" sempre tem a linha **"Se quebrar:"** — GitHub → PR mergeado → **Revert** → mergear o PR de reversão; ou Vercel → Deployments → deploy anterior → **Promote to Production**. Se tiver SQL, dizer qual SQL de reversão rodar.
- A sessão só é encerrada depois de o dono testar o deploy. Se quebrou, corrige na mesma sessão.

## Economia de tokens
- Uma tarefa = uma sessão = um PR.
- **Perguntas ao dono antes de planejar:** se a tarefa depende de decisão do dono, o `planejador` lista as perguntas na primeira chamada e o plano só é detalhado depois das respostas. Evita replanejar a cada resposta.
- **Ajuste de plano** (resposta do dono ou erro previsto em poucas linhas): manda ao `planejador` só o trecho afetado e pede edição mínima; não reler o projeto.
- `docs/PENDENCIAS.md` guarda só o que está em aberto; item `[x]` vai para `docs/PENDENCIAS-HISTORICO.md`. Agentes leem só a parte do PENDENCIAS que toca a tarefa.
- Não montar banco local para testar SQL, salvo se o plano pedir: o teste que vale é o do dono no Supabase.
- Sessão compactada 2 vezes → `docs/PENDENCIAS.md` atualizado e sessão nova.
- O plano fica no repositório: numa sessão nova, basta ler `docs/PENDENCIAS.md` e o plano.
