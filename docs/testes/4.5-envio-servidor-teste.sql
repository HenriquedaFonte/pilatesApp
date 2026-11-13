-- Teste — Story 4.5 (envio pelo servidor: fila email_campaign_recipients)
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112090000_email_campaign_server_send.sql.
--
-- Não precisa editar nada: se <UUID_PROFESSORA> e <UUID_ALUNO> ficarem como
-- estão, o script escolhe sozinho a professora (role = 'teacher') e o primeiro
-- aluno (role = 'student', fora da lixeira, ordem do id). Para usar pessoas
-- específicas, trocar <UUID_PROFESSORA> e <UUID_ALUNO> (duas vezes cada) logo
-- depois do BEGIN.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem campanha, nem fila, nem linha em email_notifications). NENHUM email é
-- enviado (o envio de verdade é a Edge Function, que este script não chama).
-- Resultado:
--   • Sucesso → nenhum erro (o editor mostra só o último resultado; é normal).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.
--
-- O que confere:
--   0. catálogo: fila com RLS e só a policy de SELECT de staff; anon nada;
--      authenticated só lê; funções da Edge Function só para service_role;
--      email_campaign_finalize sem EXECUTE para a API; queue_email_campaign só
--      para authenticated.
--   1. professora: põe a campanha na fila; só o aluno entra (a própria
--      professora e um id inventado ficam de fora); total = 1; send_mode =
--      server; não põe na fila duas vezes; não usa as funções da Edge
--      Function; finish_email_campaign não encerra a fila no meio.
--   2. aluno: não põe na fila, não lê a fila, não pega lote.
--   3. anônimo: nada.
--   4. service_role (Edge Function): pega a vez (só uma por vez); lote só com
--      a vez certa; não pega de novo uma linha que está sendo enviada; pega de
--      novo uma linha parada (> 10 min) com outro claim_token; gravação com o
--      token velho é ignorada; 'retry' devolve para a fila sem histórico;
--      'sent' cria UMA linha em email_notifications com campaign_id e encerra
--      (done); gravar de novo não duplica.
--   5. falha: 'failed' grava o erro e encerra como failed.
--   6. professora não põe na fila campanha criada por outra pessoa.

BEGIN;

SELECT set_config('josi.professora',
         CASE WHEN '<UUID_PROFESSORA>' LIKE '<%'
              THEN (SELECT id::text FROM public.profiles WHERE role = 'teacher' ORDER BY id LIMIT 1)
              ELSE '<UUID_PROFESSORA>' END, true),
       set_config('josi.aluno',
         CASE WHEN '<UUID_ALUNO>' LIKE '<%'
              THEN (SELECT id::text FROM public.profiles
                    WHERE role = 'student' AND deleted_at IS NULL ORDER BY id LIMIT 1)
              ELSE '<UUID_ALUNO>' END, true);

-- Roda um comando como um papel da API e devolve o resultado (texto), 'ok'
-- (sem resultado) ou 'ERRO <SQLSTATE>'. Some no ROLLBACK.
CREATE FUNCTION pg_temp.como(p_papel text, p_uid uuid, p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'role', p_papel)::text, true);
    EXECUTE format('SET LOCAL ROLE %I', p_papel);
    EXECUTE p_sql INTO v;
    v := coalesce(v, 'ok');
  EXCEPTION WHEN OTHERS THEN
    v := 'ERRO ' || SQLSTATE;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN v;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 0. CATÁLOGO
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_pols text[];
  v_fn   text;
