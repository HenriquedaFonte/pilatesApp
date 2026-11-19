# Como usar o Claude neste projeto

## O que existe
- **`CLAUDE.md`** — contexto do projeto e regras fixas. É lido automaticamente em toda sessão.
- **`docs/PENDENCIAS.md`** — a "memória" entre conversas: estado atual, testes em aberto, SQL pendente, o que está por fazer.
- **Agente `planejador`** (`.claude/agents/planejador.md`, **Opus**) — faz todo o planejamento de tarefas não triviais, em `docs/planos/`, detalhado para o Sonnet executar sem decidir nada. Você aprova o plano antes da execução.
- **Agente `dev-critico`** (`.claude/agents/dev-critico.md`, **Opus**) — executa os passos [OPUS] do plano, usado quando a tarefa mexe em banco de dados, autenticação, créditos/pagamentos, Edge Functions, emails, segurança ou textos legais. Segue as regras do projeto e não faz push.
- **Agente `revisor`** (`.claude/agents/revisor.md`, **Opus**) — revisa o diff contra o plano uma vez por PR, antes do push. Se reprovar, o código volta para correção.
- **Regra de escolha** (`.claude/rules/escolha-de-esforco.md`) — o que é trivial (feito direto), o que vai para o `planejador` e o que vai para o `dev-critico`. Antes de trocar de agente, o Claude avisa em uma linha.

## Como seguir
1. **Uma tarefa, uma sessão, um PR.** Mergeou, encerra a sessão. Na próxima tarefa, abre uma nova, só depois do merge.
2. Deixe a sessão em **Sonnet** (esforço medium) no seletor do app. O Sonnet executa; o planejamento vai sozinho para o `planejador` (Opus) e os passos críticos para o `dev-critico` (Opus).
3. Primeira mensagem de cada sessão nova:
   ```
   Comece do main atualizado. Leia docs/PENDENCIAS.md. Quero fazer: [tarefa].
   ```
4. No fim de cada tarefa, peça: **"Atualize o PENDENCIAS"**. Assim a próxima sessão sabe onde paramos.
5. Conversas de negócio (mensagens para alunos, dúvidas gerais, textos para redes sociais): use o app normal do Claude, fora do Claude Code. É bem mais barato.
6. Se a sessão já foi compactada duas vezes, abra uma nova, mesmo no meio de uma tarefa.

## Todo push termina com "Próxima sessão"
1. Merge do PR.
2. SQL para rodar no Supabase, ou "não tem SQL" (e o deploy da Edge Function, se mudou).
3. O que testar depois do deploy.
4. Se quebrar: como voltar atrás.
5. Encerrar esta sessão.
6. Abrir uma sessão nova no Claude Code, no repositório `HenriquedaFonte/pilatesApp`, com o modelo Sonnet.
7. A primeira mensagem, pronta para colar, começando com "Comece do main atualizado."
