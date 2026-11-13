import React, { useState } from 'react'
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '../lib/i18n'
import ContentStep from '../components/emails/ContentStep'
import ReviewStep from '../components/emails/ReviewStep'
import { emptyContent, buildCustomEmail } from '../lib/customEmail'
import { templateContent } from '../lib/templateCards'

beforeAll(() => i18n.changeLanguage('pt'))

const Harness = ({ initial }) => {
  const [content, setContent] = useState(initial)
  const [lang, setLang] = useState('pt')
  return (
    <ContentStep
      uiLanguage="pt"
      templateId="blank"
      onSelectTemplate={() => {}}
      editLanguage={lang}
      setEditLanguage={setLang}
      senderName="Josi"
      setSenderName={() => {}}
      content={content}
      onContentChange={(l, f, v) => setContent(p => ({ ...p, [l]: { ...p[l], [f]: v } }))}
      languageCounts={{ pt: 2, en: 1, fr: 0 }}
    />
  )
}

describe('passo 2: abas por língua e variáveis', () => {
  it('mostra os 6 modelos, troca de aba, sem botões de variável e avisa língua vazia', () => {
    render(<Harness initial={emptyContent()} />)
    expect(screen.getByText('Aviso geral')).toBeTruthy()
    expect(screen.getByText('Créditos zerados')).toBeTruthy()
    expect(screen.queryByText('Promoção')).toBeNull()

    fireEvent.change(screen.getByLabelText(/Assunto/), { target: { value: 'Oi' } })
    const message = screen.getByLabelText(/Mensagem/)
    fireEvent.change(message, { target: { value: 'Olá turma' } })
    expect(message.value).toBe('Olá turma')
    // Sem botões de inserir {nome}/{creditos}: a saudação e a assinatura entram sozinhas.
    expect(screen.queryByRole('button', { name: /\{nome\}|\{creditos\}/ })).toBeNull()
    expect(screen.getByText('"Olá, Nome!" e a assinatura entram sozinhos.')).toBeTruthy()

    expect(screen.getByText(/1 aluno em EN vai receber o texto em PT/)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /EN/ }))
    expect(screen.getByLabelText(/Mensagem \(EN\)/).value).toBe('')
  })

  it('variável desconhecida gera aviso', () => {
    render(<Harness initial={templateContent('scheduleChangeNotice')} />)
    expect(screen.getByText(/entre chaves vão sair no email/)).toBeTruthy()
  })
})

describe('passo 3: pré-visualização', () => {
  it('mostra o assunto, o email em iframe e o botão de teste', () => {
    const student = { id: 's1', full_name: 'Bob Smith', preferred_language: 'en', totalCredits: 2 }
    const content = templateContent('profileUpdate')
    const built = buildCustomEmail({ student, content, senderName: 'Josi', language: 'en' })
    render(
      <ReviewStep
        recipients={[student]}
        groupLabel="Todos"
        templateLabel="Atualizar cadastro"
        isCustom
        content={content}
        unknown={[]}
        senderName="Josi"
        automaticNote=""
        previewProps={{
          recipients: [student],
          previewStudentId: 's1',
          onPreviewStudentChange: () => {},
          previewLanguage: 'en',
          setPreviewLanguage: () => {},
          preview: { language: 'en', subject: built.subject, html: built.htmlContent },
          teacherEmail: 'josi@exemplo.com',
          onSendTest: () => {},
          testState: { sending: false, ok: false, error: '' }
        }}
        sending={false}
        progress={null}
        result={null}
        onSend={() => {}}
        onNewMessage={() => {}}
      />
    )
    expect(screen.getAllByText('Please update your Josi Pilates profile').length).toBeGreaterThan(0)
    expect(document.querySelector('iframe').getAttribute('srcdoc')).toContain('Hello, Bob Smith!')
    expect(screen.getByRole('button', { name: /Mandar teste para mim/ })).toBeTruthy()
    expect(screen.getByText(/josi@exemplo.com/)).toBeTruthy()
  })
})