BEGIN
  IF coalesce(current_setting('josi.professora', true), '') = ''
     OR coalesce(current_setting('josi.aluno', true), '') = '' THEN
    RAISE EXCEPTION 'FALHOU: precisa de 1 professora e 1 aluno (fora da lixeira) em profiles';
  END IF;
  IF to_regclass('public.email_campaign_recipients') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: public.email_campaign_recipients não existe (a migration 20261112090000 rodou?)';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_campaign_recipients'::regclass) THEN
    RAISE EXCEPTION 'FALHOU: RLS desligada em email_campaign_recipients';
  END IF;
  SELECT array_agg(policyname::text ORDER BY policyname) INTO v_pols
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_campaign_recipients';
  IF v_pols IS DISTINCT FROM ARRAY['email_campaign_recipients_select_staff'] THEN
    RAISE EXCEPTION 'FALHOU: policies inesperadas em email_campaign_recipients: %', v_pols;
  END IF;
  IF has_table_privilege('anon', 'public.email_campaign_recipients', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') THEN
    RAISE EXCEPTION 'FALHOU: anon tem privilégio na fila';
  END IF;
  IF has_table_privilege('authenticated', 'public.email_campaign_recipients', 'INSERT, UPDATE, DELETE, TRUNCATE')
     OR has_any_column_privilege('authenticated', 'public.email_campaign_recipients', 'INSERT, UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.email_campaign_recipients', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: authenticated deveria só ler a fila';
  END IF;
  IF has_column_privilege('authenticated', 'public.email_campaigns', 'send_mode', 'INSERT')
     OR has_column_privilege('authenticated', 'public.email_campaigns', 'worker_token', 'INSERT')
     OR has_any_column_privilege('authenticated', 'public.email_campaigns', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated grava send_mode/worker_token ou faz UPDATE em email_campaigns';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.email_campaign_acquire_worker(uuid,integer)',
    'public.email_campaign_release_worker(uuid,uuid)',
    'public.email_campaign_claim(uuid,uuid,integer,integer)',
    'public.email_campaign_record(uuid,uuid,uuid,text,text,text,text,text)',
    'public.email_campaign_finish_if_done(uuid)'
  ] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION 'FALHOU: % não existe', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: EXECUTE de % deveria ser só service_role', v_fn;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.email_campaign_finalize(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.email_campaign_finalize(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.email_campaign_finalize(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: a API executa email_campaign_finalize';
  END IF;
  IF has_function_privilege('anon', 'public.queue_email_campaign(uuid,uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.queue_email_campaign(uuid,uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: EXECUTE de queue_email_campaign errado';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PROFESSORA
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  c_prof  constant uuid := current_setting('josi.professora')::uuid;
  c_aluno constant uuid := current_setting('josi.aluno')::uuid;
  v       text;
  v_camp  uuid;
  r       record;
BEGIN
  v := pg_temp.como('authenticated', c_prof,
    $q$INSERT INTO public.email_campaigns (email_type, subject_pt, message_pt, recipient_filter, total)
       VALUES ('custom', 'TESTE 4.5 (rollback)', 'Mensagem de teste', '{"group":"selected"}', 3)
       RETURNING id::text$q$);
  IF v LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: professora não criou campanha (%)', v;
  END IF;
  v_camp := v::uuid;
  PERFORM set_config('josi.campanha', v_camp::text, true);

  IF (SELECT send_mode FROM public.email_campaigns WHERE id = v_camp) <> 'browser' THEN
    RAISE EXCEPTION 'FALHOU: campanha nova deveria começar com send_mode = browser';
  END IF;

  -- Fila: aluno + a própria professora + id inventado + aluno repetido → só 1 entra
  v := pg_temp.como('authenticated', c_prof, format(
    'SELECT public.queue_email_campaign(%L::uuid, ARRAY[%L, %L, %L, %L]::uuid[])::text',
    v_camp, c_aluno, c_prof, gen_random_uuid(), c_aluno));
  IF v <> '1' THEN
    RAISE EXCEPTION 'FALHOU: queue_email_campaign deveria pôr só o aluno na fila (deu %)', v;
  END IF;
  SELECT total, send_mode, status INTO r FROM public.email_campaigns WHERE id = v_camp;
  IF r.total <> 1 OR r.send_mode <> 'server' OR r.status <> 'sending' THEN
    RAISE EXCEPTION 'FALHOU: depois da fila, total/send_mode/status errados (% / % / %)', r.total, r.send_mode, r.status;
  END IF;
  IF (SELECT count(*) FROM public.email_campaign_recipients WHERE campaign_id = v_camp AND student_id = c_aluno AND status = 'pending') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: aluno não ficou pendente na fila';
  END IF;

  -- Não põe na fila de novo
  v := pg_temp.como('authenticated', c_prof, format(
    'SELECT public.queue_email_campaign(%L::uuid, ARRAY[%L]::uuid[])::text', v_camp, c_aluno));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: professora pôs a mesma campanha na fila duas vezes';
  END IF;

  -- Lê a fila
  v := pg_temp.como('authenticated', c_prof, format(
    'SELECT count(*)::text FROM public.email_campaign_recipients WHERE campaign_id = %L', v_camp));
  IF v <> '1' THEN
    RAISE EXCEPTION 'FALHOU: professora não lê a fila (%)', v;
  END IF;

  -- Não grava na fila nem usa as funções da Edge Function
  v := pg_temp.como('authenticated', c_prof, format(
    'UPDATE public.email_campaign_recipients SET status = %L WHERE campaign_id = %L', 'sent', v_camp));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: professora alterou a fila direto';
  END IF;
  v := pg_temp.como('authenticated', c_prof, format(
    'SELECT public.email_campaign_acquire_worker(%L::uuid, 60)::text', v_camp));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: professora chamou email_campaign_acquire_worker';
  END IF;
  v := pg_temp.como('authenticated', c_prof, format(
    'SELECT count(*)::text FROM public.email_campaign_claim(%L::uuid, gen_random_uuid(), 10)', v_camp));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: professora chamou email_campaign_claim';
  END IF;

  -- finish_email_campaign (4.4) não encerra a fila no meio
  v := pg_temp.como('authenticated', c_prof, format('SELECT public.finish_email_campaign(%L::uuid)::text', v_camp));
  IF v LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: finish_email_campaign deu erro (%)', v;
  END IF;
  IF (SELECT status FROM public.email_campaigns WHERE id = v_camp) <> 'sending' THEN
    RAISE EXCEPTION 'FALHOU: finish_email_campaign encerrou um envio pelo servidor com fila';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ALUNO e 3. ANÔNIMO
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  c_aluno constant uuid := current_setting('josi.aluno')::uuid;
  c_camp  constant uuid := current_setting('josi.campanha')::uuid;
  v       text;
BEGIN
  v := pg_temp.como('authenticated', c_aluno, format(
    'SELECT public.queue_email_campaign(%L::uuid, ARRAY[%L]::uuid[])::text', c_camp, c_aluno));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou queue_email_campaign';
  END IF;
  v := pg_temp.como('authenticated', c_aluno, 'SELECT count(*)::text FROM public.email_campaign_recipients');
  IF v <> '0' THEN
    RAISE EXCEPTION 'FALHOU: aluno lê a fila (%)', v;
  END IF;
  v := pg_temp.como('authenticated', c_aluno, format(
    'SELECT count(*)::text FROM public.email_campaign_claim(%L::uuid, gen_random_uuid(), 10)', c_camp));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou email_campaign_claim';
  END IF;

  v := pg_temp.como('anon', NULL, 'SELECT count(*)::text FROM public.email_campaign_recipients');
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: anônimo lê a fila';
  END IF;
  v := pg_temp.como('anon', NULL, format(
    'SELECT public.queue_email_campaign(%L::uuid, ARRAY[%L]::uuid[])::text', c_camp, c_aluno));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: anônimo chamou queue_email_campaign';
  END IF;
  v := pg_temp.como('anon', NULL, format(
    'SELECT public.email_campaign_record(%L::uuid, %L::uuid, gen_random_uuid(), %L)', c_camp, c_aluno, 'sent'));
  IF v NOT LIKE 'ERRO%' THEN
    RAISE EXCEPTION 'FALHOU: anônimo chamou email_campaign_record';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. SERVICE_ROLE (Edge Function send-campaign)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  c_aluno  constant uuid := current_setting('josi.aluno')::uuid;
  c_camp   constant uuid := current_setting('josi.campanha')::uuid;
  v        text;
  v_token  uuid;
  v_claim1 uuid;
  v_claim2 uuid;
  r        record;
BEGIN
  -- A vez: só uma por campanha
  v := pg_temp.como('service_role', NULL, format(
    'SELECT public.email_campaign_acquire_worker(%L::uuid, 60)::text', c_camp));
  IF v LIKE 'ERRO%' OR v = 'ok' THEN
    RAISE EXCEPTION 'FALHOU: service_role não pegou a vez (%)', v;
  END IF;
  v_token := v::uuid;
  v := pg_temp.como('service_role', NULL, format(
    'SELECT coalesce(public.email_campaign_acquire_worker(%L::uuid, 60)::text, %L)', c_camp, 'nulo'));
  IF v <> 'nulo' THEN
    RAISE EXCEPTION 'FALHOU: duas chamadas pegaram a vez ao mesmo tempo (%)', v;
  END IF;

  -- Lote com a vez errada: nada
  v := pg_temp.como('service_role', NULL, format(
    'SELECT count(*)::text FROM public.email_campaign_claim(%L::uuid, gen_random_uuid(), 10)', c_camp));
  IF v <> '0' THEN
    RAISE EXCEPTION 'FALHOU: pegou lote sem a vez (%)', v;
  END IF;

  -- Lote com a vez certa: o aluno, com email e créditos
  v := pg_temp.como('service_role', NULL, format(
    $q$SELECT string_agg(student_id::text || '|' || claim_token::text || '|' || attempts::text || '|'
                         || coalesce(role, '') || '|' || deleted::text || '|' || (credits ? 'total')::text, ',')
       FROM public.email_campaign_claim(%L::uuid, %L::uuid, 10)$q$, c_camp, v_token));
  IF v IS NULL OR v = 'ok' OR v LIKE 'ERRO%' OR split_part(v, '|', 1) <> c_aluno::text
     OR split_part(v, '|', 3) <> '1' OR split_part(v, '|', 4) <> 'student'
     OR split_part(v, '|', 5) <> 'false' OR split_part(v, '|', 6) <> 'true' THEN
    RAISE EXCEPTION 'FALHOU: lote com a vez certa errado (%)', v;
  END IF;
  v_claim1 := split_part(v, '|', 2)::uuid;

  -- Outra chamada não pega a mesma linha (está "enviando", não parada)
  v := pg_temp.como('service_role', NULL, format(
    'SELECT count(*)::text FROM public.email_campaign_claim(%L::uuid, %L::uuid, 10)', c_camp, v_token));
  IF v <> '0' THEN
    RAISE EXCEPTION 'FALHOU: a mesma linha foi pega duas vezes (%)', v;
  END IF;

  -- Linha parada há 20 min: volta a ser pega, com outro token
  UPDATE public.email_campaign_recipients SET claimed_at = now() - interval '20 minutes'
   WHERE campaign_id = c_camp AND student_id = c_aluno;
  v := pg_temp.como('service_role', NULL, format(
    $q$SELECT string_agg(claim_token::text || '|' || attempts::text, ',')
       FROM public.email_campaign_claim(%L::uuid, %L::uuid, 10)$q$, c_camp, v_token));
  IF v IS NULL OR v = 'ok' OR v LIKE 'ERRO%' OR split_part(v, '|', 2) <> '2' THEN
    RAISE EXCEPTION 'FALHOU: linha parada não foi pega de novo (%)', v;
  END IF;
  v_claim2 := split_part(v, '|', 1)::uuid;
  IF v_claim2 = v_claim1 THEN
    RAISE EXCEPTION 'FALHOU: claim_token não mudou';
  END IF;

  -- Gravação com o token velho: ignorada
  v := pg_temp.como('service_role', NULL, format(
    'SELECT public.email_campaign_record(%L::uuid, %L::uuid, %L::uuid, %L, NULL, %L, %L, %L)',
    c_camp, c_aluno, v_claim1, 'sent', 'prov-velho', 'x@example.com', 'TESTE 4.5'));
  IF v <> 'ignored' THEN
    RAISE EXCEPTION 'FALHOU: gravação com token velho não foi ignorada (%)', v;
  END IF;

  -- retry: volta para a fila, sem linha no histórico
  v := pg_temp.como('service_role', NULL, format(
    'SELECT public.email_campaign_record(%L::uuid, %L::uuid, %L::uuid, %L)', c_camp, c_aluno, v_claim2, 'retry'));
  IF v <> 'released' THEN
    RAISE EXCEPTION 'FALHOU: retry não devolveu para a fila (%)', v;
  END IF;
  IF (SELECT status FROM public.email_campaign_recipients WHERE campaign_id = c_camp AND student_id = c_aluno) <> 'pending'
     OR EXISTS (SELECT 1 FROM public.email_notifications WHERE campaign_id = c_camp) THEN
    RAISE EXCEPTION 'FALHOU: retry deixou a linha fora da fila ou gravou histórico';
  END IF;

  -- Pega de novo e grava 'sent'
  v := pg_temp.como('service_role', NULL, format(
    $q$SELECT string_agg(claim_token::text || '|' || attempts::text, ',')
       FROM public.email_campaign_claim(%L::uuid, %L::uuid, 10)$q$, c_camp, v_token));
  IF v IS NULL OR v = 'ok' OR v LIKE 'ERRO%' OR split_part(v, '|', 2) <> '3' THEN
    RAISE EXCEPTION 'FALHOU: depois do retry a linha não voltou (%)', v;
  END IF;
  v_claim1 := split_part(v, '|', 1)::uuid;
  v := pg_temp.como('service_role', NULL, format(
    'SELECT public.email_campaign_record(%L::uuid, %L::uuid, %L::uuid, %L, NULL, %L, %L, %L)',
    c_camp, c_aluno, v_claim1, 'sent', 'prov-teste-45', 'x@example.com', 'TESTE 4.5'));
  IF v <> 'recorded' THEN
    RAISE EXCEPTION 'FALHOU: sent não foi gravado (%)', v;
  END IF;
  -- Gravar de novo: ignorado, sem duplicar
  v := pg_temp.como('service_role', NULL, format(
    'SELECT public.email_campaign_record(%L::uuid, %L::uuid, %L::uuid, %L, NULL, %L, %L, %L)',
    c_camp, c_aluno, v_claim1, 'sent', 'prov-teste-45', 'x@example.com', 'TESTE 4.5'));
  IF v <> 'ignored' THEN
    RAISE EXCEPTION 'FALHOU: segunda gravação não foi ignorada (%)', v;
  END IF;
  IF (SELECT count(*) FROM public.email_notifications WHERE campaign_id = c_camp) <> 1
     OR (SELECT count(*) FROM public.email_notifications WHERE campaign_id = c_camp AND status = 'sent' AND student_id = c_aluno) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: esperado exatamente 1 linha "sent" em email_notifications';
  END IF;
  SELECT status, sent, failed, total, worker_token INTO r FROM public.email_campaigns WHERE id = c_camp;
  IF r.status <> 'done' OR r.sent <> 1 OR r.failed <> 0 OR r.worker_token IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: campanha não terminou como done 1/0 (% %/% vez=%)', r.status, r.sent, r.failed, r.worker_token;
  END IF;
  IF (SELECT status FROM public.email_campaign_recipients WHERE campaign_id = c_camp AND student_id = c_aluno) <> 'sent' THEN
    RAISE EXCEPTION 'FALHOU: linha da fila não ficou sent';
  END IF;

  -- Campanha encerrada: não pega mais a vez
  v := pg_temp.como('service_role', NULL, format(
    'SELECT coalesce(public.email_campaign_acquire_worker(%L::uuid, 60)::text, %L)', c_camp, 'nulo'));
  IF v <> 'nulo' THEN
    RAISE EXCEPTION 'FALHOU: pegou a vez de uma campanha encerrada';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. FALHA e 6. CAMPANHA DE OUTRA PESSOA
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  c_prof  constant uuid := current_setting('josi.professora')::uuid;
  c_aluno constant uuid := current_setting('josi.aluno')::uuid;
  v       text;
  v_camp  uuid;
  v_token uuid;
  v_claim uuid;
  r       record;
BEGIN
  v := pg_temp.como('authenticated', c_prof,
    $q$INSERT INTO public.email_campaigns (email_type, subject_pt, recipient_filter, total)
       VALUES ('low_credits', 'TESTE 4.5 falha (rollback)', '{}', 1) RETURNING id::text$q$);
  v_camp := v::uuid;
  v := pg_temp.como('authenticated', c_prof, format(
    'SELECT public.queue_email_campaign(%L::uuid, ARRAY[%L]::uuid[])::text', v_camp, c_aluno));
  IF v <> '1' THEN
    RAISE EXCEPTION 'FALHOU: fila da campanha de falha (%)', v;
  END IF;
  v_token := pg_temp.como('service_role', NULL, format(
    'SELECT public.email_campaign_acquire_worker(%L::uuid, 60)::text', v_camp))::uuid;
  v_claim := pg_temp.como('service_role', NULL, format(
    'SELECT claim_token::text FROM public.email_campaign_claim(%L::uuid, %L::uuid, 10)', v_camp, v_token))::uuid;
  v := pg_temp.como('service_role', NULL, format(
    'SELECT public.email_campaign_record(%L::uuid, %L::uuid, %L::uuid, %L, %L, NULL, %L, %L)',
    v_camp, c_aluno, v_claim, 'failed', 'resend_422:validation_error', 'x@example.com', 'TESTE 4.5'));
  IF v <> 'recorded' THEN
    RAISE EXCEPTION 'FALHOU: failed não foi gravado (%)', v;
  END IF;
  SELECT status, sent, failed INTO r FROM public.email_campaigns WHERE id = v_camp;
  IF r.status <> 'failed' OR r.sent <> 0 OR r.failed <> 1 THEN
    RAISE EXCEPTION 'FALHOU: campanha só com falha deveria terminar failed 0/1 (% %/%)', r.status, r.sent, r.failed;
  END IF;
  IF (SELECT error_message FROM public.email_notifications WHERE campaign_id = v_camp) <> 'resend_422:validation_error' THEN
    RAISE EXCEPTION 'FALHOU: erro não foi gravado em email_notifications';
  END IF;

  -- Campanha criada por outra pessoa (aqui: pelo SQL Editor, sem created_by)
  INSERT INTO public.email_campaigns (created_by, email_type, total) VALUES (NULL, 'custom', 1) RETURNING id INTO v_camp;
  v := pg_temp.como('authenticated', c_prof, format(
    'SELECT public.queue_email_campaign(%L::uuid, ARRAY[%L]::uuid[])::text', v_camp, c_aluno));
  IF v <> 'ERRO 42501' THEN
    RAISE EXCEPTION 'FALHOU: professora pôs na fila campanha de outra pessoa (%)', v;
  END IF;
END $$;

ROLLBACK;
