-- Migration: publicação da versão 1 do termo das aulas e do consentimento de saúde
-- Plano: docs/planos/2026-11-28-perfil-e-consentimento-digital.md (PR B2, passo 6)
-- Texto: docs/legal/termo-e-ficha-v1.md (aprovado em 28/11/2026), seções 1 e 2,
--        copiado sem nenhuma alteração (FR faz fé; PT e EN).
--
-- SÓ RODA NO LANÇAMENTO, depois do SQL do PR A (20261128000000), do SQL 4a
-- (20261128010000) e dos merges de A, B1, C, D e B2. Antes disso não rode:
-- assim que existir uma versão publicada, todo aluno passa a ser levado ao
-- assistente de aceite.
--
-- DEPENDE de: 20261128000000_create_consents_and_health_profiles.sql (tabelas)
-- e 20261128010000_consent_withdrawal_and_locks.sql (trava consent_version_locked
-- e retirada). Se faltar alguma, para logo no início e nada é aplicado.
--
-- Faz:
--   • INSERT em consent_versions de class_policies v1 e health_data v1, com
--     título e corpo em FR/PT/EN (texto puro, parágrafos separados por linha
--     em branco, sem HTML; a tela mostra com white-space: pre-line).
--   • ON CONFLICT (kind, version) DO NOTHING: rodar de novo não muda nada.
--   • Confere no fim que as duas versões 1 no banco têm exatamente este texto;
--     se já existia uma v1 com outro texto (por exemplo, de um teste esquecido),
--     para com erro e nada é aplicado.
--
-- Depois do primeiro aceite, a trava da 4a impede qualquer UPDATE da versão
-- (consent_version_locked). Corrigir texto = publicar versão 2 (todos aceitam
-- de novo).
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente. Não apaga dados.
--
-- TESTE (depois de rodar):
--   SELECT kind, version, title_fr, length(body_fr), length(body_pt), length(body_en), published_at
--     FROM public.consent_versions ORDER BY kind, version;
--   → 2 linhas: class_policies 1 e health_data 1.

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_tbl text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['consent_versions', 'consent_acceptances', 'student_health_profiles'] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL
       OR coalesce(obj_description(to_regclass('public.' || v_tbl), 'pg_class'), '') NOT LIKE 'josi-pilates:%' THEN
      RAISE EXCEPTION 'public.% não encontrada (ou não criada pela migration 20261128000000_create_consents_and_health_profiles.sql). Rode antes a migration do PR A. Nada foi aplicado.', v_tbl;
    END IF;
  END LOOP;

  -- Trava consent_version_locked da 4a (função + trigger em consent_versions).
  IF to_regprocedure('public.consent_versions_guard_update()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgrelid = 'public.consent_versions'::regclass
                      AND tgname = 'trg_consent_versions_guard_update'
                      AND NOT tgisinternal
                      AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'Trava consent_version_locked não encontrada (trigger trg_consent_versions_guard_update). Rode antes a migration 20261128010000_consent_withdrawal_and_locks.sql. Nada foi aplicado.';
  END IF;

  -- Retirada do consentimento de saúde (4a).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'consent_acceptances'
                   AND column_name = 'withdrawn_at') THEN
    RAISE EXCEPTION 'consent_acceptances.withdrawn_at não encontrada. Rode antes a migration 20261128010000_consent_withdrawal_and_locks.sql. Nada foi aplicado.';
  END IF;
END $$;

-- ─── 1. Textos aprovados (tabela temporária, some no COMMIT) ────────────────
CREATE TEMP TABLE _consent_v1 (
  kind     text    NOT NULL,
  version  integer NOT NULL,
  title_fr text    NOT NULL,
  title_pt text    NOT NULL,
  title_en text    NOT NULL,
  body_fr  text    NOT NULL,
  body_pt  text    NOT NULL,
  body_en  text    NOT NULL
) ON COMMIT DROP;

