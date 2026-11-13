import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, Search, Users, Undo2 } from 'lucide-react'
import {
  countByLanguage,
  searchStudents,
  studentLanguage,
  LANGUAGES
} from '../../lib/emailRecipients'

const GROUPS = ['all', 'low_credits', 'zero_credits', 'class', 'selected']

const StudentRow = ({ student, children, muted = false }) => {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {children?.[0]}
      <div className={`min-w-0 flex-1 ${muted ? 'opacity-50' : ''}`}>
        <div className={`text-sm font-semibold text-foreground truncate ${muted ? 'line-through' : ''}`}>
          {student.full_name}
        </div>
        <div className="text-xs text-muted-foreground truncate">{student.email}</div>
      </div>
      <div className={`hidden sm:flex items-center gap-1.5 shrink-0 ${muted ? 'opacity-50' : ''}`}>
        {student.is_active === false && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">
            {t('teacher.emails.recipients.inactiveBadge')}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md uppercase">
          {studentLanguage(student)}
        </Badge>
        <span className="text-xs text-muted-foreground w-20 text-right">
          {t('teacher.emails.recipients.credits', { count: student.totalCredits })}
        </span>
      </div>
      {children?.[1]}
    </div>
  )
}

const RecipientsStep = ({
  recipients,
  groupStudents,
  visibleStudents,
  filterType,
  onFilterTypeChange,
  lowCreditsThreshold,
  setLowCreditsThreshold,
  classes,
  selectedClass,
  setSelectedClass,
  classLoading,
  classStudentIds,
  includeInactive,
  setIncludeInactive,
  inactiveCount,
  selectedIds,
  setSelectedIds,
  excludedIds,
  setExcludedIds,
  search,
  setSearch
}) => {
  const { t } = useTranslation()
  const languages = countByLanguage(recipients)
  const manual = filterType === 'selected'
  const listSource = manual ? visibleStudents : groupStudents
  const rows = searchStudents(listSource, search)
  const excluded = new Set(excludedIds)
  const selected = new Set(selectedIds)

  const toggleExcluded = id =>
    setExcludedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  const toggleSelected = id =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  // Uma regra só para todas as listas: caixa marcada = recebe.
  // Em "Escolher alunos" ninguém começa marcado; nos grupos, todos começam marcados.
  const isChecked = id => (manual ? selected.has(id) : !excluded.has(id))
  const toggleRow = id => (manual ? toggleSelected(id) : toggleExcluded(id))
  const allRowsChecked = rows.length > 0 && rows.every(s => isChecked(s.id))
  const toggleAllRows = () => {
    const rowIds = rows.map(s => s.id)
    if (manual) {
      setSelectedIds(prev =>
        allRowsChecked
          ? prev.filter(id => !rowIds.includes(id))
          : [...new Set([...prev, ...rowIds])]
      )
    } else {
      setExcludedIds(prev =>
        allRowsChecked
          ? [...new Set([...prev, ...rowIds])]
          : prev.filter(id => !rowIds.includes(id))
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t('teacher.emails.recipients.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('teacher.emails.recipients.desc')}
        </p>
      </div>

      {/* Grupos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {GROUPS.map(group => (
          <button
            key={group}
            type="button"
            onClick={() => onFilterTypeChange(group)}
            aria-pressed={filterType === group}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold min-h-[48px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              filterType === group
                ? 'border-primary ring-1 ring-primary bg-primary/5 text-foreground'
                : 'border-border bg-background hover:bg-muted/40 text-foreground'
            }`}
          >
            {t(`teacher.emails.recipients.groups.${group}`)}
          </button>
        ))}
      </div>

      {filterType === 'low_credits' && (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="threshold" className="text-sm text-muted-foreground">
            {t('teacher.emails.recipients.thresholdLabel')}
          </Label>
          <Input
            id="threshold"
            type="number"
            inputMode="numeric"
            min="0"
            max="50"
            value={lowCreditsThreshold}
            onChange={e => setLowCreditsThreshold(parseInt(e.target.value) || 0)}
            className="w-20 rounded-lg h-10"
          />
          <span className="text-sm text-muted-foreground">
            {t('teacher.emails.recipients.thresholdUnit')}
          </span>
        </div>
      )}

      {filterType === 'class' && (
        <div className="space-y-2 max-w-md">
          <Label className="text-sm text-muted-foreground">
            {t('teacher.emails.recipients.selectClass')}
          </Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="rounded-xl h-11 w-full">
              <SelectValue placeholder={t('teacher.emails.recipients.selectClassPlaceholder')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>
                  <span className="font-medium">{cls.label}</span>
                  <span className="text-muted-foreground">
                    {cls.type ? ` · ${cls.type}` : ''}
                    {' · '}
                    {t('teacher.emails.recipients.classStudents', { count: cls.count })}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {classLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('teacher.emails.recipients.loadingClass')}
            </p>
          )}
          {!classLoading && selectedClass && classStudentIds && classStudentIds.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t('teacher.emails.recipients.emptyClass')}
            </p>
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="include-inactive"
          checked={includeInactive}
          onCheckedChange={checked => setIncludeInactive(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="include-inactive" className="text-sm text-muted-foreground cursor-pointer leading-snug">
          {t('teacher.emails.includeInactive', { count: inactiveCount })}
        </Label>
      </div>

      {/* Contagem e línguas */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">
            {t('teacher.emails.recipients.count', { count: recipients.length })}
          </span>
        </div>
        {recipients.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {LANGUAGES.map(lang => `${lang.toUpperCase()} ${languages[lang]}`).join(' · ')}
          </div>
        )}
        {!manual && excludedIds.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExcludedIds([])}
            className="sm:ml-auto h-9 text-xs"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
            {t('teacher.emails.recipients.restoreAll', { count: excludedIds.length })}
          </Button>
        )}
      </div>

      {/* Lista com busca */}
      {(manual || (filterType !== 'class' || selectedClass)) && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t('teacher.emails.recipients.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 rounded-xl h-11 w-full"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={toggleAllRows}
              disabled={rows.length === 0}
              className="rounded-xl h-11"
            >
              {allRowsChecked
                ? t('teacher.emails.recipients.clearAll')
                : t('teacher.emails.recipients.selectAll')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {manual
              ? t('teacher.emails.recipients.selectHint')
              : t('teacher.emails.recipients.groupHint')}
          </p>

          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border divide-y divide-border/60 bg-background">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">
                {search
                  ? t('teacher.emails.recipients.emptySearch')
                  : t('teacher.emails.recipients.empty')}
              </p>
            ) : (
              rows.map(student => {
                const checked = isChecked(student.id)
                return (
                  <label
                    key={student.id}
                    htmlFor={`pick-${student.id}`}
                    className="block cursor-pointer hover:bg-muted/30"
                  >
                    <StudentRow student={student} muted={!manual && !checked}>
                      <Checkbox
                        id={`pick-${student.id}`}
                        checked={checked}
                        onCheckedChange={() => toggleRow(student.id)}
                        className="h-5 w-5"
                      />
                      {null}
                    </StudentRow>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecipientsStep
