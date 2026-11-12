// Chamadas ao Supabase dos recibos de seguro (Story 3.5). Tudo com a sessão da
// professora (chave anon + JWT); as permissões são as RPCs e a RLS da Story 3.3.
//
// Fluxo de emissão: issue_insurance_receipt → lê o recibo gravado → gera o PDF a
// partir dele → upload em insurance-receipts/{student_id}/{receipt_id}.pdf →
// attach_receipt_pdf. Se algo falhar depois da RPC, o recibo já existe e fica
// "PDF pendente"; "Gerar PDF" (ensureReceiptPdf) refaz do mesmo jeito.

import { supabase } from './supabase'
import { generateReceiptPdf } from './receiptPdf'
import { isAlreadyExistsError, pdfDataFromReceipt, receiptPdfPath } from './receipts'

const RECEIPTS_BUCKET = 'insurance-receipts'
const SIGNATURES_BUCKET = 'practitioner-signatures'

export async function loadSignatureBytes(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(SIGNATURES_BUCKET).download(path)
  if (error || !data) throw new Error('signature download failed')
  return new Uint8Array(await data.arrayBuffer())
}

// Assinatura para (re)gerar o PDF: a do snapshot; se o arquivo não existir mais
// (a professora trocou PNG por JPEG), a assinatura atual de quem emitiu. A RLS
// de practitioner_credentials só devolve a linha da própria professora logada,
// então nunca entra a assinatura de outra pessoa.
async function signatureForReceipt(receipt) {
  const snapshotPath = receipt.snapshot?.signaturePath || null
  try {
    return await loadSignatureBytes(snapshotPath)
  } catch (err) {
    const { data } = await supabase
      .from('practitioner_credentials')
      .select('signature_path')
      .eq('teacher_id', receipt.issued_by)
      .maybeSingle()
    if (data?.signature_path && data.signature_path !== snapshotPath) {
      return loadSignatureBytes(data.signature_path)
    }
    throw err
  }
}

export async function fetchReceipt(receiptId) {
  const { data, error } = await supabase
    .from('insurance_receipts')
    .select('*')
    .eq('id', receiptId)
    .single()
  if (error) throw error
  return data
}

// Gera o PDF do recibo gravado, envia e anexa. Pode ser repetido: se o arquivo
// já foi enviado numa tentativa anterior, só anexa (o bucket não deixa trocar
// nem apagar PDF, e attach_receipt_pdf aceita repetir o mesmo caminho).
export async function ensureReceiptPdf(receipt, signatureBytes) {
  if (receipt.pdf_path) return receipt.pdf_path
  const path = receiptPdfPath(receipt.student_id, receipt.id)

  let sig = signatureBytes
  if (sig === undefined) sig = await signatureForReceipt(receipt)

  const bytes = await generateReceiptPdf(pdfDataFromReceipt(receipt, sig))
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const { error: uploadError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: false })
  if (uploadError && !isAlreadyExistsError(uploadError)) throw uploadError

  const { error: attachError } = await supabase.rpc('attach_receipt_pdf', {
    p_receipt_id: receipt.id,
    p_pdf_path: path,
  })
  if (attachError) throw attachError
  return path
}

// Emite o recibo. Devolve { receipt, pdfError }: receipt é a linha gravada
// (sempre presente se a RPC deu certo); pdfError, se o PDF não foi salvo.
export async function issueReceipt({ studentId, type, snapshot, signatureBytes }) {
  const { data, error } = await supabase.rpc('issue_insurance_receipt', {
    p_student_id: studentId,
    p_type: type,
    p_snapshot: snapshot,
    p_treatments: snapshot.treatments,
    p_products: snapshot.products,
  })
  if (error) throw error

  const issued = { id: data.id, receipt_number: data.receipt_number, pdf_path: null }
  try {
    const receipt = await fetchReceipt(data.id)
    const pdfPath = await ensureReceiptPdf(receipt, signatureBytes)
    return { receipt: { ...receipt, pdf_path: pdfPath }, pdfError: null }
  } catch (pdfError) {
    return { receipt: issued, pdfError }
  }
}

export async function voidReceipt(receiptId, reason) {
  const { error } = await supabase.rpc('void_insurance_receipt', {
    p_receipt_id: receiptId,
    p_reason: reason,
  })
  if (error) throw error
}

// URL assinada de 60 s com o nome do arquivo = número do recibo.
export async function downloadReceipt(receipt) {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(receipt.pdf_path, 60, { download: `${receipt.receipt_number}.pdf` })
  if (error || !data?.signedUrl) throw error || new Error('signed url failed')
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
