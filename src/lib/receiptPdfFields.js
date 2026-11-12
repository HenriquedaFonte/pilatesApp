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
  },
}
