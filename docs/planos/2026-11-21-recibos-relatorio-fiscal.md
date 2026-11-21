# Plano: Recibos — relatório fiscal dos recibos emitidos (Excel)
Data: 2026-11-21 · Branch: a da sessão (`ccr-5c1d0336-n4g0in`), PR para `main`

## Objetivo
Na tela Relatórios → "Recibos de seguro" (`/teacher/receipts`), a professora ganha um cartão
"Relatório fiscal": escolhe o período (ano civil, o atual por padrão, ou "Outro período" com duas
datas), vê na hora quantos recibos foram emitidos e os totais (honorários, produtos, total), e baixa
um arquivo **Excel (.xlsx)** para o contador, com três abas: **Resumo** (período, totais por tipo e
geral, quantos anulados), **Emitidos** (nº, data de emissão, nome no recibo, tipo, honorários,
produtos, total + linha de total) e **Anulados** (listados à parte, **fora** dos totais).

## Decisões tomadas no plano (as sugestões do dono, confirmadas)
- **Período = data de emissão (`issued_at`), no dia de Montréal**, como a numeração (o ano do
  número `K-2026-0001` é o ano de Montréal na emissão) e como a coluna "Emissão" da lista. Padrão:
  ano civil atual de Montréal. Anos oferecidos: de 2026 (primeiro ano com recibos) até o atual.
- **Colunas** (aba Emitidos): Nº · Data de emissão · Nome no recibo · Tipo · Honorários · Produtos · Total.
  "Nome no recibo" = `snapshot.patient.fullName` (o nome impresso, que é o documento fiscal); se
  faltar, o nome atual do perfil; se faltar, "—".
- **Anulados**: aba própria (Nº · Data de emissão · Data de anulação · Nome no recibo · Tipo ·
  Valor (fora dos totais)), contados no Resumo e **nunca somados**. Entra no relatório o anulado cuja
  **emissão** está no período. O **motivo da anulação não vai para o arquivo** (texto livre;
  minimização de dados; continua visível na lista da tela).
- **Valores**: números de verdade no Excel (formato `#,##0.00`, somáveis pelo contador), em CAD;
  totais calculados em centavos (sem erro de arredondamento) e gravados como valor (não fórmula).
  Datas como datas de verdade do Excel (formato `yyyy-mm-dd`).
- **Língua do arquivo** = língua da tela (pt/en/fr). A Josi troca o idioma da tela para Français se
  o contador quiser em francês (dica na tela).
- **Só leitura, sem SQL**: o relatório lê `insurance_receipts` com a sessão da professora. A RLS da
  Story 3.3 (`insurance_receipts_select_staff` via `is_staff()`; aluno só vê os próprios) já garante
  a permissão, e a rota `/teacher/receipts` já é `ProtectedRoute requireRole="teacher"`. Nenhuma
  policy, função ou Edge Function muda.
- **Mínimo de dados pessoais**: a consulta pede só as colunas necessárias e, do `snapshot`, **só**
  `patient->>fullName` (nada de data de nascimento, telefone, apólice, titular).

### Biblioteca de Excel: `write-excel-file@4.1.1` (exata), carregada só no clique
| Opção | Por que sim / não |
|---|---|
| **`write-excel-file` 4.1.1** (escolhida) | Só escreve .xlsx (não lê arquivo de fora, então não tem a superfície de ataque de um leitor). Uma única dependência, `fflate` (zip, sem dependências). MIT, mantida (4.1.1 de 2026-06-08, mais de 2 semanas). `npm audit` com ela: **0 vulnerabilidades** (conferido pelo planejador). Tem negrito, formato de número/data, largura de coluna, linha congelada e várias abas. Testada pelo planejador: gera .xlsx válido (zip `PK`), datas certas (2026-01-05 → serial 46027), texto escapado (`<b>`, `&`) e texto que começa com `=` fica texto (não vira fórmula). |
| `xlsx` (SheetJS) no npm, 0.18.5 | Versão do npm parada com vulnerabilidades conhecidas (prototype pollution CVE-2023-30533, ReDoS CVE-2024-22363); as correções só existem fora do npm. Recusada. |
| `exceljs` 4.4.0 | ~21 MB, 9 dependências (archiver, unzipper, tmp...), sem versão nova desde 2023. Pesada demais. Recusada. |
| CSV "compatível com Excel" | Sem dependência, mas o Excel abre CSV conforme a região do computador: em francês do Québec espera `;` e vírgula decimal, em inglês `,` e ponto. Com a configuração errada tudo cai numa coluna só e os valores viram texto; acentos dependem do BOM; um nome começando com `=` vira fórmula (injeção de CSV). A Josi pediu Excel. Recusado. |

Para não pesar no site, a biblioteca é importada com `import('write-excel-file/browser')` **só no
clique** de "Baixar Excel" (vira um arquivo .js à parte no build; a tela não carrega nada a mais).

## Fora do escopo
- Mudar a lista e os filtros que já existem na tela (`ReceiptsList.jsx`; o filtro de datas dela usa
  o dia do navegador, não o de Montréal: fica como está).
- PDF do relatório, envio por email ao contador, relatório de pagamentos/créditos.
- Qualquer SQL, RLS, Edge Function.
- Texto legal (Política de Privacidade): ver "Perguntas em aberto", item 2.
- Colunas extras (nº de consultas, datas dos tratamentos, licença): só se o contador pedir.

