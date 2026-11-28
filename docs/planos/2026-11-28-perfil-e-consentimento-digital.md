# Plano: Ficha de saúde e termo de consentimento digitais
Data: 2026-11-28 · Branches: uma por PR (A a D), cada uma numa sessão nova a partir do `main`
Status: **avaliação + plano; nada começa antes do "ok" do dono e das decisões da seção final.**

## Objetivo
O aluno preenche a **ficha de saúde** ("Perfil do cliente") e **aceita o termo das aulas** ("Pilates Lessons Policies") dentro do app, nas 3 línguas. A Josi vê na ficha do aluno o termo aceito (versão, data/hora, nome digitado), o histórico de versões e a ficha de saúde, e na lista de alunos quem está pendente. Quando o texto do termo muda, todo aluno aceita de novo. O arquivo de papel deixa de crescer.

## O que dizem os dois PDFs
**1. `PerfilDoCliente_A4_2017.pdf`** — 1 página, **só em português**, marca antiga "Ponto de Equilíbrio Pilates".
- Identificação: nome, e-mail, data de nascimento, telefones, profissão. *(nome, email, telefone e nascimento já existem em `profiles`; profissão não.)*
- Contato de emergência: nome e telefone.
- 1) Queixa / objetivo principal (texto).
- 2) "Você tem ou já teve" (caixas): doença cardíaca/hipertensão (toma remédio? qual?), problemas respiratórios (asma, rinite), digestivos, dores nas costas/pescoço/ombro, dores em quadris/joelhos/pés, dor de cabeça frequente + "por favor, explique".
- 3) Medicamentos atuais. 4) Tratamento de saúde atual. 5) Cirurgias (quando, qual). 6) Atividades físicas (tempo e frequência).
- 7) Sono e 8) dieta: excelente / bom / regular / ruim. 9) Grávida? quantas semanas.
- Sem assinatura, sem data, sem consentimento para os dados de saúde.

**2. `PilatesLessonsPolices.pdf`** — 1 página, **só em inglês**, marca "Point d'Équilibre Pilates" (título com erro: "Polices").
- "I understand and consent": (1) assumo os riscos do uso dos aparelhos; (2) a instrutora **Josiane da Silveira Malamud** recomenda autorização médica antes de qualquer atividade física; (3) fui informado(a) de que Pilates tem riscos; (4) **isento a Josiane de toda responsabilidade** (reclamações, danos, ações…) ligada ao uso de aparelhos numa aula; (5) ao ler, subscrevo e concordo.
- Nome do cliente, assinatura do cliente, **assinatura da instrutora**, data.
- "Absence policy": endereço 10145 Av Hamel; aviso de 24 h para cancelar/remarcar; cancelamento em cima da hora é cobrado; aula cancelada pela instrutora é reposta. Segunda assinatura do cliente + data.
- **Não tem** campo de responsável para menor de idade nem consentimento para dados de saúde.

## Solução recomendada
1. **Onde o aluno preenche:** um assistente `/student/consent` em 2 passos, aberto automaticamente depois do primeiro acesso (e para quem já tem conta, no próximo login):
   - **Passo 1, termo (bloqueia o painel até aceitar):** texto na língua do aluno, com abas PT/EN/FR (FR sempre disponível); duas caixas obrigatórias ("Li e aceito os riscos e responsabilidades" / "Li e aceito a política de cancelamento") + **nome completo digitado** + botão "Aceito". O servidor grava data/hora, versão, língua, nome digitado, nome do perfil naquele momento, IP e navegador.
   - **Passo 2, ficha de saúde (não bloqueia):** primeiro a caixa de consentimento específico para dados de saúde (exigência da Loi 25), depois o formulário. "Fazer depois" leva ao painel, que mostra uma faixa "Complete sua ficha de saúde" até ela existir.
   - Depois, em **Meu perfil**, aba nova "Saúde e termos": editar a ficha e ver os termos aceitos (versão, data e o texto exato).
2. **Aceite digital:** texto **versionado no banco** (tabela de versões, linhas imutáveis, publicadas só por migration). Aceite = linha imutável gravada só por RPC. Versão nova publicada → todos ficam pendentes e o passo 1 volta a aparecer. **Sem assinatura desenhada** (caixas + nome digitado + registro do servidor valem como assinatura eletrônica no Québec e são mais simples no celular) e **sem assinatura da professora** (o texto já identifica a Josi; o registro mostra quem aceitou e quando).
3. **Professora:** na ficha do aluno (`StudentSummary`), card "Termo e ficha de saúde": status do termo (Aceito vN em data/hora · digital/papel · nome digitado | Pendente | Versão antiga), histórico de aceites, botão "Registrar termo em papel" (exceções), a ficha de saúde (visualizar/editar, "atualizada por … em …"), chips de alerta (gestante, cardíaco/hipertensão, cirurgia) e "Imprimir" (impressão do navegador = salvar como PDF, sem biblioteca nova). Na lista de alunos, badge "Termo pendente".
4. **Alunos que já assinaram em papel:** **não transcrever.** Na publicação da versão 1, todos aceitam online pelo passo 1 (mais um "Aviso geral" pedindo para entrar no portal). "Registrar termo em papel" fica só para quem não usa o app (ou menor com responsável): a Josi imprime o texto atual, colhe a assinatura e registra a data. Os papéis antigos ficam guardados até o fim do prazo de guarda e depois são destruídos.
5. **Permissões (RLS):** ficha e aceites: o próprio aluno lê os seus; a professora (`is_staff()`) lê todos. Aceite: ninguém edita nem apaga pela API. Ficha: só existe com consentimento de saúde ativo do aluno (decisão da ressalva 3); aluno grava a própria; professora grava e pode apagar (pedido do aluno); retirar o consentimento apaga a ficha. `anon` nada.
6. **Email:** sem Edge Function nova. O modelo "Termo de consentimento" atual (PDF anexado para assinar e devolver) fica obsoleto: no lançamento, usar "Aviso geral". Trocar ou remover o modelo antigo é outro PR, depois (mexe em `send-campaign`).

Alternativa descartada: serviço externo de assinatura (DocuSign, Jotform etc.): custo mensal, dados de saúde fora do sistema, sem integração com a ficha.

## Loi 25 e Québec: o que isso exige na prática (não é parecer jurídico)
- **Consentimento expresso e separado** para dados de saúde, com a finalidade clara (adaptar as aulas e a segurança) e em linguagem simples → caixa própria no passo 2, separada do termo.
- **Mínimo necessário:** perguntas de saúde opcionais; nada além do que a Josi usa.
- **Acesso restrito:** só a Josi (e o aluno). Sem outra pessoa com papel `teacher`/`admin` hoje.
- **Guarda e destruição:** definir por quanto tempo a ficha fica depois que o aluno sai e destruir depois. Hoje "lixeira" só esconde (soft delete); "excluir permanentemente" apaga tudo (FK em cascata).
- **Responsável pela proteção dos dados:** por lei é a Josi (dona); nome/título e contato precisam estar publicados na Política de Privacidade.
- **Política de Privacidade atualizada** (seção nova: ficha de saúde, termo, IP/navegador do aceite, quem vê, onde fica guardado, prazo, como pedir acesso, correção ou exclusão).
- **Dados fora do Québec:** conferir a região do projeto no Supabase (Settings → General). `ca-central-1` = Montréal; outra região exige uma avaliação de impacto (EFVP) antes. **Os backups diários vão para o GitHub (EUA), em zip sem senha:** com dados de saúde, criptografar (decisão 8).
- **Incidente:** manter um registro de incidentes de confidencialidade e avisar a CAI se houver risco sério.
- **Francês (Charte, Loi 96):** contrato de adesão tem de ser oferecido em francês primeiro → aba FR sempre visível; a versão em francês faz fé.
- **Cláusula de isenção (item 4 do PDF):** no Québec, não se exclui responsabilidade por dano corporal ou moral (art. 1474 C.c.Q.) e a Lei de proteção do consumidor limita essas cláusulas. Recomendo reescrever como **reconhecimento de riscos e compromisso de informar a saúde**, com "na medida permitida pela lei".
- **A Josi precisa validar:** (a) o texto final com a seguradora de responsabilidade civil (ou um advogado); (b) o prazo de guarda das fichas com a associação profissional dela (kinésithérapie/naturopathie podem ter regra de "dossier client"); (c) a região do Supabase; (d) se há alunos menores de idade (menos de 14 anos: consentimento dos pais exigido pela Loi 25).

## Textos legais (pt / en / fr)
- Quem escreve: o `dev-critico` (Opus), a partir dos dois PDFs, adaptado ao Québec (itens acima) e à marca atual "Josi Pilates" (endereço: confirmar).
- Quem aprova: **a Josi**, nas 3 línguas, antes de publicar. Francês revisado por alguém nativo (ou pela seguradora/advogado). Sem aprovação, a migration de publicação não roda.
- Três textos: **Termo das aulas** (riscos + recomendação médica + compromisso de informar saúde e manter a ficha atualizada + cancelamento 24 h, cancelamento tardio = perda do crédito, aula cancelada pela Josi é reposta); **Consentimento de saúde** (o que é coletado, para quê, quem vê, prazo, retirada); **Política de Privacidade** (seção nova + responsável).

## Fora do escopo
- Assinatura desenhada; assinatura da professora; upload/escaneamento dos papéis antigos.
- Apagar fichas automaticamente depois do prazo (v1: a Josi apaga pela ficha do aluno).
- Revisão anual obrigatória da ficha; segundo telefone; histórico de versões da ficha (só "atualizada por/em").
- Trocar o modelo de email "Termo de consentimento" e o deploy da `send-campaign`.
- Aceite no cadastro público antes do login; menores aceitando sozinhos pelo app.
- Filtro "Termo pendente" na lista (só o badge).

## Contexto lido
- `supabase/migrations/20261112000000_create_student_insurance_and_practitioner.sql` — padrão de tabela 1:1 por aluno com RLS (aluno próprio, professora todos); ficha de saúde segue o mesmo modelo, mas com `is_staff()`.
- `supabase/migrations/20261112010000_fix_profiles_privilege_escalation_and_rls.sql` — `is_staff()` e a guarda de `profiles` (**nada novo em `profiles`**).
- `supabase/migrations/20261123000000_create_online_memberships.sql` — padrão mais recente: checagens iniciais, tabela só SELECT pela API, escrita por RPC `SECURITY DEFINER`, `REVOKE` explícitos, BEGIN/COMMIT.
- `supabase/functions/manage-student/index.ts` — `hard-delete` apaga `profiles`; FK `ON DELETE CASCADE` leva as tabelas novas junto, sem mexer na função.
- `scripts/backup.js` + `.github/workflows/backup.yml` — lista `TABLES`; zip sem criptografia como artefato do GitHub por 90 dias.
- `src/components/ProtectedRoute.jsx`, `src/hooks/useAuth.jsx`, `src/App.jsx` — rotas do aluno com `requireCompleteProfile`; perfil carregado no `useAuth`.
- `src/pages/ProfileCompletion.jsx` → `/change-password` → painel: fluxo do primeiro acesso.
- `src/pages/StudentProfile.jsx` — abas "Informações pessoais"/"Segurança", usa `InsuranceFields`.
- `src/components/InsuranceFields.jsx` — componente de dados sensíveis usado pelo aluno e pela professora (modelo para `HealthProfileForm`).
- `src/pages/StudentSummary.jsx` — ficha do aluno da professora (perfil, seguro, online, recibos).
- `src/pages/TeacherStudents.jsx` — cards com badges de status.
- `src/pages/StudioRules.jsx` + `rules.*` — já tem a política de 24 h ("perda da aula").
- `src/pages/PrivacyPolicy.jsx` + `privacyPolicy.*`, teste `src/tests/privacyPolicy.test.js`.
- `src/lib/emailTemplates.js` (`consentForm`), `templateCards.js`, `public/PilatesLessonsPolicies.pdf` — envio atual do PDF por email (fica como está neste plano).