INSERT INTO _consent_v1 (kind, version, title_fr, title_pt, title_en, body_fr, body_pt, body_en) VALUES
  ('class_policies', 1,
   -- title_fr
   $josi_consent_v1$Entente des cours — Josi Pilates$josi_consent_v1$,
   -- title_pt
   $josi_consent_v1$Termo das aulas — Josi Pilates$josi_consent_v1$,
   -- title_en
   $josi_consent_v1$Class agreement — Josi Pilates$josi_consent_v1$,
   -- body_fr
   $josi_consent_v1$Josi Pilates — Josiane da Silveira Malamud, instructrice de Pilates
10145, avenue Hamel, Montréal (Québec)

Veuillez lire cette entente avant votre premier cours. Elle comporte deux parties : (A) risques et responsabilités et (B) politique d'annulation.

PARTIE A — RISQUES ET RESPONSABILITÉS

1. Risques. Je comprends que le Pilates est une activité physique qui comporte des risques, y compris des risques de blessure liés aux mouvements et à l'utilisation des appareils (par exemple le reformer), même lorsque les cours sont donnés avec soin. Je participe aux cours volontairement.

2. Avis médical. Josiane da Silveira Malamud recommande d'obtenir l'avis d'un professionnel de la santé avant de commencer toute activité physique, en particulier en cas de problème de santé, de blessure, de chirurgie récente ou de grossesse. Il m'appartient de demander cet avis.

3. Ma santé et les consignes. Je m'engage à informer Josi, avant les cours et chaque fois que ma situation change, de tout problème de santé, blessure, douleur, traitement, médicament ou grossesse qui peut influencer ma pratique et, si j'ai rempli ma fiche santé, à la garder à jour. Je m'engage aussi à suivre les consignes, à utiliser les appareils seulement de la façon indiquée, et à arrêter l'exercice et prévenir Josi si je ressens une douleur ou un malaise.

4. Responsabilité. Dans la mesure permise par la loi, j'assume les risques normaux de la pratique du Pilates. Je reconnais qu'une blessure peut survenir sans faute de Josi Pilates, notamment en raison de ces risques normaux, du non-respect des consignes ou de renseignements sur ma santé que je n'ai pas communiqués. Rien dans cette entente n'exclut ni ne limite la responsabilité de Josi Pilates pour un préjudice corporel ou moral, ni les droits que la loi me reconnaît.

PARTIE B — POLITIQUE D'ANNULATION

5. Pour annuler ou reporter un cours, je préviens Josi au moins 24 heures à l'avance.

6. Une annulation faite moins de 24 heures avant le cours, ou une absence sans avis, entraîne la perte du cours : le crédit du cours est utilisé.

7. Si Josi annule un cours, il est repris à une autre date, sans perte de crédit.

ACCEPTATION

8. En cochant les cases et en écrivant mon nom complet, je confirme avoir lu, compris et accepté cette entente. Sont enregistrés avec mon acceptation : la date et l'heure, la version et la langue du texte, le nom écrit et, comme registre technique de l'acceptation, l'adresse IP et le navigateur indiqués par la connexion.

9. Je peux consulter cette entente en tout temps dans « Mon profil ». Si le texte change, une nouvelle acceptation me sera demandée.

10. Cette entente est offerte en français, en portugais et en anglais. En cas de divergence, la version française prévaut.$josi_consent_v1$,
   -- body_pt
   $josi_consent_v1$Josi Pilates — Josiane da Silveira Malamud, instrutora de Pilates
10145, avenue Hamel, Montréal (Québec)

Leia este termo antes da sua primeira aula. Ele tem duas partes: (A) riscos e responsabilidades e (B) política de cancelamento.

PARTE A — RISCOS E RESPONSABILIDADES

1. Riscos. Entendo que o Pilates é uma atividade física que tem riscos, inclusive de lesão, ligados aos movimentos e ao uso dos aparelhos (por exemplo, o reformer), mesmo quando as aulas são dadas com cuidado. Participo das aulas por vontade própria.

2. Avaliação médica. Josiane da Silveira Malamud recomenda obter a avaliação de um profissional de saúde antes de começar qualquer atividade física, principalmente em caso de problema de saúde, lesão, cirurgia recente ou gravidez. Cabe a mim buscar essa avaliação.

3. Minha saúde e as orientações. Comprometo-me a informar a Josi, antes das aulas e sempre que minha situação mudar, sobre qualquer problema de saúde, lesão, dor, tratamento, medicamento ou gravidez que possa influenciar minha prática e, se eu tiver preenchido minha ficha de saúde, a mantê-la atualizada. Comprometo-me também a seguir as orientações, a usar os aparelhos só da forma indicada, e a parar o exercício e avisar a Josi se sentir dor ou mal-estar.

4. Responsabilidade. Na medida permitida pela lei, assumo os riscos normais da prática do Pilates. Reconheço que uma lesão pode acontecer sem culpa da Josi Pilates, principalmente por causa desses riscos normais, de orientações não seguidas ou de informações sobre minha saúde que eu não comuniquei. Nada neste termo exclui ou limita a responsabilidade da Josi Pilates por dano corporal ou moral, nem os direitos que a lei me garante.

PARTE B — POLÍTICA DE CANCELAMENTO

5. Para cancelar ou remarcar uma aula, aviso a Josi com pelo menos 24 horas de antecedência.

6. Cancelamento feito com menos de 24 horas de antecedência, ou falta sem aviso, significa a perda da aula: o crédito da aula é usado.

7. Se a Josi cancelar uma aula, ela é reposta em outra data, sem perda de crédito.

ACEITE

8. Ao marcar as caixas e digitar meu nome completo, confirmo que li, entendi e aceito este termo. Junto com o meu aceite ficam registrados: a data e a hora, a versão e a língua do texto, o nome digitado e, como registro técnico do aceite, o endereço IP e o navegador informados pela conexão.

9. Posso consultar este termo a qualquer momento em "Meu perfil". Se o texto mudar, um novo aceite será pedido.

10. Este termo é oferecido em francês, português e inglês. Em caso de divergência, a versão em francês prevalece.$josi_consent_v1$,
   -- body_en
   $josi_consent_v1$Josi Pilates — Josiane da Silveira Malamud, Pilates instructor
10145, avenue Hamel, Montréal (Québec)

Please read this agreement before your first class. It has two parts: (A) risks and responsibilities and (B) cancellation policy.

PART A — RISKS AND RESPONSIBILITIES

1. Risks. I understand that Pilates is a physical activity that involves risks, including the risk of injury related to the movements and to the use of the equipment (for example, the reformer), even when classes are taught with care. I take part in the classes voluntarily.

2. Medical advice. Josiane da Silveira Malamud recommends getting advice from a health professional before starting any physical activity, especially in case of a health condition, injury, recent surgery or pregnancy. It is my responsibility to seek this advice.

3. My health and the instructions. I agree to tell Josi, before classes and whenever my situation changes, about any health condition, injury, pain, treatment, medication or pregnancy that may affect my practice and, if I have filled in my health profile, to keep it up to date. I also agree to follow the instructions, to use the equipment only as shown, and to stop the exercise and tell Josi if I feel pain or discomfort.

4. Responsibility. To the extent permitted by law, I accept the normal risks of practising Pilates. I acknowledge that an injury may occur without any fault on the part of Josi Pilates, in particular because of these normal risks, instructions not followed, or health information I did not share. Nothing in this agreement excludes or limits Josi Pilates' liability for bodily or moral injury, or the rights the law grants me.

PART B — CANCELLATION POLICY

5. To cancel or reschedule a class, I let Josi know at least 24 hours in advance.

6. A cancellation made less than 24 hours before the class, or a no-show, means the class is lost: the class credit is used.

7. If Josi cancels a class, it is made up on another date, with no loss of credit.

ACCEPTANCE

8. By ticking the boxes and typing my full name, I confirm that I have read, understood and accepted this agreement. The following are recorded with my acceptance: the date and time, the version and language of the text, the typed name and, as a technical record of the acceptance, the IP address and browser reported by the connection.

9. I can view this agreement at any time in "My profile". If the text changes, I will be asked to accept it again.

10. This agreement is offered in French, Portuguese and English. In case of discrepancy, the French version prevails.$josi_consent_v1$),
  ('health_data', 1,
   -- title_fr
   $josi_consent_v1$Consentement — renseignements de santé$josi_consent_v1$,
   -- title_pt
   $josi_consent_v1$Consentimento — informações de saúde$josi_consent_v1$,
   -- title_en
   $josi_consent_v1$Consent — health information$josi_consent_v1$,
   -- body_fr
   $josi_consent_v1$1. Ce que nous conservons. Avec votre consentement, Josi Pilates conserve votre fiche santé : profession, personne à joindre en cas d'urgence, objectif principal, problèmes de santé (cœur ou hypertension, respiratoires, digestifs, dos/cou/épaule, hanches/genoux/pieds, maux de tête fréquents) et précisions, médicaments, traitement en cours, chirurgies, activités physiques, qualité du sommeil et de l'alimentation, et grossesse (nombre de semaines). Toutes les questions sont facultatives.

2. Pourquoi. Ces renseignements servent uniquement à adapter vos cours à votre santé, à votre sécurité pendant les cours et à joindre la personne indiquée en cas d'urgence.

3. Qui les voit. Seulement vous et Josi (Josiane da Silveira Malamud) et, pour la maintenance technique, la personne qui administre l'application. Ils ne sont ni vendus ni communiqués à d'autres personnes, sauf si la loi l'exige, et ils ne sont pas envoyés à votre assureur.

4. Où ils sont conservés. Dans la base de données de Josi Pilates, située au Canada (Montréal, Québec), à accès restreint. Les copies de sécurité peuvent être conservées hors du Canada; voir la Politique de confidentialité, section 10.

5. Votre choix. Ce consentement est facultatif et distinct de l'entente des cours. Le refuser ou le retirer ne vous empêche pas de suivre les cours. Tant qu'il est en vigueur, vous pouvez mettre votre fiche à jour dans « Mon profil ».

6. Retrait. Vous pouvez retirer ce consentement en tout temps : il suffit de le demander à Josi, par courriel ou en personne, et elle consigne le retrait. Après le retrait, votre fiche n'est plus utilisée ni modifiée pour les cours. Elle est toutefois conservée, en lecture seule, pour respecter les obligations d'assurance et les obligations légales du studio, pendant la durée décrite dans la Politique de confidentialité. Pendant cette période, seule Josi peut la consulter, uniquement pour ces obligations, et chaque consultation est enregistrée; vous pouvez toujours la consulter. À la fin de cette durée, Josi détruit la fiche, et elle est retirée des copies de sécurité dans les 90 jours suivants. Vous pouvez consentir de nouveau plus tard.

7. Vos droits. Pour accéder à vos renseignements, les faire corriger ou poser une question, communiquez avec la responsable de la protection des renseignements personnels indiquée dans la Politique de confidentialité.

8. Enregistrement. En cochant la case, vous donnez ce consentement. Sont enregistrés : la date et l'heure, la version et la langue du texte et, comme registre technique du consentement, l'adresse IP et le navigateur indiqués par la connexion.$josi_consent_v1$,
   -- body_pt
   $josi_consent_v1$1. O que guardamos. Com o seu consentimento, a Josi Pilates guarda a sua ficha de saúde: profissão, contato de emergência, objetivo principal, problemas de saúde (coração ou hipertensão, respiratórios, digestivos, costas/pescoço/ombro, quadris/joelhos/pés, dor de cabeça frequente) e detalhes, medicamentos, tratamento atual, cirurgias, atividades físicas, qualidade do sono e da alimentação, e gravidez (número de semanas). Todas as perguntas são opcionais.

2. Para quê. Essas informações servem só para adaptar as suas aulas à sua saúde, para a sua segurança durante as aulas e para avisar o seu contato de emergência, se preciso.

3. Quem vê. Só você e a Josi (Josiane da Silveira Malamud) e, para a manutenção técnica, quem administra o aplicativo. Elas não são vendidas nem passadas a outras pessoas, salvo quando a lei exigir, e não são enviadas ao seu seguro.

4. Onde ficam. Na base de dados da Josi Pilates, que fica no Canadá (Montréal, Québec), com acesso restrito. As cópias de segurança podem ficar fora do Canadá; ver a Política de Privacidade, seção 10.

5. A sua escolha. Este consentimento é opcional e separado do termo das aulas. Recusá-lo ou retirá-lo não impede você de fazer as aulas. Enquanto ele estiver valendo, você pode atualizar a sua ficha em "Meu perfil".

6. Retirada. Você pode retirar este consentimento a qualquer momento: basta pedir à Josi, por e-mail ou pessoalmente, e ela registra a retirada. Depois da retirada, a sua ficha não é mais usada nem alterada para as aulas. Ela fica, porém, guardada, somente para leitura, para cumprir as obrigações de seguro e as obrigações legais do estúdio, pelo prazo descrito na Política de Privacidade. Nesse período, só a Josi pode consultá-la, só para essas obrigações, e cada consulta fica registrada; você continua podendo vê-la. No fim desse prazo, a Josi destrói a ficha, e ela sai das cópias de segurança em até 90 dias. Você pode consentir de novo mais tarde.

7. Os seus direitos. Para ter acesso às suas informações, pedir correção ou tirar dúvidas, fale com a responsável pela proteção dos dados pessoais indicada na Política de Privacidade.

8. Registro. Ao marcar a caixa, você dá este consentimento. Ficam registrados: a data e a hora, a versão e a língua do texto e, como registro técnico do consentimento, o endereço IP e o navegador informados pela conexão.$josi_consent_v1$,
   -- body_en
   $josi_consent_v1$1. What we keep. With your consent, Josi Pilates keeps your health profile: occupation, emergency contact, main goal, health conditions (heart or high blood pressure, respiratory, digestive, back/neck/shoulder, hips/knees/feet, frequent headaches) and details, medications, current treatment, surgeries, physical activities, sleep and diet quality, and pregnancy (number of weeks). All questions are optional.

2. Why. This information is used only to adapt your classes to your health, for your safety during classes, and to contact your emergency contact if needed.

3. Who sees it. Only you and Josi (Josiane da Silveira Malamud) and, for technical maintenance, the person who administers the app. It is not sold or shared with anyone else, unless the law requires it, and it is not sent to your insurer.

4. Where it is kept. In the Josi Pilates database, located in Canada (Montréal, Québec), with restricted access. Backup copies may be kept outside Canada; see the Privacy Policy, section 10.

5. Your choice. This consent is optional and separate from the class agreement. Refusing or withdrawing it does not prevent you from taking classes. While it is in effect, you can update your profile in "My profile".

6. Withdrawal. You can withdraw this consent at any time: just ask Josi, by email or in person, and she records the withdrawal. After the withdrawal, your profile is no longer used or changed for classes. It is, however, kept read-only to meet the studio's insurance and legal obligations, for the period described in the Privacy Policy. During that period, only Josi can view it, only for those obligations, and each viewing is logged; you can still view it. At the end of that period, Josi destroys the profile, and it is removed from backup copies within 90 days. You can give your consent again later.

7. Your rights. To access your information, have it corrected or ask a question, contact the person in charge of the protection of personal information named in the Privacy Policy.

8. Record. By ticking the box, you give this consent. The following are recorded: the date and time, the version and language of the text and, as a technical record of the consent, the IP address and browser reported by the connection.$josi_consent_v1$);