## Contexto lido
- `src/pages/TeacherReceipts.jsx` — lista geral de recibos com filtros (aluno, tipo, de/até); carrega `studentNames` de `profiles`.
- `src/components/ReceiptsList.jsx` — tabela de recibos (lê `insurance_receipts`; total = `total_fees + total_products`; data via `todayMontreal`).
- `src/lib/receipts.js` — regras puras: `todayMontreal`, `isValidDateString`, `moneyFormatter`, `RECEIPT_TYPES`.
- `src/lib/receiptService.js`, `src/lib/receiptFiles.js` — chamadas Supabase dos recibos e download por link `<a>`.
- `supabase/migrations/20261112070000_create_insurance_receipts.sql` — tabela `insurance_receipts` (`receipt_number`, `receipt_type`, `student_id`, `issued_at` timestamptz, `snapshot` jsonb com `patient.fullName`, `total_fees`/`total_products` NUMERIC(10,2) calculados no servidor, `status` issued/void, `voided_at`, `void_reason`); RLS: SELECT só professora (`is_staff()`) ou o próprio aluno; imutável.
- `supabase/migrations/20261121000000_receipt_first_opened_by_student.sql` — coluna `student_first_opened_at` (não usada aqui).
- `src/App.jsx`, `src/components/ProtectedRoute.jsx` — `/teacher/receipts` exige papel `teacher`.
- `src/lib/i18n.js` — `escapeValue: false`, `fallbackLng: 'fr'`.
- `src/locales/{pt,en,fr}.json` — `receipts.page` é a última chave de `receipts`.
- `package.json` / `pnpm-lock.yaml` — projeto usa **pnpm** (Vercel instala pelo `pnpm-lock.yaml`); não há biblioteca de Excel/zip direta.
- `src/tests/receiptOpen.test.js` — padrão de teste com `vi.mock('@/lib/supabase', ...)` e `// @vitest-environment node`.

## Passos

### 1. [SONNET] Instalar a biblioteca (versão exata, com pnpm) ✅
- Arquivo(s): `package.json`, `pnpm-lock.yaml`
- Fazer, na raiz do repositório:
  ```bash
  pnpm install --frozen-lockfile
  pnpm add -E write-excel-file@4.1.1
  pnpm audit --prod
  ```
  **Não usar `npm install`** (não pode aparecer `package-lock.json`). Em `package.json`, em
  `dependencies`, tem de ficar exatamente `"write-excel-file": "4.1.1"` (sem `^`), em ordem alfabética
  (depois de `vaul`, antes de `zod`).
- Pronto quando: `git diff --stat` mostra só `package.json` e `pnpm-lock.yaml`; `pnpm audit --prod`
  não mostra nenhuma vulnerabilidade nova ligada a `write-excel-file` ou `fflate` (anotar o resultado
  real para o revisor; se aparecer alguma high/critical nelas, **parar e devolver ao planejador**).

### 2. [SONNET] Textos em pt/en/fr ✅
- Arquivo(s): `src/locales/pt.json`, `src/locales/en.json`, `src/locales/fr.json`
- Fazer: dentro de `"receipts"`, logo depois do objeto `"page": { ... }` (a última chave), pôr uma
  vírgula e o objeto `"report"` da seção "Textos" abaixo (mesmas chaves nas três línguas, valores da
  coluna da língua). Não mexer em mais nada.
- Pronto quando: os três arquivos são JSON válido
  (`node -e "for (const l of ['pt','en','fr']) JSON.parse(require('fs').readFileSync('src/locales/'+l+'.json','utf8'))"`)
  e `receipts.report.xlsx.sheetVoided` existe nos três.

