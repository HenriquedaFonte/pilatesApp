# Lista de testes — Josi Pilates

> Roteiro curto para fazer os testes de uma vez, agrupados por **o que você precisa para testar**.
> Os passos completos de cada item estão em `docs/PENDENCIAS.md` ("Testes em aberto"); a linha "→" diz qual item abrir.
> Marcar `[x]` aqui não vale: o item só fecha em `PENDENCIAS.md` quando você disser ao Claude que fez.
> Atualizada em 2026-11-21. Já confirmado e fora da lista: filtro "Turma específica" (item 1 da 4.1).

**Antes de começar:** 2 alunos de teste (um em Português, um em English; de preferência um 3º em Français), com emails que você lê. Um deles **sem telefone** e outro **sem data de nascimento**. Um aluno de teste com recibo emitido.

## 1. Computador, como professora — Mensagens (Notificações por email)
- [ ] **4.1** inativos, lixeira, confirmação com Cancelar, progresso "Enviando 1 de N", sem "Dia de matrícula", histórico em linha única (itens 2 a 8) → `Story 4.1`
- [ ] **4.2** os 3 passos, busca, voltar sem perder dados, atalho do relatório de créditos baixos → `Story 4.2`
- [ ] **4.3** abas PT/EN/FR, variáveis, pré-visualização, "mandar teste para mim", envio real para 2 alunos → `Story 4.3`
- [ ] **4.4** histórico por envio, abrir a linha, falha e reenvio, páginas → `Story 4.4`
- [ ] **Turma por horário** (lista de segunda a domingo, contagem bate) → `turma por horário`
- [ ] **Sem botões {nome}/{creditos}** no Aviso geral → `remoção dos botões`
- [ ] **"Atualizar cadastro"** na pré-visualização PT/EN/FR (item "Nome Completo", data de nascimento, texto dos recibos). **A Josi precisa aprovar o texto nas 3 línguas** → `Nome Completo`, `20261113000000` item 6
- [ ] **Créditos zerados e Mudança de horário:** a Josi lê e aprova os textos novos → `Story 4.3` item 1
- [ ] Textos novos em English e Français em tudo acima

## 2. Computador, como professora — Recibos de seguro
- [ ] **Relatório fiscal** (Relatórios → Recibos de seguro): números, Excel com 3 abas, outro período, 3 línguas, aluno bloqueado → `relatório fiscal` (item 7: mandar o arquivo ao contador)
- [ ] **Pré-visualizar** kinésithérapie e naturopathie: data do último tratamento, rodapé sem número, nome/licença alinhados, tudo em preto → `data do último tratamento`, `nome e licença`, `ajuste de cor da 3.4`
- [ ] **Emitir** (recibo de teste), salvar no cadastro de seguro, anular, lista geral, aluno com recibo não apaga de vez → `Story 3.5`
- [ ] **Mostra "Ainda não aberto" / "Aberto pelo aluno em..."** (professora abre e continua "não aberto") → `20261121000000`
- [ ] **Email do recibo:** emitir e anular chegam ao aluno de teste, sem valores, "Gerar PDF" não manda → `email de recibo`
- [ ] **Seguro e dados profissionais** (aba "Dados profissionais", assinatura) → `Story 3.2`
- [ ] A Josi confere o PDF real e o texto da Política de Privacidade (seção 8) → `3.5` item 12, `Story 3.7`

## 3. Como aluno de teste (computador e celular)
- [ ] **Meus recibos:** só os próprios, anulado sem botão, Android/iPhone abrir e compartilhar → `Story 3.6`
- [ ] **Primeira abertura:** aluno abre o recibo; na professora vira "Aberto pelo aluno em..."; abrir de novo não muda a data → `20261121000000` itens 4 a 6
- [ ] **Data de nascimento:** aluno sem data preenche, confirma, fica somente leitura; com data não edita → `20261113000000`
- [ ] **Meu perfil e login em pt/en/fr** (`/login?lng=fr`, `/complete-profile` com aluno sem telefone, aba Segurança) → `preparação do "Atualizar cadastro"`, `Complete seu perfil`
- [ ] **Email do aluno** não editável, seguro saúde do aluno → `20261112060000`, `Story 3.2`
- [ ] **Painel no celular em pé** → `celular em pé`

## 4. Computador, professora — outras telas
- [ ] **Aviso de aniversário** (tela inicial e Alunos) → `aviso de aniversário`
- [ ] **Meu perfil da professora:** link no menu, email de login, mensagens da aba Segurança → `Meu perfil`, `email da professora`, `aba Segurança`
- [ ] **Check-in** abre normal, sem a tela de parabéns → `remoção da surpresa`
- [ ] **Smoke test geral** das telas de professora e aluno depois das migrations de segurança → `3 migrations de segurança`, `20261112040000`, `20261112060000`

## 5. Celular, como professora
- [ ] **Lista de turmas rola** na matrícula, botões sempre visíveis → `rolagem da lista de turmas`
- [ ] Telas da 4.1 a 4.4 sem rolar para o lado

## 6. Site público (josipilates.com), sem login
- [ ] **Tema escuro:** título "seu corpo" em verde-claro → `destaque do título`
- [ ] **Lista de idiomas no celular** abre com fundo → `lista de idiomas`
- [ ] **WhatsApp/mensagem** nas 3 seções, número abre o WhatsApp → `ícone de mensagem`
- [ ] **Formulário de contato** e **"Esqueci a senha"** chegam → `send-email restrita`

## 7. Cadastro e emails automáticos
- [ ] **Cadastro público** em pt/en/fr (boas-vindas sem `<b>` ativo, contato `josi@josipilates.com`, sem "undefined"); apagar as contas de teste depois → `boas-vindas do cadastro`
- [ ] **send-email restrita:** criar aluno, adicionar créditos, aviso, termo com PDF → `send-email restrita`
- [ ] **Emails automáticos desligados:** no dia seguinte, nenhum aviso automático saiu → `20261112050000`

## 8. Supabase / SQL (painel, sem tela)
- [ ] `docs/testes/seguranca-privilegios-teste.sql` (trocar os 3 UUIDs; termina em ROLLBACK) → `Teste SQL de profiles`
- [ ] `SELECT count(*) FROM get_students_for_notification('low_credits');` sem erro e `SELECT jobname FROM cron.job;` sem os 4 jobs de créditos → `20261112050000`
- [ ] Edge Functions: só `create-user`, `manage-student`, `reset-password`, `send-email` (e `send-campaign`) → `apagar send-custom-email...`
- [ ] Log da `manage-student` sem email → `deploy da manage-student`
- [ ] **Apagar o token temporário** "claude-3.3" (Supabase) e o secret de `api.supabase.com` (claude.ai) → `Apagar o token temporário`

## Ainda sem teste possível agora (dependem de decisão ou de terceiros)
- Contador: as colunas do Excel servem? (item 7 do relatório fiscal)
- Josi aprova os textos novos de "Atualizar cadastro" (e só depois enviar para todos os alunos).
- Login que volta para "Meus recibos" (hoje deslogado cai na página inicial; limitação conhecida, está em "A fazer").
