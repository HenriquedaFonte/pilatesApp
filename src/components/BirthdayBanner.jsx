import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Cake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  isBirthdayBannerDismissed,
  dismissBirthdayBanner
} from '../lib/birthdays'

// Faixa de aniversários próximos (tela inicial e Alunos da professora).
// O "ocultar até amanhã" vale para as duas telas.
const BirthdayBanner = ({ birthdays, className = '' }) => {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const idsKey = (birthdays || []).map(b => b.id).join(',')

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    setVisible(ids.length > 0 && !isBirthdayBannerDismissed(ids))
  }, [idsKey])

  if (!visible) return null

  const when = daysUntil =>
    daysUntil === 0
      ? t('teacher.students.birthdays.today')
      : daysUntil === 1
        ? t('teacher.students.birthdays.tomorrow')
        : t('teacher.students.birthdays.inDays', { count: daysUntil })

  const handleDismiss = () => {
    dismissBirthdayBanner(birthdays.map(b => b.id))
    setVisible(false)
  }

  return (
    <div
      role="status"
      className={`rounded-2xl border border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-4 py-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <Cake className="h-4 w-4 shrink-0" />
          {t('teacher.students.birthdays.title')}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-7 -mr-2 -mt-1 px-2 text-xs text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
        >
          {t('teacher.students.birthdays.dismiss')}
        </Button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {birthdays.map(student => (
          <li key={student.id}>
            <Link
              to={`/teacher/student-summary/${student.id}`}
              className="inline-block rounded-full bg-background/80 dark:bg-background/40 border border-emerald-200/60 dark:border-emerald-900/40 px-3 py-1 text-xs hover:border-emerald-400 transition-colors"
            >
              <span className="font-medium text-foreground">
                {student.full_name}
              </span>
              <span className="text-muted-foreground">
                {' · '}
                {when(student.daysUntil)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default BirthdayBanner