### 3. [OPUS] Regras puras do relatório: `src/lib/receiptReport.js` (arquivo novo) ✅
- Arquivo(s): `src/lib/receiptReport.js`
- Fazer: criar o arquivo com o código abaixo (sem Supabase aqui, testável).
- Código:
  ```js
  // Relatório fiscal dos recibos de seguro (para o contador). Regras puras e
  // montagem das abas do Excel; sem Supabase (chamadas em receiptReportService.js).
  // Período = dia de emissão em Montréal (como a numeração e a coluna "Emissão").
  // Anulados ficam listados à parte e nunca entram nos totais.
  // Dados pessoais: só o nome impresso no recibo (patient_name); nada mais do snapshot.

  import { RECEIPT_TYPES, isValidDateString, todayMontreal } from './receipts'

  export const FIRST_RECEIPT_YEAR = 2026
  export const STUDIO_NAME = 'Josi Pilates'
  export const MONEY_FORMAT = '#,##0.00'
  export const DATE_FORMAT = 'yyyy-mm-dd'

  // NUMERIC do Postgres (número ou texto "85.10") → centavos inteiros.
  export const toCents = value => {
    const n = Number(value ?? 0)
    return Number.isFinite(n) ? Math.round(n * 100) : 0
  }

  export const currentMontrealYear = (now = new Date()) => Number(todayMontreal(now).slice(0, 4))

  // Anos do seletor, do atual (Montréal) até 2026, do mais novo para o mais antigo.
  export function availableYears(now = new Date()) {
    const current = Math.max(currentMontrealYear(now), FIRST_RECEIPT_YEAR)
    const years = []
    for (let y = current; y >= FIRST_RECEIPT_YEAR; y--) years.push(y)
    return years
  }

  export const yearPeriod = year => ({ from: `${year}-01-01`, to: `${year}-12-31` })

  export const isValidPeriod = ({ from, to } = {}) =>
    isValidDateString(from) && isValidDateString(to) && from <= to

  const utcMidnightIso = (dateStr, addDays = 0) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d + addDays)).toISOString()
  }

  // Janela UTC que contém com folga todos os dias de Montréal do período
  // (Montréal é UTC-5/UTC-4). O corte exato é feito em summarizeReport.
  export const utcQueryWindow = ({ from, to }) => ({
    gte: utcMidnightIso(from),
    lt: utcMidnightIso(to, 2),
  })

  export const montrealDay = iso => todayMontreal(new Date(iso))

  const emptyTotals = () => ({ count: 0, feesCents: 0, productsCents: 0, totalCents: 0 })

  // Linhas lidas do banco → { issued, voided, totals, byType } só do período
  // (dia de Montréal), em ordem de emissão (empate: número). Totais só dos emitidos.
  export function summarizeReport(rows = [], { from, to } = {}) {
    const inPeriod = rows.filter(r => {
      const day = montrealDay(r.issued_at)
      return day >= from && day <= to
    })
    inPeriod.sort(
      (a, b) =>
        new Date(a.issued_at) - new Date(b.issued_at) ||
        String(a.receipt_number).localeCompare(String(b.receipt_number)),
    )
    const issued = inPeriod.filter(r => r.status === 'issued')
    const voided = inPeriod.filter(r => r.status === 'void')
    const totals = emptyTotals()
    const byType = Object.fromEntries(RECEIPT_TYPES.map(type => [type, emptyTotals()]))
    for (const r of issued) {
      const fees = toCents(r.total_fees)
      const products = toCents(r.total_products)
      for (const acc of [totals, byType[r.receipt_type]]) {
        if (!acc) continue
        acc.count += 1
        acc.feesCents += fees
        acc.productsCents += products
        acc.totalCents += fees + products
      }
    }
    return { issued, voided, totals, byType }
  }

  // "AAAA-MM-DD HH:mm" na hora de Montréal (linha "Gerado em").
  export function montrealDateTimeLabel(now = new Date()) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Montreal',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(now)
        .map(p => [p.type, p.value]),
    )
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
  }

  // Ano inteiro → "recibos-2026.xlsx"; outro período → "recibos-2026-01-01_2026-03-31.xlsx".
  export function reportFileName(prefix, { from, to }) {
    const year = from.slice(0, 4)
    const wholeYear = from === `${year}-01-01` && to === `${year}-12-31`
    return wholeYear ? `${prefix}-${year}.xlsx` : `${prefix}-${from}_${to}.xlsx`
  }

  // Nome impresso no recibo; senão o nome atual do perfil; senão "—".
  export const nameOnReceipt = (r, studentNames = {}) =>
    String(r.patient_name ?? '').trim() || studentNames[r.student_id] || '—'

  // Data AAAA-MM-DD → célula de data do Excel (meia-noite UTC = o próprio dia).
  const dateCell = dateStr => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return { value: new Date(Date.UTC(y, m - 1, d)), format: DATE_FORMAT }
  }
  const moneyCell = (cents, extra = {}) => ({ value: cents / 100, format: MONEY_FORMAT, ...extra })
  const bold = value => ({ value, fontWeight: 'bold' })

  // Abas no formato do write-excel-file (várias abas: [{ sheet, data, columns }]).
  // t = função de tradução (i18next) na língua da tela.
  export function buildReportSheets(summary, { t, period, generatedAt, studentNames = {} }) {
    const x = (key, opts) => t(`receipts.report.xlsx.${key}`, opts)
    const typeLabel = type => t(`receipts.types.${type}`)
    const { issued, voided, totals, byType } = summary

    const summaryData = [
      [bold(`${STUDIO_NAME} — ${x('title')}`)],
      [x('period'), `${period.from} – ${period.to}`],
      [x('generatedAt'), generatedAt],
      [x('currency')],
      [x('dateNote')],
      [],
      [bold(x('colType')), bold(x('colCount')), bold(x('colFees')), bold(x('colProducts')), bold(x('colTotal'))],
      ...RECEIPT_TYPES.map(type => {
        const s = byType[type]
        return [typeLabel(type), s.count, moneyCell(s.feesCents), moneyCell(s.productsCents), moneyCell(s.totalCents)]
      }),
      [
        bold(x('colTotal')),
        { value: totals.count, fontWeight: 'bold' },
        moneyCell(totals.feesCents, { fontWeight: 'bold' }),
        moneyCell(totals.productsCents, { fontWeight: 'bold' }),
        moneyCell(totals.totalCents, { fontWeight: 'bold' }),
      ],
      [],
      [x('voidedNote'), voided.length],
    ]

    const issuedData = [
      [x('colNumber'), x('colIssuedAt'), x('colName'), x('colType'), x('colFees'), x('colProducts'), x('colTotal')].map(bold),
      ...issued.map(r => {
        const fees = toCents(r.total_fees)
        const products = toCents(r.total_products)
        return [
          r.receipt_number,
          dateCell(montrealDay(r.issued_at)),
          nameOnReceipt(r, studentNames),
          typeLabel(r.receipt_type),
          moneyCell(fees),
          moneyCell(products),
          moneyCell(fees + products),
        ]
      }),
      [
        bold(x('totalRow', { count: totals.count })),
        null,
        null,
        null,
        moneyCell(totals.feesCents, { fontWeight: 'bold' }),
        moneyCell(totals.productsCents, { fontWeight: 'bold' }),
        moneyCell(totals.totalCents, { fontWeight: 'bold' }),
      ],
    ]

    const voidedData = [
      [x('colNumber'), x('colIssuedAt'), x('colVoidedAt'), x('colName'), x('colType'), x('colVoidedValue')].map(bold),
      ...voided.map(r => [
        r.receipt_number,
        dateCell(montrealDay(r.issued_at)),
        r.voided_at ? dateCell(montrealDay(r.voided_at)) : null,
        nameOnReceipt(r, studentNames),
        typeLabel(r.receipt_type),
        moneyCell(toCents(r.total_fees) + toCents(r.total_products)),
      ]),
    ]

    return [
      { sheet: x('sheetSummary'), data: summaryData, columns: [{ width: 44 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }] },
      {
        sheet: x('sheetIssued'),
        data: issuedData,
        columns: [{ width: 14 }, { width: 14 }, { width: 36 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }],
        stickyRowsCount: 1,
      },
      {
        sheet: x('sheetVoided'),
        data: voidedData,
        columns: [{ width: 14 }, { width: 14 }, { width: 14 }, { width: 36 }, { width: 16 }, { width: 22 }],
        stickyRowsCount: 1,
      },
    ]
  }
  ```
