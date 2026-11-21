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
