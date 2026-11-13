// Ajuda dos testes de recibo (não é um arquivo de teste).
import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib'

// Textos desenhados na página: strings <hex> do conteúdo da página e das
// aparências dos campos (viram XObjects no flatten), em latin1.
export async function drawnTexts(bytes) {
  const doc = await PDFDocument.load(bytes)
  const page = doc.getPage(0)
  const streams = []
  const contents = page.node.Contents()
  for (const ref of contents instanceof PDFArray ? contents.asArray() : [contents]) {
    streams.push(ref instanceof PDFRef ? doc.context.lookup(ref) : ref)
  }
  const xobjects = page.node.Resources().lookup(PDFName.of('XObject'))
  for (const [, ref] of xobjects ? xobjects.entries() : []) streams.push(doc.context.lookup(ref))
  const texts = []
  for (const obj of streams) {
    if (!(obj instanceof PDFRawStream)) continue
    if (String(obj.dict.get(PDFName.of('Subtype'))) === '/Image') continue
    const content = new TextDecoder('latin1').decode(decodePDFRawStream(obj).decode())
    for (const m of content.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
      const hex = m[1].replace(/\s/g, '')
      texts.push(String.fromCharCode(...hex.match(/../g).map(h => parseInt(h, 16))))
    }
  }
  return texts
}