---

## PR A — Banco (migration, testes SQL, backup) · revisor: sim

### 1. [OPUS] Migration das tabelas, RLS e RPCs ✅
- Arquivo: `supabase/migrations/20261128000000_create_consents_and_health_profiles.sql` (BEGIN/COMMIT, idempotente, checagens iniciais como na `20261123000000`).
- Fazer:
  - `consent_versions`: `id uuid PK`, `kind text CHECK (kind IN ('class_policies','health_data'))`, `version int`, `title_pt/en/fr`, `body_pt/en/fr text NOT NULL` (texto puro, parágrafos com `\n`), `published_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (kind, version)`. **Esta migration não insere nenhuma versão** (sem versão publicada, ninguém fica pendente).
  - `consent_acceptances`: `id uuid PK`, `student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `consent_version_id uuid NOT NULL REFERENCES consent_versions(id)`, `method text CHECK (IN ('digital','paper'))`, `language text CHECK (IN ('pt','en','fr'))`, `typed_name text`, `profile_name text` (nome do perfil no momento), `guardian_name text`, `signed_on date` (papel), `accepted_at timestamptz NOT NULL DEFAULT now()`, `ip text`, `user_agent text`, `recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL`, `UNIQUE (student_id, consent_version_id)`.
  - `student_health_profiles` (1:1): `student_id uuid PK REFERENCES profiles(id) ON DELETE CASCADE`, `occupation`, `emergency_contact_name`, `emergency_contact_phone`, `main_goal`, `conditions text[] NOT NULL DEFAULT '{}'` com `CHECK (conditions <@ ARRAY['cardiac_hypertension','respiratory','digestive','back_neck_shoulder','hip_knee_foot','frequent_headache']::text[])`, `conditions_details`, `medications`, `current_treatment`, `surgeries`, `physical_activities`, `sleep_quality` e `diet_quality` (`CHECK IN ('excellent','good','fair','poor')`, nulos permitidos), `pregnant boolean`, `pregnancy_weeks int CHECK (BETWEEN 1 AND 42)`, `pregnancy_reported_on date`, `created_at`, `updated_at`, `updated_by uuid`. Limite de tamanho nos textos (`CHECK (char_length(x) <= 2000)`). Trigger BEFORE INSERT/UPDATE: `updated_at = now()`, `updated_by = auth.uid()`.
  - **Privilégios (armadilha: o Supabase dá ALL a `authenticated` em tabela nova):** `REVOKE ALL` das 3 tabelas de `anon` e `authenticated`; `GRANT SELECT` nas 3 a `authenticated`; `GRANT INSERT, UPDATE, DELETE ON student_health_profiles TO authenticated`; `service_role` com SELECT (backup).
  - RLS ligada nas 3. Policies: `consent_versions` SELECT para `authenticated`. `consent_acceptances` SELECT `student_id = (SELECT auth.uid()) OR (SELECT is_staff())`; **nenhuma policy de escrita**. `student_health_profiles`: SELECT próprio ou staff; INSERT/UPDATE staff, ou próprio **com** consentimento de saúde dado:
    ```sql
    student_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.consent_acceptances a
      JOIN public.consent_versions v ON v.id = a.consent_version_id
      WHERE a.student_id = (SELECT auth.uid()) AND v.kind = 'health_data')
    ```
    (UPDATE com USING e WITH CHECK iguais, para não trocar `student_id`); DELETE só staff.
  - **Sem trigger de DELETE** em `consent_acceptances` (bloquearia a cascata do "excluir permanentemente").
  - RPCs (`SECURITY DEFINER`, `SET search_path = public`, `REVOKE … FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`; erro = código `consent_...` em `RAISE EXCEPTION`):
    - `accept_consent(p_version_id uuid, p_language text, p_typed_name text) RETURNS uuid` — só `role = 'student'` não apagado; a versão tem de ser a **atual** do seu `kind` (maior `version`); `typed_name` aparado com 2 a 200 caracteres, obrigatório para `class_policies`, opcional para `health_data`; grava `profile_name` de `profiles.full_name`, `method = 'digital'`; se já existe aceite dessa versão, devolve o id existente (duplo clique). IP e navegador:
      ```sql
      v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
      v_ip := nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), '');
      v_ua := left(v_headers->>'user-agent', 500);
      ```
    - `register_paper_consent(p_student_id uuid, p_version_id uuid, p_signed_on date, p_signer_name text, p_guardian_name text DEFAULT NULL) RETURNS uuid` — só `is_staff()`; aluno existe e é `student`; `signed_on` entre 2000-01-01 e hoje em Montréal (`(now() AT TIME ZONE 'America/Montreal')::date`); `method = 'paper'`, `recorded_by = auth.uid()`; aceita qualquer versão existente.
    - `my_pending_consents() RETURNS TABLE (kind text, version_id uuid, version int)` — versões atuais de cada `kind` que o chamador ainda não aceitou.
    - `staff_consent_overview() RETURNS TABLE (student_id uuid, policies_status text, health_consent boolean, health_profile boolean)` — só `is_staff()`; alunos com `deleted_at IS NULL`; `policies_status` = `'current' | 'outdated' | 'none'` (com nenhuma versão publicada: `'current'` para não acender badge).
  - `audit_log` em `register_paper_consent` e no DELETE da ficha (só ids, nunca conteúdo de saúde).
  - Bloco de ROLLBACK comentado no fim.
- Pronto quando: a migration roda duas vezes seguidas sem erro num banco de teste e o script do passo 2 passa.

### 2. [OPUS] Testes SQL e reversão ✅
- Arquivos: `docs/testes/consentimento-teste.sql` (padrão `set_config('request.jwt.claims', …)` + ROLLBACK, igual a `online-modalidade-teste.sql`) e `docs/testes/consentimento-reversao.sql`.
- Cobrir: aluno não lê aceite/ficha de outro; aluno não faz INSERT direto em `consent_acceptances`; não aceita versão antiga; aceite duplo devolve o mesmo id; aluno sem consentimento de saúde não grava ficha; com, grava só a própria e não troca `student_id`; aluno não apaga ficha; professora lê tudo, registra papel, apaga ficha; `anon` não lê nada; `staff_consent_overview` recusa aluno; `profiles` apagado leva aceites e ficha junto.
- Pronto quando: o script termina sem "FALHOU".

### 3. [SONNET] Backup ✅
- Arquivo: `scripts/backup.js` — acrescentar `consent_versions`, `consent_acceptances`, `student_health_profiles` em `TABLES`.
- Pronto quando: `node --check scripts/backup.js` passa. (Criptografia do backup: PR E, se o dono aprovar.)

---

## Decisão: retirada do consentimento de saúde (ressalva 3) — planejador, 2026-11-28
Opções comparadas:
- **(a) Só processo** (aluno pede, a Josi apaga a ficha): sem SQL, mas o aceite continua "ativo", o aluno volta a gravar a ficha pela RLS e `staff_consent_overview` mente. Descartada.
- **(b) Tabela nova `consent_withdrawals`** (eventos): aceites 100 % intactos, mas toda checagem (RLS, 2 RPCs, visão da professora) passa a comparar datas, e o consentimento de novo ainda esbarra no `UNIQUE (student_id, consent_version_id)`. Mais complexa.
- **(c) Escolhida: colunas `withdrawn_at`/`withdrawn_by` no próprio aceite**, preenchidas uma única vez por uma RPC, com trigger que impede qualquer outra mudança. Uma checagem simples (`withdrawn_at IS NULL`) em todo lugar; o aceite antigo fica como registro do período em que houve consentimento.
- **Agora é o momento barato:** nenhuma versão publicada = zero aceites em produção; mudar a constraint e as RPCs não afeta dado nem tela (PRs C e D ainda não existem).

Regras:
- Só `health_data` pode ser retirado. O termo das aulas é contrato: não se "retira"; quem sai pede o encerramento/exclusão da conta.
- Retirar = no mesmo instante, todos os aceites `health_data` ativos do aluno ganham `withdrawn_at`/`withdrawn_by` **e a ficha de saúde é apagada** (Loi 25: finalidade acabou → destruir). Fica só o registro do aceite e da retirada (datas, versão), sem conteúdo de saúde.
- Quem retira: o próprio aluno (Meu perfil, PR C) ou a Josi a pedido dele (ficha do aluno, PR D).
- Pode dar o consentimento de novo depois (nova linha de aceite da versão atual).
- **Ficha só existe com consentimento ativo, inclusive quando quem grava é a professora** (hoje a professora grava sem consentimento). Sem consentimento digital, a Josi registra o consentimento de saúde em papel (`register_paper_consent` já aceita qualquer versão) e aí preenche. Efeito colateral bom: antes da publicação da v1 não pode existir ficha nenhuma.

**O que os textos legais podem prometer:** retirar o consentimento de saúde a qualquer momento, em Meu perfil → "Saúde e termos" ou pedindo à Josi (email/telefone); a ficha é apagada do sistema na hora e das cópias de segurança automaticamente em até 90 dias (`retention-days: 90` em `backup.yml`); guardamos só o registro de que o consentimento foi dado e retirado (datas e versão); retirar não impede de continuar as aulas (a Josi só terá menos informação para adaptá-las); pode-se consentir de novo. **Não prometer:** retirada parcial (campo a campo), apagamento imediato dos backups, apagamento automático no fim do prazo de guarda (é a Josi quem apaga), retirada do termo das aulas.

---

## PR B — Retirada, travas e textos legais · revisor: sim · dois PRs (B1 agora, B2 depois da aprovação da Josi)
**Organização:** a aprovação da Josi não cabe numa sessão. **B1 (esta sessão):** migration de retirada e travas (roda já), testes SQL, rascunho dos textos marcado "RASCUNHO — pendente de aprovação da Josi"; o rascunho é só um `.md` em `docs/`, não aparece no site. **B2 (sessão nova, depois da aprovação por escrito):** Política de Privacidade no site + migration de publicação da v1 (roda só no lançamento). Assim os PRs C e D não esperam a Josi.

### B1

### 4a. [OPUS] Migration de retirada e travas (roda já, antes de começar o PR C)
- Arquivo: `supabase/migrations/20261128010000_consent_withdrawal_and_locks.sql` (BEGIN/COMMIT, idempotente, checagens iniciais: as 3 tabelas existem com o prefixo `josi-pilates:`).
- Fazer:
  - `consent_acceptances`: `withdrawn_at timestamptz`, `withdrawn_by uuid` (**sem FK**, como `updated_by`), `CHECK (withdrawn_by IS NULL OR withdrawn_at IS NOT NULL)`.
  - Trocar `consent_acceptances_student_version_key` por índice único parcial `consent_acceptances_active_key ON (student_id, consent_version_id) WHERE withdrawn_at IS NULL`.
  - **Trava em `consent_acceptances`** (BEFORE UPDATE, erro `consent_immutable`): só passa se nada mudou além de `withdrawn_at`/`withdrawn_by` (de NULL para valor, uma vez, e só se a versão é `health_data`) e de `recorded_by` indo para NULL. **Armadilha:** o `ON DELETE SET NULL` de `recorded_by` é um UPDATE; sem essa exceção, apagar um perfil de professora quebraria.
    ```sql
    IF (to_jsonb(NEW) - ARRAY['withdrawn_at','withdrawn_by','recorded_by'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['withdrawn_at','withdrawn_by','recorded_by'])
       OR (NEW.recorded_by IS DISTINCT FROM OLD.recorded_by AND NEW.recorded_by IS NOT NULL) ...
    ```
    Nada de trigger de DELETE (cascata do "apagar de vez").
  - **Trava em `consent_versions` (ressalva 1)**: BEFORE UPDATE, erro `consent_version_locked` se já existe aceite de `OLD.id`. Fica aqui (e não na migration de publicação) porque roda antes e vale também para a v2 no futuro.
  - Recriar as policies INSERT/UPDATE de `student_health_profiles`: `(is_staff() OR student_id = auth.uid())` **e** consentimento de saúde ativo **do aluno da linha**. **Armadilha:** qualificar a coluna, senão `student_id` na subconsulta vira `a.student_id`:
    ```sql
    EXISTS (SELECT 1 FROM public.consent_acceptances a
            JOIN public.consent_versions v ON v.id = a.consent_version_id
            WHERE a.student_id = student_health_profiles.student_id
              AND v.kind = 'health_data' AND a.withdrawn_at IS NULL)
    ```
  - `CREATE OR REPLACE` das 4 RPCs (mesmas assinaturas; repetir REVOKE/GRANT): `accept_consent` e `register_paper_consent` com `ON CONFLICT (student_id, consent_version_id) WHERE withdrawn_at IS NULL DO NOTHING` e a busca do id existente com `withdrawn_at IS NULL`; `my_pending_consents` e `staff_consent_overview` (`health_consent`) contando só aceites ativos.
  - RPC nova `withdraw_health_consent(p_student_id uuid DEFAULT NULL) RETURNS integer` (SECURITY DEFINER, `search_path = public`, só `authenticated`): `p_student_id` nulo ou igual ao chamador → o próprio aluno (`role = 'student'`); outro id → só `is_staff()` e o aluno existe (`consent_invalid_student`); senão `consent_not_allowed`. Marca os aceites `health_data` ativos, apaga a ficha, grava `audit_log` `consent.health_withdraw` (só ids e quantidade). Devolve quantos aceites marcou (0 não é erro; apaga a ficha mesmo assim).
  - `COMMENT` das tabelas atualizado (prefixo `josi-pilates:`) + bloco de reversão comentado no fim.
- Pronto quando: roda duas vezes sem erro num banco de teste e os scripts do passo 4b passam.

### 4b. [OPUS] Testes SQL e reversão
- Arquivos: `docs/testes/consentimento-retirada-teste.sql` (novo, mesmo padrão + ROLLBACK); `docs/testes/consentimento-teste.sql` (ajustar: a professora **não** grava ficha do B sem consentimento → espera 42501; registra consentimento de saúde em papel para o B e aí grava); `docs/testes/consentimento-retirada-reversao.sql` (novo: recusa se houver `withdrawn_at` preenchido, salvo `v_forcar`; tira RPC, triggers, índice e colunas, devolve o UNIQUE e manda rodar de novo a migration do PR A, que recria policies e RPCs antigas); `docs/testes/consentimento-reversao.sql` (também apagar `withdraw_health_consent` e as funções das travas).
- Cobrir: aluno retira → aceite marcado, ficha apagada, não grava mais ficha, `my_pending_consents` volta a listar `health_data`; consente de novo → nova linha, grava ficha; aluno não retira o de outro; professora retira pelo aluno; ninguém (nem `postgres`) altera outra coluna de aceite nem desfaz `withdrawn_at`; não dá para "retirar" `class_policies` por UPDATE; apagar perfil de professora com `recorded_by` funciona; apagar aluno leva aceites e ficha; UPDATE de versão aceita falha, de versão sem aceite passa; `staff_consent_overview` com retirada = `health_consent false`.
- Pronto quando: os dois scripts de teste terminam sem "FALHOU" (rodados depois da 4a).

### 4c. [OPUS] Rascunho dos textos para a Josi aprovar
- Arquivo: `docs/legal/termo-e-ficha-v1.md`, com "RASCUNHO — pendente de aprovação da Josi" no topo e uma linha "Aprovado por … em …" vazia.
- Conteúdo, pt/en/fr (FR primeiro, faz fé): **Termo das aulas** (seção "Textos legais"); **Consentimento de saúde** (o que, para quê, quem vê, onde fica, retirada exatamente como em "O que os textos legais podem prometer"; prazo **só por referência**: "pelo prazo descrito na Política de Privacidade", porque o texto aceito é imutável); **Política de Privacidade**, só os trechos novos/alterados (seção nova "Ficha de saúde e termo"; 2.1, 3, 5, 6, 7, 10, 13; responsável pela proteção dos dados: Josiane da Silveira Malamud, proprietária, com email).
- Ressalva 4: o aceite registra data/hora, versão, língua, nome digitado, IP e navegador "informados pela conexão, como registro técnico do aceite"; **nunca** chamar de prova de identidade.
- Prazo (item 7, ainda com a Josi): a Política escreve "enquanto você for aluno(a) e, depois que deixar o estúdio, pelo tempo exigido pelas obrigações legais e de seguro do estúdio, [N anos — confirmar com a Josi]; depois disso, a ficha e os registros são destruídos". Se no B2 ainda não houver resposta, sai sem o número entre colchetes e o item 7 continua aberto em `docs/PENDENCIAS.md`.
- Não prometer: backup criptografado (só depois do PR E), dados guardados no Canadá (só se a região do Supabase for `ca-central-1`; ver perguntas).
- Pronto quando: o arquivo existe com as 3 línguas e os colchetes `[… confirmar …]` listados no topo; `docs/PENDENCIAS.md` com "Josi: aprovar `docs/legal/termo-e-ficha-v1.md`" e "Rodar SQL 4a + testes 4b" em aberto. (Aprovação **não** é critério do B1.)

### B2 (sessão nova, só depois da aprovação por escrito da Josi; anotar data no arquivo e em `docs/PENDENCIAS.md`)

### 5. [OPUS] Política de Privacidade
- Arquivos: `src/locales/pt.json`, `en.json`, `fr.json` (`privacyPolicy.*` conforme o texto aprovado, `lastUpdatedDate`); `src/pages/PrivacyPolicy.jsx` se a seção nova precisar de bloco; `src/tests/privacyPolicy.test.js` (seção nova e responsável nas 3 línguas).
- Pronto quando: testes passam e o texto é idêntico ao aprovado.

### 6. [OPUS] Migration de publicação da v1 (entra no B2; **só roda no lançamento**)
- Arquivo: `supabase/migrations/AAAAMMDD000000_publish_consent_v1.sql` — só `INSERT` de `class_policies` v1 e `health_data` v1 com os textos aprovados (`ON CONFLICT (kind, version) DO NOTHING`); checagem inicial de que a trava da 4a existe. Reversão: `DELETE` das duas versões só se ninguém aceitou (senão publicar v2).
- Pronto quando: os textos no SQL são idênticos aos aprovados (`diff` depois de extrair).
- Ordem do B2: merge **depois** dos merges de C e D (a Política cita "Meu perfil → Saúde e termos") e **antes** do SQL de publicação.

---

## PR C — Aluno (assistente, bloqueio, Meu perfil) · revisor: sim · depende do SQL do PR A **e do SQL 4a**

### 7. [OPUS] Serviço e regras puras
- Arquivos: `src/lib/consents.js` (novo) + `src/tests/consents.test.js`.
- Fazer: funções puras `validateTypedName`, `healthAlerts(profile)` (chips: gestante N sem. em data, cardíaco/hipertensão, cirurgias preenchidas), `formatAcceptance` (data/hora em `America/Montreal`); chamadas `fetchMyPendingConsents`, `fetchCurrentVersions`, `acceptConsent`, `fetchMyAcceptances` (inclui `withdrawn_at`), `withdrawHealthConsent()` (RPC `withdraw_health_consent` sem argumento), `fetchHealthProfile(studentId)`, `saveHealthProfile(studentId, data)` (campos vazios → `null`; `pregnancy_reported_on` = hoje em Montréal quando `pregnant`/`pregnancy_weeks` mudar), tradução dos códigos de erro `consent_*`.
- Pronto quando: testes das funções puras passam.

### 8. [OPUS] Bloqueio das rotas do aluno
- Arquivos: `src/hooks/useAuth.jsx` (para aluno: carregar `my_pending_consents` depois do perfil; expor `pendingConsents`, `consentsLoading`, `refreshConsents`), `src/components/ProtectedRoute.jsx` (prop `requireConsent`: aluno com `class_policies` pendente → `Navigate` para `/student/consent`; spinner enquanto carrega; erro de rede **não** bloqueia), `src/App.jsx` (rota `/student/consent` com `requireRole="student" requireCompleteProfile` e **sem** `requireConsent`; demais rotas do aluno com `requireConsent`).
- Pronto quando: sem versão publicada nada muda; com versão publicada e sem aceite, qualquer rota do aluno leva ao assistente; professora nunca é bloqueada.

### 9. [SONNET] Assistente `/student/consent` e componentes
- Arquivos: `src/pages/StudentConsent.jsx` (novo), `src/components/ConsentDocument.jsx` (renderiza título e corpo como **texto puro** com `whitespace-pre-line`, nunca HTML; abas PT/EN/FR, começa na língua do aluno), `src/components/HealthProfileForm.jsx` (como `InsuranceFields`: `studentId`, modo aluno/professora; caixas das 6 condições, campos de texto, sono/dieta em 4 opções, gestante + semanas).
- Fazer: passo 1 = `ConsentDocument` de `class_policies` + 2 caixas + nome digitado (com o nome do perfil ao lado) + "Aceito" (desabilitado até tudo marcado; um clique só) → `refreshConsents`; passo 2 = consentimento `health_data` (caixa) + `HealthProfileForm`; "Fazer depois" → painel. Se o passo 1 já está aceito, abre no 2. Erros traduzidos.
- Pronto quando: fluxo completo em pt/en/fr no celular sem rolagem lateral.

### 10. [SONNET] Meu perfil e faixa no painel
- Arquivos: `src/pages/StudentProfile.jsx` (aba "Saúde e termos": `HealthProfileForm` se há consentimento de saúde **ativo**, senão botão para o passo 2; botão "Retirar consentimento" com confirmação que avisa que a ficha será apagada → `withdrawHealthConsent` → recarrega; depois disso mostra "Consentimento retirado em …" + "Autorizar de novo"; lista dos aceites com versão, data/hora, método, retirada e "Ver texto"), `src/pages/StudentDashboard.jsx` (faixa "Complete sua ficha de saúde" quando não há ficha **e** o aluno não retirou o consentimento).
- Pronto quando: aluno edita a ficha, vê o texto exato que aceitou, retira (ficha some, faixa não aparece) e autoriza de novo.

### 11. [SONNET] Textos da interface
- Arquivos: `src/locales/*.json` (chaves `consent.*` e `healthProfile.*`, tabela abaixo + o resto nas 3 línguas) e teste de chaves nas 3 línguas (como `onlineLocales.test.js`).

---

## PR D — Professora · revisor: sim · depende do SQL do PR A **e do SQL 4a**

### 12. [OPUS] Card "Termo e ficha de saúde" na ficha do aluno
- Arquivos: `src/components/StudentConsentCard.jsx` (novo), `src/pages/StudentSummary.jsx` (abaixo do card de seguro).
- Fazer: status do termo atual (Aceito / Versão antiga / Pendente), histórico de aceites (versão, data/hora em Montréal, digital/papel, nome digitado, responsável, IP só no detalhe), "Registrar em papel" (diálogo: tipo = termo das aulas ou consentimento de saúde, versão = a atual desse tipo, data da assinatura, nome de quem assinou, responsável opcional → `register_paper_consent`), status do consentimento de saúde (ativo desde … / retirado em … / não dado), "Registrar retirada a pedido do aluno" (confirmação: a ficha será apagada → `withdraw_health_consent(p_student_id)`), chips de `healthAlerts`, `HealthProfileForm` em modo professora (ver por padrão, "Editar", "atualizada pelo aluno/pela Josi em …"; **criar/editar só com consentimento ativo** — a RLS recusa sem ele; sem consentimento, mostrar "Sem consentimento de saúde" e o atalho para registrar em papel), "Apagar ficha de saúde" com confirmação digitada.
- Pronto quando: a Josi vê e registra tudo sem SQL.

### 13. [SONNET] Badge na lista e impressão
- Arquivos: `src/pages/TeacherStudents.jsx` (uma chamada a `staff_consent_overview()` junto com o carregamento; badge "Termo pendente" quando `policies_status <> 'current'`, sem alterar os outros badges), `src/components/StudentConsentCard.jsx` (botão "Imprimir": `window.print()` com CSS `@media print` que mostra só o card).
- Pronto quando: sem versão publicada nenhum badge aparece; a impressão sai legível em A4/Letter.

---

## PR E (opcional, se o dono aprovar a decisão 8) — Backup criptografado · [OPUS] · revisor: sim
- `.github/workflows/backup.yml`: criptografar o zip com senha em segredo novo do GitHub (`BACKUP_PASSPHRASE`, criado pelo dono) antes do upload; documentar em `docs/` como abrir. Fazer **antes do lançamento**.

## Lançamento (depois do SQL 4a e dos merges de A, B1, C, D e B2)
1. Rodar o SQL de publicação da v1 (passo 6). 2. Enviar "Aviso geral" a todos: "entre no portal e aceite o novo termo; preencha sua ficha de saúde". 3. Acompanhar os badges "Termo pendente"; papel só para exceções.

## Textos (pt / en / fr) — interface (os legais ficam no passo 4c)
| chave | pt | en | fr |
|---|---|---|---|
| consent.title | Termo das aulas | Class agreement | Entente des cours |
| consent.checkRisks | Li e aceito os riscos e responsabilidades | I have read and accept the risks and responsibilities | J'ai lu et j'accepte les risques et responsabilités |
| consent.checkCancellation | Li e aceito a política de cancelamento | I have read and accept the cancellation policy | J'ai lu et j'accepte la politique d'annulation |
| consent.typedName | Digite seu nome completo | Type your full name | Écrivez votre nom complet |
| consent.accept | Aceito | I accept | J'accepte |
| consent.healthConsent | Autorizo o estúdio a guardar minhas informações de saúde para adaptar as aulas | I allow the studio to keep my health information to adapt my classes | J'autorise le studio à conserver mes renseignements de santé pour adapter mes cours |
| consent.later | Fazer depois | Do it later | Plus tard |
| consent.pendingBadge | Termo pendente | Agreement pending | Entente en attente |
| healthProfile.title | Ficha de saúde | Health profile | Fiche santé |
| healthProfile.banner | Complete sua ficha de saúde | Complete your health profile | Complétez votre fiche santé |
| consent.withdraw | Retirar consentimento | Withdraw consent | Retirer mon consentement |
| consent.withdrawConfirm | Sua ficha de saúde será apagada. Você continua podendo fazer as aulas. | Your health profile will be deleted. You can keep taking classes. | Votre fiche santé sera supprimée. Vous pouvez continuer vos cours. |
| consent.withdrawnOn | Consentimento retirado em {{date}} | Consent withdrawn on {{date}} | Consentement retiré le {{date}} |
| consent.noHealthConsent | Sem consentimento de saúde | No health consent | Aucun consentement santé |

## Banco de dados
- SQL: sim — `20261128000000_create_consents_and_health_profiles.sql` (PR A, rodado) + `20261128010000_consent_withdrawal_and_locks.sql` (B1, roda já) + `…_publish_consent_v1.sql` (B2, roda no lançamento). Reversões: bloco no fim das migrations, `docs/testes/consentimento-retirada-reversao.sql` e `docs/testes/consentimento-reversao.sql`.
- Ordem: **PR A: SQL antes do merge** (o backup lista as tabelas novas). **B1: tanto faz** (nada no site usa a retirada ainda; sem aceites em produção), mas o SQL 4a roda **antes de começar o PR C**. **PRs C e D: depois dos SQLs do A e da 4a** (chamam as RPCs; o PR D conta com a RLS nova). **B2: merge depois de C e D, antes do SQL de publicação.** **Publicação da v1: depois do merge de C e D** (antes disso ninguém fica bloqueado e a Josi não vê o status).
- Edge Function a publicar: nenhuma.

## Testes
- Automáticos (cada PR): `npm run lint`, `npm test`, `npm run build`; novos: `consents.test.js`, chaves `consent.*`/`healthProfile.*` nas 3 línguas, `privacyPolicy.test.js` atualizado; SQL `docs/testes/consentimento-teste.sql` e `docs/testes/consentimento-retirada-teste.sql`.
- Manual (aluno de teste, 3 línguas, celular), depois de publicar a v1 num momento combinado (ou publicar e testar logo, já que o lançamento é esse mesmo SQL): login → assistente abre; "Aceito" só libera com 2 caixas + nome; aceitar → painel abre; recarregar → não volta; passo 2 sem a caixa de saúde não grava; ficha salva e aparece para a Josi; Meu perfil mostra o texto aceito; retirar → ficha some e a Josi vê "retirado em"; autorizar de novo; professora: status, histórico, registrar papel, chips, editar, apagar, imprimir, badge some depois do aceite; aluno A não vê dados do aluno B (console). Regressão: professora não é bloqueada; telas do aluno e cadastro iguais.

## Riscos e como voltar atrás
- **Bloqueio errado prende todos os alunos fora do painel:** o bloqueio só existe com versão publicada → reverter = `DELETE` da v1 (se ninguém aceitou) ou Revert do PR C. Erro ao carregar pendências não bloqueia.
- **Trava de aceites quebrando outra coisa:** o UPDATE do `ON DELETE SET NULL` de `recorded_by` é liberado de propósito e testado na 4b; se algo falhar, `consentimento-retirada-reversao.sql` (recusa se já houver retirada).
- **Dado de saúde vazando:** RLS + REVOKE testados no passo 2; texto sempre como texto puro; nada de saúde no `audit_log` nem em logs.
- **Excluir permanentemente quebrando:** FKs com `ON DELETE CASCADE` e sem trigger de DELETE (testado no passo 2).
- **Texto errado publicado:** versões são imutáveis; corrigir = publicar v2 (todos aceitam de novo). Por isso a aprovação da Josi vem antes.
- Reverter código: GitHub → PR → Revert, ou Vercel → deploy anterior → Promote to Production. Banco: `docs/testes/consentimento-reversao.sql` (apaga as 3 tabelas e RPCs: exportar antes se já houver dados).

## Decisões do dono (responder antes do PR A)
1. **Bloquear o painel até aceitar o termo?** Rec.: sim para o termo; a ficha de saúde não bloqueia (só a faixa).
2. **Assinatura:** caixas + nome digitado (rec.) ou também desenho com o dedo?
3. **Guardar IP e navegador no aceite?** Rec.: sim, citado na Política de Privacidade.
4. **Ficha obrigatória?** Rec.: todas as perguntas opcionais; contato de emergência pedido com destaque, mas opcional. A professora também pode editar (rec.: sim).
5. **Alunos que assinaram em papel:** todos aceitam online no lançamento (rec.); papel registrado só para quem não usa o app. Os papéis antigos: guardar até o fim do prazo da decisão 7.
6. **Há alunos menores de idade?** Rec.: v1 não aceita menor pelo app; a Josi colhe a assinatura do responsável em papel e registra.
7. **Prazo de guarda** da ficha e do termo depois que o aluno sai: a Josi confirma com a associação/seguradora (sugestão: enquanto ativo + o prazo exigido).
8. **Criptografar o backup diário (PR E)** antes de guardar dados de saúde no GitHub? Rec.: sim.
9. **Conteúdo do texto:** marca "Josi Pilates" (e não Point d'Équilibre), endereço atual, "cancelamento tardio = perda do crédito" como nas Regras, e cláusula de isenção reescrita como reconhecimento de riscos. A Josi confirma e valida com a seguradora.

**Respostas do dono (2026-11-28):** recomendações aceitas em 1, 2, 3, 4, 5, 8 e 9. **6: não há alunos menores de idade**, então a v1 não trata responsável (se aparecer um menor, termo em papel registrado pela Josi). **9: endereço continua 10145 Av Hamel.** **7:** fica com a Josi (associação/seguradora); não bloqueia os PRs A, C e D, só entra na Política de Privacidade (PR B).

## Ressalvas da revisão do PR A (2026-11-28, revisor: aprovado com ressalvas leves)
1. **Trava em `consent_versions` (decidido: B1, passo 4a, para valer antes e também para a v2):** criar, antes do primeiro aceite, um trigger BEFORE UPDATE em `consent_versions` que dá erro se a versão já tem aceite (hoje só a API é bloqueada; pelo SQL Editor dá para alterar um texto aceito).
2. **Ordem do PR E:** o backup criptografado (PR E) entra **antes do merge do PR D** (a professora já pode criar fichas de saúde no PR D, mesmo sem a v1), não só antes do lançamento.
3. **Retirada do consentimento de saúde (Loi 25) — decidida em 2026-11-28:** ver "Decisão: retirada do consentimento de saúde" antes do PR B (colunas `withdrawn_at`/`withdrawn_by`, RPC `withdraw_health_consent`, ficha apagada na retirada; B1, passo 4a).
4. **`x-forwarded-for`:** é registro, não prova forte; a Política de Privacidade (PR B) não deve tratá-lo como prova. (Coberto no passo 4c.)
5. Só registro: aluno na lixeira (`deleted_at`) ainda lê e grava a própria ficha pela RLS, igual às outras tabelas.
6. Códigos de erro novos para o passo 7 traduzir: `consent_not_allowed`, `consent_invalid_language`, `consent_version_not_found`, `consent_version_outdated`, `consent_invalid_name`, `consent_invalid_student`, `consent_invalid_date`, `consent_already_accepted`.
