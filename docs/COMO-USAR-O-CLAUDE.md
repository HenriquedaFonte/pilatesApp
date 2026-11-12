# Como usar o Claude neste projeto

## O que existe
- **`CLAUDE.md`** — contexto do projeto e regras fixas. É lido automaticamente em toda sessão.
- **`docs/PENDENCIAS.md`** — a "memória" entre conversas: estado atual, testes em aberto, SQL pendente, o que está por fazer.
- **Agente `dev-critico`** (`.claude/agents/dev-critico.md`, esforço high) — usado sozinho quando a tarefa mexe em banco de dados, autenticação, créditos/pagamentos, Edge Functions, emails, segurança ou textos legais. Segue as regras do projeto e não faz push.
- **Regra de escolha** (`.claude/rules/escolha-de-esforco.md`) — o que é feito direto em medium e o que vai para o `dev-critico`. Na dúvida, o Claude pergunta em uma linha.

## Como seguir
1. **Uma tarefa, uma sessão, um PR.** Mergeou, encerra a sessão. Na próxima tarefa, abre uma nova.
2. Deixe a sessão em **medium** no seletor de esforço do app. O Claude manda o que for crítico para o `dev-critico`.
3. Primeira mensagem de cada sessão nova:
   ```
   Leia docs/PENDENCIAS.md. Quero fazer: [tarefa].
   ```
4. No fim de cada tarefa, peça: **"Atualize o PENDENCIAS"**. Assim a próxima sessão sabe onde paramos.
5. Conversas de negócio (mensagens para alunos, dúvidas gerais, textos para redes sociais): use o app normal do Claude, fora do Claude Code. É bem mais barato.
6. Se a sessão já foi compactada duas vezes, abra uma nova, mesmo no meio de uma tarefa.

## Todo push termina com "Próxima sessão"
1. Merge do PR.
2. SQL para rodar no Supabase, ou "não tem SQL" (e o deploy da Edge Function, se mudou).
3. O que testar depois do deploy.
4. Encerrar esta sessão.
5. Abrir uma sessão nova no Claude Code, no repositório `HenriquedaFonte/pilatesApp`, com o esforço em medium.
6. A primeira mensagem, pronta para colar.