- Pronto quando: `npm run lint` passa e os testes do passo 6 (parte "regras puras") passam.

### 4. [OPUS] Leitura no Supabase e download: `src/lib/receiptReportService.js` (arquivo novo) ✅
- Arquivo(s): `src/lib/receiptReportService.js`
- Fazer: criar com o código abaixo. Só SELECT com a sessão da professora (a RLS faz a permissão);
  pagina de 1000 em 1000 (limite padrão de linhas do Supabase), na ordem estável
  `issued_at, receipt_number` (`receipt_number` é UNIQUE).
- Código:
  ```js
  // Leitura dos recibos para o relatório fiscal e download do .xlsx.
  // Só leitura, com a sessão da professora: a RLS de insurance_receipts (Story 3.3)
  // só devolve todos os recibos para is_staff(). Do snapshot vem só o nome
  // impresso (patient_name); nada de data de nascimento, telefone ou apólice.

  import { supabase } from './supabase'
  import { utcQueryWindow } from './receiptReport'

  export const REPORT_PAGE_SIZE = 1000
  export const REPORT_COLUMNS =
    'id, receipt_number, receipt_type, student_id, issued_at, total_fees, total_products, status, voided_at, patient_name:snapshot->patient->>fullName'

  export async function fetchReceiptsForReport(period) {
    const { gte, lt } = utcQueryWindow(period)
    const rows = []
    for (let start = 0; ; start += REPORT_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('insurance_receipts')
        .select(REPORT_COLUMNS)
        .gte('issued_at', gte)
        .lt('issued_at', lt)
        .order('issued_at', { ascending: true })
        .order('receipt_number', { ascending: true })
        .range(start, start + REPORT_PAGE_SIZE - 1)
      if (error) throw error
      const page = data || []
      rows.push(...page)
      if (page.length < REPORT_PAGE_SIZE) break
    }
    return rows
  }

  // A biblioteca só é baixada aqui (no clique), num arquivo .js à parte.
  export async function downloadReportXlsx(sheets, fileName) {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    await writeXlsxFile(sheets).toFile(fileName)
  }
  ```
- Pronto quando: lint passa e os testes do passo 6 (parte "serviço") passam.

### 5. [OPUS] Cartão "Relatório fiscal" na tela de recibos ✅
- Arquivo(s): `src/components/ReceiptReportCard.jsx` (novo), `src/pages/TeacherReceipts.jsx`
- Fazer:
  1. Criar `src/components/ReceiptReportCard.jsx` com o código abaixo.
  2. Em `src/pages/TeacherReceipts.jsx`: adicionar `import ReceiptReportCard from '../components/ReceiptReportCard'`
     logo abaixo do `import ReceiptsList ...`; e, no JSX, entre o `</div>` do título/subtítulo e o
     `<Card className="rounded-2xl">` dos filtros, inserir `<ReceiptReportCard studentNames={studentNames} />`.
     Nada mais muda nessa página.
