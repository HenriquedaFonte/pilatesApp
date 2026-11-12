// Abrir, baixar e compartilhar o PDF de um recibo já gravado (Stories 3.5 e 3.6).
// Separado de receiptService.js para o portal do aluno não carregar o gerador
// de PDF (pdf-lib + templates). Permissões: RLS do bucket (aluno só lê a
// própria pasta; professora lê tudo).

import { supabase } from './supabase'
import { receiptFileName } from './receipts'

export const RECEIPTS_BUCKET = 'insurance-receipts'

// URL assinada de 60 s com o nome do arquivo = número do recibo.
export async function downloadReceipt(receipt) {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(receipt.pdf_path, 60, { download: receiptFileName(receipt) })
  if (error || !data?.signedUrl) throw error || new Error('signed url failed')
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// iPhone/iPad (Story 3.6): abre o PDF no visualizador do Safari, que tem o botão
// de compartilhar (Arquivos, Mail, imprimir). URL assinada de 60 s sem
// "download" (o Supabase serve inline). A aba é aberta já no toque, antes de
// qualquer await: aberta depois, o Safari a bloquearia como pop-up.
export async function openReceiptPdf(receipt) {
  const win = window.open('', '_blank')
  try {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(receipt.pdf_path, 60)
    if (error || !data?.signedUrl) throw error || new Error('signed url failed')
    if (win) {
      win.opener = null
      win.location.href = data.signedUrl
    } else {
      window.location.assign(data.signedUrl)
    }
  } catch (err) {
    if (win) win.close()
    throw err
  }
}

// Baixa o PDF (RLS do bucket: o aluno só lê a própria pasta) e devolve um File
// com o nome = número do recibo, para o Web Share.
export async function fetchReceiptFile(receipt) {
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).download(receipt.pdf_path)
  if (error || !data) throw error || new Error('download failed')
  return new File([data], receiptFileName(receipt), { type: 'application/pdf' })
}

export function canShareFile(file) {
  try {
    return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }))
  } catch {
    return false
  }
}