-- ─── 2. Publicação ──────────────────────────────────────────────────────────
INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
SELECT kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr
FROM _consent_v1
ON CONFLICT (kind, version) DO NOTHING;

-- ─── 3. Conferência: a v1 no banco é exatamente o texto aprovado ────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM public.consent_versions cv
        JOIN _consent_v1 n ON n.kind = cv.kind AND n.version = cv.version
       WHERE cv.title_pt = n.title_pt AND cv.title_en = n.title_en AND cv.title_fr = n.title_fr
         AND cv.body_pt  = n.body_pt  AND cv.body_en  = n.body_en  AND cv.body_fr  = n.body_fr) <> 2 THEN
    RAISE EXCEPTION 'Já existe class_policies v1 ou health_data v1 com texto diferente do aprovado. Nada foi aplicado. Confira public.consent_versions antes de seguir.';
  END IF;
END $$;

COMMIT;

-- ─── REVERSÃO (não roda sozinha; copiar e rodar no SQL Editor só se preciso) ─
-- Só apaga as versões 1 se NINGUÉM aceitou (aceite tem FK para a versão, sem
-- cascata, então o DELETE falharia de qualquer jeito). Se já houver aceite,
-- não reverta: corrija publicando uma versão 2.
--
-- BEGIN;
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM public.consent_acceptances a
--                JOIN public.consent_versions v ON v.id = a.consent_version_id
--               WHERE v.version = 1 AND v.kind IN ('class_policies', 'health_data')) THEN
--     RAISE EXCEPTION 'Já há aceite da versão 1. Não reverter: publicar versão 2.';
--   END IF;
-- END $$;
-- DELETE FROM public.consent_versions
--  WHERE version = 1 AND kind IN ('class_policies', 'health_data');
-- COMMIT;