- Código (`ReceiptReportCard.jsx`):
  ```jsx
  import { useEffect, useMemo, useState } from 'react'
  import { useTranslation } from 'react-i18next'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Alert, AlertDescription } from '@/components/ui/alert'
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select'
  import { FileSpreadsheet, Loader2 } from 'lucide-react'
  import { moneyFormatter } from '../lib/receipts'
  import {
    availableYears,
    buildReportSheets,
    isValidPeriod,
    montrealDateTimeLabel,
    reportFileName,
    summarizeReport,
    yearPeriod,
  } from '../lib/receiptReport'
  import { downloadReportXlsx, fetchReceiptsForReport } from '../lib/receiptReportService'

  // Relatório fiscal (para o contador): período por data de emissão (dia de
  // Montréal), totais na tela e download em Excel. Anulados à parte, fora dos totais.

  const CUSTOM = 'custom'

  const ReceiptReportCard = ({ studentNames = {} }) => {
    const { t, i18n } = useTranslation()
    const years = useMemo(() => availableYears(), [])
    const [choice, setChoice] = useState(String(years[0]))
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [downloadError, setDownloadError] = useState(false)

    const period = choice === CUSTOM ? { from: customFrom, to: customTo } : yearPeriod(Number(choice))
    const { from, to } = period
    const valid = isValidPeriod(period)

    useEffect(() => {
      if (!valid) {
        setRows([])
        setLoadError(false)
        return
      }
      let cancelled = false
      setLoading(true)
      setLoadError(false)
      fetchReceiptsForReport({ from, to })
        .then(data => {
          if (!cancelled) setRows(data)
        })
        .catch(() => {
          if (!cancelled) {
            setRows([])
            setLoadError(true)
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }, [from, to, valid])

    const summary = useMemo(() => summarizeReport(rows, { from, to }), [rows, from, to])
    const money = moneyFormatter(i18n.language?.slice(0, 2))
    const fmt = cents => money.format(cents / 100)

    // Lê de novo na hora do download: o arquivo sai com a situação deste momento.
    const handleDownload = async () => {
      setDownloading(true)
      setDownloadError(false)
      try {
        const fresh = await fetchReceiptsForReport({ from, to })
        setRows(fresh)
        const sheets = buildReportSheets(summarizeReport(fresh, { from, to }), {
          t,
          period: { from, to },
          generatedAt: montrealDateTimeLabel(),
          studentNames,
        })
        await downloadReportXlsx(sheets, reportFileName(t('receipts.report.fileNamePrefix'), { from, to }))
      } catch {
        setDownloadError(true)
      } finally {
        setDownloading(false)
      }
    }

    const nothing = summary.issued.length === 0 && summary.voided.length === 0

    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <FileSpreadsheet className="h-5 w-5 mr-2 text-primary" />
            {t('receipts.report.title')}
          </CardTitle>
          <CardDescription>{t('receipts.report.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                {t('receipts.report.period')}
              </Label>
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>{t('receipts.report.customPeriod')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {choice === CUSTOM && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="rr-from" className="text-xs font-semibold text-muted-foreground">
                    {t('receipts.report.from')}
                  </Label>
                  <Input id="rr-from" type="date" value={customFrom} max={customTo || undefined}
                    onChange={e => setCustomFrom(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rr-to" className="text-xs font-semibold text-muted-foreground">
                    {t('receipts.report.to')}
                  </Label>
                  <Input id="rr-to" type="date" value={customTo} min={customFrom || undefined}
                    onChange={e => setCustomTo(e.target.value)} className="rounded-xl" />
                </div>
              </>
            )}
          </div>

          {!valid ? (
            <p className="text-sm text-muted-foreground">{t('receipts.report.invalidPeriod')}</p>
          ) : loading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('receipts.report.loading')}
            </div>
          ) : loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{t('receipts.report.loadError')}</AlertDescription>
            </Alert>
          ) : nothing ? (
            <p className="text-sm text-muted-foreground">{t('receipts.report.empty')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t('receipts.report.issuedCount', { count: summary.totals.count })}</p>
                <p className="text-xs text-muted-foreground">
                  {t('receipts.report.voidedCount', { count: summary.voided.length })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('receipts.report.fees')}</p>
                <p className="font-semibold">{fmt(summary.totals.feesCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('receipts.report.products')}</p>
                <p className="font-semibold">{fmt(summary.totals.productsCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('receipts.report.total')}</p>
                <p className="font-semibold">{fmt(summary.totals.totalCents)}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Button className="rounded-xl" onClick={handleDownload}
              disabled={!valid || loading || loadError || downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              {downloading ? t('receipts.report.downloading') : t('receipts.report.download')}
            </Button>
            <span className="text-xs text-muted-foreground">{t('receipts.report.languageHint')}</span>
          </div>
          {downloadError && <p className="text-sm text-destructive">{t('receipts.report.downloadError')}</p>}
        </CardContent>
      </Card>
    )
  }

  export default ReceiptReportCard
  ```
- Observações para quem executa: com período sem nenhum recibo, o botão continua ativo (o arquivo
  com zero recibos serve para o contador como confirmação). O cartão não mostra o motivo de anulação.
- Pronto quando: lint e build passam; em `npm run dev` (se der para logar como professora) o cartão
  aparece acima de "Filtros", com o ano atual escolhido.

