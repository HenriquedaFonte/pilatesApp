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
5. **Permissões (RLS):** ficha e aceites: o próprio aluno lê os seus; a professora (`is_staff()`) lê todos. Aceite: ninguém edita nem apaga pela API. Ficha: aluno grava a própria (só se tiver dado o consentimento de saúde); professora grava e pode apagar (pedido do aluno). `anon` nada.
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

### 1. [OPUS] Migration das tabelas, RLS e RPCs
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

### 2. [OPUS] Testes SQL e reversão
- Arquivos: `docs/testes/consentimento-teste.sql` (padrão `set_config('request.jwt.claims', …)` + ROLLBACK, igual a `online-modalidade-teste.sql`) e `docs/testes/consentimento-reversao.sql`.
- Cobrir: aluno não lê aceite/ficha de outro; aluno não faz INSERT direto em `consent_acceptances`; não aceita versão antiga; aceite duplo devolve o mesmo id; aluno sem consentimento de saúde não grava ficha; com, grava só a própria e não troca `student_id`; aluno não apaga ficha; professora lê tudo, registra papel, apaga ficha; `anon` não lê nada; `staff_consent_overview` recusa aluno; `profiles` apagado leva aceites e ficha junto.
- Pronto quando: o script termina sem "FALHOU".

### 3. [SONNET] Backup
- Arquivo: `scripts/backup.js` — acrescentar `consent_versions`, `consent_acceptances`, `student_health_profiles` em `TABLES`.
- Pronto quando: `node --check scripts/backup.js` passa. (Criptografia do backup: PR E, se o dono aprovar.)

---

## PR B — Textos legais · revisor: sim · pode correr junto com o PR A

### 4. [OPUS] Rascunho dos textos para a Josi aprovar
- Arquivo: `docs/legal/termo-e-ficha-v1.md` — Termo das aulas e Consentimento de saúde em pt/en/fr (seções "Textos legais" e "Loi 25" acima), mais o texto novo da Política de Privacidade.
- Pronto quando: a Josi aprovou por escrito as 3 línguas (anotar a data no arquivo e em `docs/PENDENCIAS.md`).

### 5. [OPUS] Política de Privacidade
- Arquivos: `src/locales/pt.json`, `en.json`, `fr.json` (`privacyPolicy.*`: seção nova "Ficha de saúde e termo", ajustes em 2.1/3/6/7, responsável pela proteção dos dados com contato, `lastUpdatedDate`); `src/pages/PrivacyPolicy.jsx` se a seção nova precisar de bloco; `src/tests/privacyPolicy.test.js` (seção nova nas 3 línguas).
- Pronto quando: os testes passam e o texto é o aprovado no passo 4.

### 6. [OPUS] Migration de publicação da versão 1 (o arquivo entra no PR B; **só roda no lançamento**, depois do merge dos PRs C e D)
- Arquivo: `supabase/migrations/AAAAMMDD000000_publish_consent_v1.sql` — `INSERT` de `class_policies` v1 e `health_data` v1 com os textos aprovados (`ON CONFLICT (kind, version) DO NOTHING`). Reversão: `DELETE` dessas duas versões **só se ninguém aceitou ainda** (senão a FK impede; nesse caso publicar v2).
- Pronto quando: os textos no SQL são idênticos aos do passo 4 (conferir com `diff` depois de extrair).

---

## PR C — Aluno (assistente, bloqueio, Meu perfil) · revisor: sim · depende do SQL do PR A

### 7. [OPUS] Serviço e regras puras
- Arquivos: `src/lib/consents.js` (novo) + `src/tests/consents.test.js`.
- Fazer: funções puras `validateTypedName`, `healthAlerts(profile)` (chips: gestante N sem. em data, cardíaco/hipertensão, cirurgias preenchidas), `formatAcceptance` (data/hora em `America/Montreal`); chamadas `fetchMyPendingConsents`, `fetchCurrentVersions`, `acceptConsent`, `fetchMyAcceptances`, `fetchHealthProfile(studentId)`, `saveHealthProfile(studentId, data)` (campos vazios → `null`; `pregnancy_reported_on` = hoje em Montréal quando `pregnant`/`pregnancy_weeks` mudar), tradução dos códigos de erro `consent_*`.
- Pronto quando: testes das funções puras passam.

### 8. [OPUS] Bloqueio das rotas do aluno
- Arquivos: `src/hooks/useAuth.jsx` (para aluno: carregar `my_pending_consents` depois do perfil; expor `pendingConsents`, `consentsLoading`, `refreshConsents`), `src/components/ProtectedRoute.jsx` (prop `requireConsent`: aluno com `class_policies` pendente → `Navigate` para `/student/consent`; spinner enquanto carrega; erro de rede **não** bloqueia), `src/App.jsx` (rota `/student/consent` com `requireRole="student" requireCompleteProfile` e **sem** `requireConsent`; demais rotas do aluno com `requireConsent`).
- Pronto quando: sem versão publicada nada muda; com versão publicada e sem aceite, qualquer rota do aluno leva ao assistente; professora nunca é bloqueada.

