# PRD-002 — Recibos para Seguro Saúde (Kinésithérapie e Naturopathie)
**Josi Pilates Management System — Brownfield Enhancement**
**Data:** 2026-11-12 | **Status:** Draft | **Epic:** 3

---

## 1. Problema & Contexto

A professora (Josiane) é kinésithérapeute e naturopathe, membro do sindicato CPMDQ. Os alunos pedem recibos para enviar ao seguro saúde (plano do empregador). Hoje ela preenche à mão o formulário oficial da CPMDQ, um por aluno, repetindo dados que já existem no sistema. Não há histórico centralizado dos recibos emitidos e o aluno depende dela para receber cada recibo.

Existem **dois formulários oficiais** (PDF, carta 612×792 pt, com campos AcroForm):
- `src/assets/receipt-templates/kinesitherapie.pdf` — "Déclaration du praticien traitant — Traitement kinésithérapeutes"
- `src/assets/receipt-templates/naturopathie.pdf` — "Déclaration du praticien traitant — Traitement naturopathique" (tem a seção extra de produtos homeopáticos / herbologia)

## 2. Objetivos

| # | Objetivo | Métrica de sucesso |
|---|----------|--------------------|
| 1 | Professora emite um recibo preenchendo só data(s) do tratamento e valor(es) | Emissão em < 1 min por recibo |
| 2 | Recibo sai no formulário oficial da CPMDQ | PDF aceito pelas seguradoras |
| 3 | Aluno acessa seus recibos sozinho no portal | 100% dos recibos visíveis em "Meus recibos" |
| 4 | Recibo emitido é imutável e rastreável | Sem edição; correção só por anulação + novo recibo |

## 3. Usuários

- **Professora:** cadastra uma vez seus dados profissionais (nome, nº de licença por especialidade, assinatura) e emite recibos.
- **Aluno:** mantém nº de apólice e dados do titular no próprio perfil; baixa seus recibos no portal.

## 4. Requisitos Funcionais

### FR-01 — Dados de seguro do aluno
Novos dados por aluno (tabela própria, fora de `profiles`, por serem sensíveis):
- Nº da apólice (`policy_number`), cidade/província de residência.
- "O titular da apólice sou eu" (padrão: sim). Se não: nome do titular, cidade/província, empregador, ocupação, telefone comercial, telefone residencial.
- Editável pelo aluno (portal) e pela professora (ficha do aluno).

### FR-02 — Dados profissionais da professora
- Nome profissional, nº de licença de kinésithérapie, nº de licença de naturopathie.
- Imagem da assinatura (PNG com fundo transparente), em storage privado.

### FR-03 — Emissão de recibo
- Na ficha do aluno: botão "Emitir recibo" → escolher tipo (kinésithérapie / naturopathie).
- Formulário pré-preenchido com dados do aluno, do titular e da professora. Campos vazios ficam destacados para a professora completar.
- A professora informa **1 a 10 tratamentos** (data + valor). Naturopathie: **0 a 4 produtos** (nome + preço).
- Calculados automaticamente: nº de consultas, total de honorários, total de produtos.
- Opção "salvar no cadastro do aluno" para dados que ela completou na hora.
- Pré-visualização do PDF antes de confirmar.

### FR-04 — PDF
- Gerado preenchendo os campos AcroForm do PDF oficial (pdf-lib) e "achatando" o formulário (não editável).
- Assinatura desenhada como imagem na área de assinatura; data = data de emissão.
- Número do recibo único e sequencial (ex.: `K-2026-0001`, `N-2026-0001`).

### FR-05 — Arquivo e imutabilidade
- Cada recibo salvo em tabela própria com um **snapshot** de todos os dados impressos + o PDF em bucket privado.
- Sem UPDATE/DELETE. Correção = **anular** (motivo obrigatório) e emitir novo. Recibo anulado continua visível, marcado "Anulado".

### FR-06 — Portal do aluno
- Seção "Meus recibos": lista (nº, tipo, datas, total, status) e download via URL assinada temporária.
- Aluno só vê os próprios recibos (RLS na tabela e no storage).

### FR-07 — Histórico para a professora
- Lista de recibos por aluno na ficha e lista geral filtrável (aluno, tipo, período).

### FR-08 — Privacidade
- Atualizar a Política de Privacidade (pt/en/fr) mencionando nº de apólice, dados do titular e guarda dos recibos.

## 5. Requisitos Não Funcionais
- Todos os textos de UI em pt/en/fr. O PDF é bilíngue FR/EN por natureza (formulário oficial).
- Segurança: RLS em todas as tabelas novas; buckets privados; nenhum dado sensível em logs.
- Sem quebra do que existe: só `CREATE TABLE` / `ADD COLUMN` e policies novas.

## 6. Fora de escopo (por enquanto)
- Enviar o recibo por email automaticamente (pode virar Story 3.8).
- Sugerir datas de tratamento a partir dos check-ins.
- Assinatura eletrônica certificada.
- Envio direto para a seguradora.

## 7. Perguntas respondidas (Josi, 2026-11-12)
1. **Assinatura em imagem:** sim, a seguradora aceita. O recibo sai com a imagem da assinatura (PNG) na área de assinatura.
2. **"Total des honoraires":** só as consultas. Os produtos de naturopathie têm total próprio ("Total des produits").
3. **Formato de data no recibo:** `AAAA-MM-JJ` (padrão Québec), ex.: `2026-11-12`.
4. **Valor padrão por sessão:** não existe. O valor de cada tratamento é digitado na emissão (sem pré-preenchimento).
5. **Recibo para quem não é aluno cadastrado:** não. Só alunos cadastrados.

## 8. Stories

| Story | Título | Tipo | Esforço | Depende de |
|-------|--------|------|---------|------------|
| 3.1 | Banco: dados de seguro do aluno e dados profissionais da professora | DB + RLS | dev-critico | — |
| 3.2 | UI: campos de seguro no cadastro + perfil profissional da professora | UI | medium | 3.1 |
| 3.3 | Banco + storage: tabela de recibos, numeração, imutabilidade, anulação | DB + RLS + Storage | dev-critico | 3.1 |
| 3.4 | Gerador de PDF a partir dos formulários oficiais | Lib front | medium | — |
| 3.5 | Emissão e histórico de recibos (professora) | UI | dev-critico | 3.2, 3.3, 3.4 |
| 3.6 | "Meus recibos" no portal do aluno | UI | medium | 3.3, 3.5 |
| 3.7 | Política de Privacidade: dados de seguro e recibos | Texto legal | dev-critico | 3.1 |

Ordem sugerida: 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 (3.4 e 3.7 podem ser feitas em paralelo a qualquer momento).