### 6. [OPUS] Testes automáticos ✅
- Arquivo(s): `src/tests/receiptReport.test.js` (novo), `src/tests/receiptReportService.test.js` (novo)
- Fazer: os dois arquivos começam com `// @vitest-environment node`. Usar um `t` falso:
  `const t = (k, o) => (o ? \`${k}|${JSON.stringify(o)}\` : k)`.
  **`receiptReport.test.js` — regras puras:**
  1. `yearPeriod(2026)` → `{ from: '2026-01-01', to: '2026-12-31' }`.
  2. `availableYears(new Date('2028-03-01T12:00:00Z'))` → `[2028, 2027, 2026]`;
     `availableYears(new Date('2026-05-01T12:00:00Z'))` → `[2026]`;
     `availableYears(new Date('2027-01-01T03:00:00Z'))` → `[2026]` (ainda 31/12 em Montréal);
     `availableYears(new Date('2025-06-01T12:00:00Z'))` → `[2026]`.
  3. `isValidPeriod`: `{from:'2026-01-01',to:'2026-01-01'}` true; from > to false; vazio false; `'2026-02-30'` false.
  4. `utcQueryWindow({ from: '2026-01-01', to: '2026-12-31' })` →
     `{ gte: '2026-01-01T00:00:00.000Z', lt: '2027-01-02T00:00:00.000Z' }`.
  5. Corte pelo dia de Montréal no período 2026: `issued_at '2026-01-01T04:30:00Z'` (2025-12-31 23:30 em Montréal) **fora**;
     `'2026-01-01T05:30:00Z'` **dentro**; `'2027-01-01T03:30:00Z'` (2026-12-31 22:30) **dentro**; `'2027-01-01T05:30:00Z'` **fora**.
  6. Totais em centavos exatos e anulado fora: emitidos K `total_fees '85.10'`, `total_products '0.00'`;
     N `total_fees 0.2` (número), `total_products '19.99'`; anulado K `total_fees '1000.00'` →
     `totals = { count: 2, feesCents: 8530, productsCents: 1999, totalCents: 10529 }`;
     `byType.kinesitherapy.count === 1`, `byType.naturopathy.productsCents === 1999`; `voided.length === 1`.
  7. Ordem: dois recibos com o mesmo `issued_at` saem por `receipt_number`; recibos fora de ordem saem por `issued_at` crescente.
  8. `montrealDateTimeLabel(new Date('2026-01-15T17:30:00Z'))` → `'2026-01-15 12:30'`;
     `montrealDateTimeLabel(new Date('2026-07-01T16:05:00Z'))` → `'2026-07-01 12:05'`.
  9. `reportFileName('recibos', yearPeriod(2026))` → `'recibos-2026.xlsx'`;
     `reportFileName('recibos', { from: '2026-01-01', to: '2026-03-31' })` → `'recibos-2026-01-01_2026-03-31.xlsx'`.
  10. `buildReportSheets`: 3 abas com `sheet` = `receipts.report.xlsx.sheetSummary` / `sheetIssued` / `sheetVoided`;
      aba Emitidos: 1ª linha com 7 cabeçalhos, `issued.length + 2` linhas, o número do anulado **não** aparece
      nela e aparece na aba Anulados; última linha: `value` de honorários/produtos/total = `totals/100`
      (ex.: `85.3`, `19.99`, `105.29`) com `format: '#,##0.00'`; célula de data = `Date` igual a
      `new Date(Date.UTC(2026, 0, 1))` para um recibo de `'2026-01-01T05:30:00Z'`, com `format: 'yyyy-mm-dd'`.
  11. Nome: `patient_name` tem prioridade; sem ele, `studentNames[student_id]`; sem os dois, `'—'`.
  12. Privacidade: uma linha com campos a mais (`snapshot: { patient: { dateOfBirth: '1980-04-02', phone: '514-555-0000' } }`,
      `void_reason: 'segredo'`) → `JSON.stringify(sheets)` não contém `'1980-04-02'`, `'514-555-0000'` nem `'segredo'`.
  13. Nome que parece fórmula (`'=SUM(A1:A9)'`) sai como `string` simples na célula (sem `type: 'Formula'`).
  14. Arquivo de verdade, com os textos reais das três línguas (a biblioteca recusa nome de aba com mais
      de 31 caracteres ou repetido; com o `t` falso acima o nome da aba fica longo demais, então **não**
      usar o `t` falso aqui): para cada `lang` de `['pt', 'en', 'fr']`, ler
      `src/locales/${lang}.json` (`readFileSync` + `JSON.parse`, como em `receipts.test.js`) e montar
      `const tReal = (key, opts = {}) => key.split('.').reduce((o, k) => o?.[k], json).replace(/\{\{(\w+)\}\}/g, (_, n) => String(opts[n]))`;
      `import writeXlsxFile from 'write-excel-file/universal'`; com as linhas do teste 10,
      `const blob = await writeXlsxFile(buildReportSheets(summary, { t: tReal, period, generatedAt: '2026-11-21 10:00' })).toBlob()`;
      `new Uint8Array(await blob.arrayBuffer())` começa com `0x50, 0x4b` ("PK") e `blob.size > 1000`.
      Repetir com um resumo vazio (`summarizeReport([], yearPeriod(2026))`): também gera.
      (Conferido pelo planejador: com o `t` falso a biblioteca dá "Sheet name ... can't be longer than 31 characters".)

  **`receiptReportService.test.js` — serviço (Supabase falso, como `receiptOpen.test.js`):**
  ```js
  // @vitest-environment node
  import { describe, it, expect, vi, beforeEach } from 'vitest'

  let pages = []
  const builder = {
    select: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => Promise.resolve(pages.shift())),
  }
  const from = vi.fn(() => builder)
  vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

  const { fetchReceiptsForReport, REPORT_COLUMNS, REPORT_PAGE_SIZE } = await import('@/lib/receiptReportService')
  ```
  1. Lê `insurance_receipts`; `select` recebe `REPORT_COLUMNS`, que contém `patient_name:snapshot->patient->>fullName`
     e **não** contém `snapshot,`, `void_reason` nem `dateOfBirth`.
  2. `gte('issued_at', '2026-01-01T00:00:00.000Z')` e `lt('issued_at', '2027-01-02T00:00:00.000Z')` para `yearPeriod(2026)`;
     `order` chamado com `('issued_at', { ascending: true })` e depois `('receipt_number', { ascending: true })`.
  3. Paginação: 1ª página com `REPORT_PAGE_SIZE` linhas e 2ª com 3 → devolve 1003 linhas; `range` chamado com `(0, 999)` e `(1000, 1999)`.
  4. Página única com 0 linhas (`data: null`) → `[]`, `range` uma vez.
  5. `{ data: null, error: new Error('permission denied') }` → a função rejeita (o cartão mostra o erro).
  (Zerar `pages` e os `mockClear()` no `beforeEach`.)
- Pronto quando: `npm test` passa com os testes novos e os antigos.

### 7. [SONNET] Conferência final (antes do revisor)
- Fazer: `npm run lint`, `npm test`, `npm run build` e anotar o resultado real. Conferir que o build
  gerou um arquivo .js separado com a biblioteca (`grep -l "sharedStrings" dist/assets/*.js` lista um
  arquivo que **não** é o `index-*.js` principal). Conferir `git diff --stat main`: só os arquivos
  deste plano (`package.json`, `pnpm-lock.yaml`, 3 locales, `src/lib/receiptReport.js`,
  `src/lib/receiptReportService.js`, `src/components/ReceiptReportCard.jsx`,
  `src/pages/TeacherReceipts.jsx`, 2 testes, `docs/PENDENCIAS.md`, este plano).