### 9. [SONNET] Assistente `/student/consent` e componentes
- Arquivos: `src/pages/StudentConsent.jsx` (novo), `src/components/ConsentDocument.jsx` (renderiza título e corpo como **texto puro** com `whitespace-pre-line`, nunca HTML; abas PT/EN/FR, começa na língua do aluno), `src/components/HealthProfileForm.jsx` (como `InsuranceFields`: `studentId`, modo aluno/professora; caixas das 6 condições, campos de texto, sono/dieta em 4 opções, gestante + semanas).
- Fazer: passo 1 = `ConsentDocument` de `class_policies` + 2 caixas + nome digitado (com o nome do perfil ao lado) + "Aceito" (desabilitado até tudo marcado; um clique só) → `refreshConsents`; passo 2 = consentimento `health_data` (caixa) + `HealthProfileForm`; "Fazer depois" → painel. Se o passo 1 já está aceito, abre no 2. Erros traduzidos.
- Pronto quando: fluxo completo em pt/en/fr no celular sem rolagem lateral.

### 10. [SONNET] Meu perfil e faixa no painel
- Arquivos: `src/pages/StudentProfile.jsx` (aba "Saúde e termos": `HealthProfileForm` se já deu o consentimento de saúde, senão botão para o passo 2; lista dos aceites com versão, data/hora, método e "Ver texto"), `src/pages/StudentDashboard.jsx` (faixa "Complete sua ficha de saúde" quando não há ficha).
- Pronto quando: aluno edita a ficha e vê o texto exato que aceitou.

### 11. [SONNET] Textos da interface
- Arquivos: `src/locales/*.json` (chaves `consent.*` e `healthProfile.*`, tabela abaixo + o resto nas 3 línguas) e teste de chaves nas 3 línguas (como `onlineLocales.test.js`).

---

## PR D — Professora · revisor: sim · depende do SQL do PR A

### 12. [OPUS] Card "Termo e ficha de saúde" na ficha do aluno
- Arquivos: `src/components/StudentConsentCard.jsx` (novo), `src/pages/StudentSummary.jsx` (abaixo do card de seguro).
- Fazer: status do termo atual (Aceito / Versão antiga / Pendente), histórico de aceites (versão, data/hora em Montréal, digital/papel, nome digitado, responsável, IP só no detalhe), "Registrar termo em papel" (diálogo: versão = atual, data da assinatura, nome de quem assinou, responsável opcional → `register_paper_consent`), chips de `healthAlerts`, `HealthProfileForm` em modo professora (ver por padrão, "Editar", "atualizada pelo aluno/pela Josi em …"), "Apagar ficha de saúde" com confirmação digitada.
- Pronto quando: a Josi vê e registra tudo sem SQL.

### 13. [SONNET] Badge na lista e impressão
- Arquivos: `src/pages/TeacherStudents.jsx` (uma chamada a `staff_consent_overview()` junto com o carregamento; badge "Termo pendente" quando `policies_status <> 'current'`, sem alterar os outros badges), `src/components/StudentConsentCard.jsx` (botão "Imprimir": `window.print()` com CSS `@media print` que mostra só o card).
- Pronto quando: sem versão publicada nenhum badge aparece; a impressão sai legível em A4/Letter.

---

## PR E (opcional, se o dono aprovar a decisão 8) — Backup criptografado · [OPUS] · revisor: sim
- `.github/workflows/backup.yml`: criptografar o zip com senha em segredo novo do GitHub (`BACKUP_PASSPHRASE`, criado pelo dono) antes do upload; documentar em `docs/` como abrir. Fazer **antes do lançamento**.

## Lançamento (depois do merge de A, C e D; B aprovado)
1. Rodar o SQL de publicação da v1 (passo 6). 2. Enviar "Aviso geral" a todos: "entre no portal e aceite o novo termo; preencha sua ficha de saúde". 3. Acompanhar os badges "Termo pendente"; papel só para exceções.

## Textos (pt / en / fr) — interface (os legais ficam no passo 4)
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

## Banco de dados
- SQL: sim — `20261128000000_create_consents_and_health_profiles.sql` (PR A) + `…_publish_consent_v1.sql` (PR B, roda no lançamento). Reversões: bloco no fim da migration e `docs/testes/consentimento-reversao.sql`.
- Ordem: **PR A: SQL antes do merge** (o backup lista as tabelas novas). **PRs C e D: depois do SQL do A** (chamam as RPCs). **Publicação da v1: depois do merge de C e D** (antes disso ninguém fica bloqueado e a Josi não vê o status).
- Edge Function a publicar: nenhuma.

## Testes
- Automáticos (cada PR): `npm run lint`, `npm test`, `npm run build`; novos: `consents.test.js`, chaves `consent.*`/`healthProfile.*` nas 3 línguas, `privacyPolicy.test.js` atualizado; SQL `docs/testes/consentimento-teste.sql`.
- Manual (aluno de teste, 3 línguas, celular), depois de publicar a v1 num momento combinado (ou publicar e testar logo, já que o lançamento é esse mesmo SQL): login → assistente abre; "Aceito" só libera com 2 caixas + nome; aceitar → painel abre; recarregar → não volta; passo 2 sem a caixa de saúde não grava; ficha salva e aparece para a Josi; Meu perfil mostra o texto aceito; professora: status, histórico, registrar papel, chips, editar, apagar, imprimir, badge some depois do aceite; aluno A não vê dados do aluno B (console). Regressão: professora não é bloqueada; telas do aluno e cadastro iguais.

## Riscos e como voltar atrás
- **Bloqueio errado prende todos os alunos fora do painel:** o bloqueio só existe com versão publicada → reverter = `DELETE` da v1 (se ninguém aceitou) ou Revert do PR C. Erro ao carregar pendências não bloqueia.
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
