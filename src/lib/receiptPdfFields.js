// Mapeamento dos campos AcroForm dos formulários oficiais da CPMDQ
// (src/assets/receipt-templates/). Conferido pela posição de cada campo no
// PDF (Story 3.4). Os nomes não seguem a ordem visual: não "simplificar".
//
// Linhas de tratamento: coluna esquerda de cima para baixo (linhas 1 a 5),
// depois coluna direita. O mesmo vale para os produtos (naturopathie).

const COMMON = {
  holderFullName: 'Text1',
  holderCityProvince: 'Text2',
  holderEmployer: 'Text3',
  holderOccupation: 'Text4',
  holderPhoneWork: 'Text5',
  holderPhoneHome: 'Text6',
  patientFullName: 'Text7',
  patientDateOfBirth: 'Text8',
  policyNumber: 'Text9',
}

export const RECEIPT_FIELDS = {
  kinesitherapy: {
    template: 'kinesitherapie',
    letter: 'K',
    ...COMMON,
    // [linha] = [data, valor]; 0–4 coluna esquerda, 5–9 coluna direita
    treatments: [
      ['Text10', 'Text11'],
      ['Text15', 'Text16'],
      ['Text19', 'Text20'],
      ['Text23', 'Text24'],
      ['Text27', 'Text28'],
      ['Text13', 'Text14'],
      ['Text17', 'Text18'],
      ['Text21', 'Text22'],
      ['Text25', 'Text26'],
      ['Text29', 'Text30'],
    ],
    products: [],
    totalProducts: null,
    consultationsCount: 'Text31',
    totalFees: 'Text32',
    practitionerName: 'Text33',
    practitionerLicense: 'Text34',
    signature: 'Text12',
    signatureDate: 'Text35',
    // Assinatura (pt, de baixo para cima): a linha média dela fica em `line`
    // (a linha impressa do formulário); a imagem vai de `bottom` a `top`
    // (embaixo do "Nom/Name"). Aqui o rodapé da CPMDQ fica a só ~11 pt da
    // linha: o traço que desce pode passar por cima da 1ª linha do rodapé,
    // como numa assinatura à mão (decisão do usuário, 2026-11-13).
    // Medido no template. A largura continua a do campo; altura até maxHeight.
    // lift 3 pt (~1 mm): pedido do usuário depois de ver a prévia.
    signatureLayout: { line: 97.3, lift: 3, bottom: 72, top: 138, maxHeight: 44 },
  },
  naturopathy: {
    template: 'naturopathie',
    letter: 'N',
    ...COMMON,
    treatments: [
      ['Text10', 'Text11'],
      ['Text14', 'Text19'],
      ['Text22', 'Text23'],
      ['Text26', 'Text27'],
      ['Text30', 'Text31'],
      ['Text12', 'Text13'],
      ['Text20', 'Text21'],
      ['Text24', 'Text25'],
      ['Text28', 'Text29'],
      ['Text32', 'Text33'],
    ],
    // [linha] = [nome, preço]; 0–1 coluna esquerda, 2–3 coluna direita
    products: [
      ['Text34', 'Text35'],
      ['Text38', 'Text39'],
      ['Text36', 'Text37'],
      ['Text40', 'Text41'],
    ],
    totalProducts: 'Text42',
    consultationsCount: 'Text43',
    totalFees: 'Text44',
    practitionerName: 'Text45',
    practitionerLicense: 'Text46',
    signature: 'Text47',
    signatureDate: 'Text48',
    // Sem linha impressa: `line` é a base do texto "Signature:"; `bottom` fica
    // acima do rodapé da CPMDQ.
    signatureLayout: { line: 85.5, bottom: 61, top: 104, maxHeight: 44 },
    // Nome e licença da praticante 2 mm (5,67 pt) mais baixos: no template o
    // texto ficava acima da base do rótulo (pedido do usuário, 2026-11-13).
    // O topo da assinatura (top) desceu junto, para não encostar no nome.
    practitionerOffsetY: -5.67,
  },
}