- Pronto quando: os três comandos passam; então chamar o `revisor` com este plano e a branch.

### 8. [SONNET] Atualizar `docs/PENDENCIAS.md`
- Arquivo(s): `docs/PENDENCIAS.md`
- Fazer:
  1. Linha `_Última atualização: ..._` → `_Última atualização: 2026-11-21 (relatório fiscal dos recibos em Excel: feito no código; falta o merge e o teste)_`.
  2. Em "A fazer", trocar o item "Recibos: relatório dos recibos emitidos para efeito fiscal ..." por:
     `- [x] **Recibos: relatório fiscal dos recibos emitidos, em Excel (pedido da Josi, 2026-11-21). Feito no código (2026-11-21), plano \`docs/planos/2026-11-21-recibos-relatorio-fiscal.md\`. Sem SQL, sem deploy. Falta o merge e o teste no site.** Relatórios → Recibos de seguro → cartão "Relatório fiscal": período por data de emissão (dia de Montréal; ano civil, padrão o atual, ou outro período), totais na tela e "Baixar Excel (.xlsx)" com as abas Resumo, Emitidos e Anulados (anulados à parte, fora dos totais; o motivo da anulação não vai para o arquivo). Biblioteca \`write-excel-file@4.1.1\` (só escreve .xlsx; carregada só no clique). Pendente de decisão: Política de Privacidade (seção 8) sobre o arquivo ir para o contador (ver o plano, "Perguntas em aberto").`
  3. Em "Testes em aberto (usuário)", no topo da lista, o bloco da seção "Testes → Manual" abaixo.
- Pronto quando: o arquivo tem as três mudanças e nada mais.

## Textos (pt / en / fr)
Objeto `receipts.report` (inserir depois de `receipts.page`).

| chave | pt | en | fr |
|---|---|---|---|
| title | Relatório fiscal | Tax report | Rapport fiscal |
| description | Recibos emitidos no período, com os totais, para o contador. Os anulados aparecem à parte e não entram nos totais. | Receipts issued in the period, with the totals, for the accountant. Voided receipts are listed separately and are not included in the totals. | Reçus émis pendant la période, avec les totaux, pour le comptable. Les reçus annulés sont listés à part et ne sont pas inclus dans les totaux. |
| period | Período | Period | Période |
| customPeriod | Outro período | Custom period | Autre période |
| from | De | From | Du |
| to | Até | To | Au |
| invalidPeriod | Escolha as duas datas (a primeira não pode ser depois da segunda). | Choose both dates (the first one cannot be after the second). | Choisissez les deux dates (la première ne peut pas être après la deuxième). |
| loading | Calculando os totais... | Calculating the totals... | Calcul des totaux... |
| loadError | Não foi possível carregar os recibos do período. | Could not load the receipts for this period. | Impossible de charger les reçus de la période. |
| empty | Nenhum recibo emitido neste período. | No receipts issued in this period. | Aucun reçu émis pendant cette période. |
| issuedCount | Recibos emitidos: {{count}} | Issued receipts: {{count}} | Reçus émis : {{count}} |
| fees | Honorários | Fees | Honoraires |
| products | Produtos | Products | Produits |
| total | Total | Total | Total |
| voidedCount | Anulados (fora dos totais): {{count}} | Voided (not in totals): {{count}} | Annulés (hors totaux) : {{count}} |
| download | Baixar Excel (.xlsx) | Download Excel (.xlsx) | Télécharger Excel (.xlsx) |
| downloading | Gerando o arquivo... | Generating the file... | Génération du fichier... |
| downloadError | Não foi possível gerar o arquivo. Tente de novo. | Could not generate the file. Please try again. | Impossible de générer le fichier. Réessayez. |
| languageHint | O arquivo sai na língua da tela. | The file uses the screen language. | Le fichier est dans la langue de l'écran. |
| fileNamePrefix | recibos | receipts | recus |
| xlsx.sheetSummary | Resumo | Summary | Résumé |
| xlsx.sheetIssued | Emitidos | Issued | Émis |
| xlsx.sheetVoided | Anulados | Voided | Annulés |
| xlsx.title | Recibos de seguro emitidos | Insurance receipts issued | Reçus d'assurance émis |
| xlsx.period | Período | Period | Période |
| xlsx.generatedAt | Gerado em (hora de Montréal) | Generated on (Montréal time) | Généré le (heure de Montréal) |
| xlsx.currency | Valores em dólares canadenses (CAD). | Amounts in Canadian dollars (CAD). | Montants en dollars canadiens (CAD). |
| xlsx.dateNote | Datas de emissão no dia de Montréal. Os recibos anulados ficam na aba Anulados e não entram nos totais. | Issue dates are Montréal days. Voided receipts are on the Voided sheet and are not included in the totals. | Dates d'émission selon le jour à Montréal. Les reçus annulés sont dans l'onglet Annulés et ne sont pas inclus dans les totaux. |
| xlsx.colNumber | Nº | No. | Nº |
| xlsx.colIssuedAt | Data de emissão | Issue date | Date d'émission |
| xlsx.colVoidedAt | Data de anulação | Void date | Date d'annulation |
| xlsx.colName | Nome no recibo | Name on receipt | Nom sur le reçu |
| xlsx.colType | Tipo | Type | Type |
| xlsx.colCount | Recibos | Receipts | Reçus |
| xlsx.colFees | Honorários | Fees | Honoraires |
| xlsx.colProducts | Produtos | Products | Produits |
| xlsx.colTotal | Total | Total | Total |
| xlsx.colVoidedValue | Valor (fora dos totais) | Amount (not in totals) | Montant (hors totaux) |
| xlsx.totalRow | Total ({{count}}) | Total ({{count}}) | Total ({{count}}) |
| xlsx.voidedNote | Recibos anulados (não entram nos totais) | Voided receipts (not included in the totals) | Reçus annulés (non inclus dans les totaux) |

O nome da aba Anulados citado em `xlsx.dateNote` tem de ser igual a `xlsx.sheetVoided` em cada língua.

## Banco de dados
- SQL: **não**. Só leitura de `insurance_receipts` com as policies da Story 3.3, já em produção.
- Ordem: **tanto faz** (não há SQL nem Edge Function).
- Edge Function a publicar: nenhuma.

## Testes
- Automáticos: `npm run lint`, `npm test`, `npm run build` + os testes novos `src/tests/receiptReport.test.js`
  e `src/tests/receiptReportService.test.js` (passo 6). `pnpm audit --prod` no passo 1.
- Manual depois do deploy (texto para `docs/PENDENCIAS.md`, "Testes em aberto"):

  `- [ ] **Teste depois do merge do relatório fiscal dos recibos (sem SQL, sem deploy):** professora → Relatórios → "Recibos de seguro": acima de "Filtros" aparece o cartão "Relatório fiscal".`
  `  1. **Tela:** o período vem no ano atual (2026). Os números batem com a lista de baixo filtrada de 01/01 a 31/12: "Recibos emitidos" conta só os não anulados; Honorários + Produtos = Total; "Anulados (fora dos totais)" conta os anulados.`
  `  2. **Excel:** "Baixar Excel (.xlsx)" baixa \`recibos-2026.xlsx\`. Abrir no Excel (e, se der, no Numbers/Google Planilhas): abre sem aviso de "conteúdo ilegível". Aba **Resumo**: período, "Gerado em" com a hora de agora em Montréal, uma linha por tipo e o total (iguais aos da tela), e quantos anulados. Aba **Emitidos**: um recibo por linha (nº, data, nome como saiu no recibo, tipo, honorários, produtos, total) e a linha "Total (N)" no fim; selecionar a coluna Total: a soma do Excel é igual ao total. Aba **Anulados**: os anulados com a data de anulação, e eles **não** estão na aba Emitidos nem no total.`
  `  3. **Outro período:** escolher "Outro período" com as datas de um único recibo: a tela e o arquivo (\`recibos-AAAA-MM-DD_AAAA-MM-DD.xlsx\`) mostram só ele. Pôr a primeira data depois da segunda: aparece a mensagem e o botão fica cinza. Um período sem recibos: "Nenhum recibo emitido neste período" e o arquivo baixa com as abas vazias.`
  `  4. **Línguas:** trocar o idioma da tela para English e Français: textos do cartão traduzidos; o arquivo sai na língua da tela (\`receipts-2026.xlsx\` / \`recus-2026.xlsx\`, abas Summary/Issued/Voided e Résumé/Émis/Annulés).`
  `  5. **Celular:** o cartão cabe sem rolar para o lado; o botão baixa (ou abre) o arquivo.`
  `  6. **Aluno:** logado como aluno de teste, \`josipilates.com/teacher/receipts\` volta para o painel do aluno (nenhum relatório).`
  `  7. **Contador:** mandar o arquivo de teste ao contador e perguntar se as colunas e a data de emissão servem (ver as perguntas do plano).`

## Riscos e como voltar atrás
- **Arquivo que o Excel não abre** (risco baixo: biblioteca testada e usada por muita gente; o
  planejador conferiu o XML gerado). Coberto pelo teste manual 2. Se acontecer: Revert do PR.
- **Diferença de dia na virada do ano** (recibo emitido 31/12 às 22h em Montréal = 01/01 UTC): o
  corte é pelo dia de Montréal, coberto pelo teste automático 5.
- **Mais de 1000 recibos num período**: paginação (teste do serviço 3).
- **Lockfile**: a Vercel instala com `pnpm` pelo `pnpm-lock.yaml`; se o build da Vercel falhar por
  lockfile, o deploy anterior continua no ar. Correção: rodar `pnpm install` e commitar o lockfile.
- **Privacidade**: o arquivo tem nomes e valores de alunos; é baixado pela professora para o
  computador dela. Só o nome impresso no recibo sai do `snapshot`; motivo de anulação fica de fora.
- **Voltar atrás**: GitHub → PR mergeado → **Revert** → mergear o PR de reversão; ou Vercel →
  Deployments → deploy anterior → **Promote to Production**. Não há SQL de reversão.

## Perguntas em aberto ao dono (não bloqueiam a execução)
1. **Data que define o período, para o contador:** o plano usa a **data de emissão** do recibo (como a
   numeração anual). Se o contador preferir pela data dos tratamentos (ex.: recibo emitido em janeiro
   de 2027 para sessões de dezembro de 2026), é outra regra: perguntar a ele com o arquivo de teste
   (teste manual 7) e, se for o caso, uma tarefa nova.
2. **Política de Privacidade (seção 8, texto legal):** ela diz que só o aluno e a professora têm acesso
   aos recibos e que os dados são usados "somente para emitir os recibos". Entregar ao contador uma
   lista com nome e valores é uma obrigação fiscal (a seção 3 cita "cumprir obrigações legais" e a 4
   "quando exigido por lei"), mas a seção 8 não fala disso. Quer ajustar o texto (pt/en/fr) numa
   sessão própria com o `dev-critico`? Este PR não mexe em texto legal.
