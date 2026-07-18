import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

const WHATSAPP_NUMBER = '14382748396'
const WEEKDAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]

const DAY_LABEL_KEYS = {
  0: 'studioHome.schedule.days.sun',
  1: 'studioHome.schedule.days.mon',
  2: 'studioHome.schedule.days.tue',
  3: 'studioHome.schedule.days.wed',
  4: 'studioHome.schedule.days.thu',
  5: 'studioHome.schedule.days.fri',
  6: 'studioHome.schedule.days.sat',
}

const buildWhatsAppLink = (dayLabel, startTime, modality, modalityLabel, t) => {
  const time = startTime ? startTime.substring(0, 5) : ''
  const msg = encodeURIComponent(
    t('studioHome.schedule.cta.waMessage', { modality: modalityLabel, day: dayLabel, time })
  )
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`
}

const formatTime = (time) => (time ? time.substring(0, 5) : '')

const pill = {
  aberta:      { bg: '#e9f8f4', color: '#019a7a', dot: '#01b48d' },
  ultima_vaga: { bg: '#fbf1de', color: '#c79a4b', dot: '#c79a4b' },
  lotada:      { bg: '#fbecea', color: '#c65b4a', dot: '#c65b4a' },
}

const CSS = `
  @keyframes sched-spin { to { transform: rotate(360deg) } }

  .sched-section { width: 100%; }

  /* ── CARD GRID ── */
  .sched-grid {
    max-width: 640px;
    margin: 20px auto 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ── CARD ── */
  .sched-card {
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e6e8e2);
    border-radius: 16px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 2px 8px rgba(22,34,29,.04);
    transition: box-shadow .15s;
  }
  .sched-card:hover { box-shadow: 0 8px 24px rgba(22,34,29,.08); }
  .sched-card.lot { opacity: .88; }
  .sched-card.sched-hl {
    border-color: #f0dfb8;
    background: #fffdf7;
  }
  .dark .sched-card.sched-hl {
    border-color: #3a4830;
    background: #1e2b22;
  }

  /* ── CARD ROWS ── */
  .sched-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sched-time {
    font-family: var(--serif, Fraunces, serif);
    font-size: 22px;
    color: var(--ink, #16221d);
  }
  .sched-time small {
    font-family: var(--font, 'Hanken Grotesk', sans-serif);
    font-size: 11px;
    color: var(--ink-3, #8a958f);
    font-weight: 600;
    margin-left: 5px;
  }
  .sched-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 20px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .sched-pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .sched-mid {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sched-badge {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 8px;
    background: var(--sand-2, #efe9dd);
    color: var(--ink-2, #4d5a54);
  }
  .sched-note {
    font-size: 11.5px;
    color: var(--ink-3, #8a958f);
    line-height: 1.5;
  }

  /* ── BUTTONS ── */
  .sched-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    border-radius: 10px;
    text-decoration: none;
    font-family: var(--font, 'Hanken Grotesk', sans-serif);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
    transition: background .15s;
    margin-top: auto;
  }
  .sched-btn-primary {
    background: #01b48d;
    color: #fff;
    border: none;
  }
  .sched-btn-primary:hover { background: #019a7a; }
  .sched-btn-outline {
    background: var(--sand-2, #efe9dd);
    color: var(--ink-2, #4d5a54);
    border: 1px solid var(--line-2, #ddd8ce);
  }
  .sched-btn-outline:hover { background: var(--sand-2, #efe9dd); filter: brightness(.93); }
  .dark .sched-btn-outline {
    background: #192320;
    color: #c6ceca;
    border-color: #2b3b34;
    transition: none;
  }
  .dark .sched-btn-outline:hover { background: #192320; filter: brightness(1.12); }

  /* ── DAY TABS ── */
  .sched-days {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 20px 0 8px;
    scrollbar-width: none;
    justify-content: center;
    flex-wrap: wrap;
  }
  .sched-day-btn {
    flex-shrink: 0;
    padding: 9px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all .15s;
    position: relative;
  }

  /* ── DESKTOP ≥768px ── */
  @media (min-width: 768px) {
    .sched-grid {
      display: grid;
      gap: 20px;
      margin: 32px auto 0;
    }
    .sched-card {
      min-width: 0;
      box-sizing: border-box;
      padding: 22px;
      gap: 14px;
    }
    /* card órfão (4º, 7º…) centra na coluna do meio */
    .sched-card:last-child:nth-child(3n+1):not(:first-child) {
      grid-column: 2;
    }
    .sched-time { font-size: 26px; }
    .sched-days { padding: 28px 0 12px; gap: 10px; }
    .sched-day-btn { padding: 10px 20px; font-size: 13.5px; }
    .sched-btn { font-size: 13.5px; padding: 11px 16px; }
  }
`

export default function ScheduleSection() {
  const { t } = useTranslation()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const todayWeekday = new Date().getDay()
  const [activeDay, setActiveDay] = useState(todayWeekday)

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const { data, error: err } = await supabase
          .from('schedule_slots')
          .select('id,weekday,start_time,duration_min,modality,status,note')
          .eq('visibility', 'publicada')
          .order('weekday')
          .order('start_time')
        if (err) throw err
        setSlots(data || [])
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchSlots()
  }, [])

  const daysWithSlots = WEEKDAYS_ORDER.filter(d => slots.some(s => s.weekday === d))

  const effectiveDay = daysWithSlots.includes(activeDay)
    ? activeDay
    : (daysWithSlots[0] ?? todayWeekday)

  const daySlots = slots
    .filter(s => s.weekday === effectiveDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const gridCols = Math.min(daySlots.length, 3)
  const gridMaxW = gridCols === 1 ? 380 : gridCols === 2 ? 720 : 1060

  if (loading) {
    return (
      <section id="schedule" className="sec sched-section">
        <style>{CSS}</style>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid #01b48d', borderTopColor: 'transparent',
            animation: 'sched-spin 0.8s linear infinite',
          }} />
        </div>
      </section>
    )
  }

  if (error || slots.length === 0) return null

  return (
    <section id="schedule" className="sec sched-section">
      <style>{CSS}</style>

      {/* Header */}
      <div className="sec-head center">
        <div className="eyebrow">{t('studioHome.schedule.eyebrow')}</div>
        <h2 style={{ fontFamily: 'var(--serif, Fraunces, serif)', fontWeight: 500, fontSize: 'clamp(26px,4vw,38px)', lineHeight: 1.15 }}>
          {t('studioHome.schedule.title')}{' '}
          <em style={{ fontStyle: 'italic', color: '#017a6b' }}>
            {t('studioHome.schedule.titleAccent')}
          </em>
        </h2>
        <p style={{ color: 'var(--ink-2,#4d5a54)', maxWidth: 520, margin: '0 auto' }}>
          {t('studioHome.schedule.subtitle')}
        </p>
      </div>

      {/* Day tabs */}
      <div className="sched-days">
        {daysWithSlots.map(d => {
          const isToday = d === todayWeekday
          const isActive = d === effectiveDay
          return (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className="sched-day-btn"
              style={{
                border: isActive ? 'none' : '1px solid var(--line, #e7e9e3)',
                background: isActive ? '#01b48d' : 'var(--paper, #fff)',
                color: isActive ? '#fff' : 'var(--ink-2, #4d5a54)',
              }}
            >
              {t(DAY_LABEL_KEYS[d])}
              {isToday && (
                <span style={{
                  position: 'absolute', bottom: -7, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 5, height: 5, borderRadius: '50%',
                  background: isActive ? 'rgba(255,255,255,.7)' : '#01b48d',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Card grid — repeat(N, 1fr) garante colunas iguais sem min-width:auto */}
      <div
        className="sched-grid"
        style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, maxWidth: gridMaxW }}
      >
        {daySlots.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-3,#8a958f)', padding: '32px 0', fontSize: 14, width: '100%' }}>
            {t('studioHome.schedule.emptyDay')}
          </p>
        ) : (
          daySlots.map(slot => {
            const statusPill = pill[slot.status] || pill.aberta
            const modalityLabel = t(`studioHome.schedule.modality.${slot.modality}`)
            const dayLabel = t(DAY_LABEL_KEYS[effectiveDay])
            const waLink = buildWhatsAppLink(dayLabel, slot.start_time, slot.modality, modalityLabel, t)
            const isLotada = slot.status === 'lotada'
            const isUltima = slot.status === 'ultima_vaga'

            return (
              <div
                key={slot.id}
                className={`sched-card${isLotada ? ' lot' : ''}${isUltima ? ' sched-hl' : ''}`}
              >
                <div className="sched-top">
                  <span className="sched-time">
                    {formatTime(slot.start_time)}
                    <small>{slot.duration_min}min</small>
                  </span>
                  <span
                    className="sched-pill"
                    style={{ background: statusPill.bg, color: statusPill.color }}
                  >
                    <span className="sched-pill-dot" style={{ background: statusPill.dot }} />
                    {t(`studioHome.schedule.status.${slot.status}`)}
                  </span>
                </div>

                <div className="sched-mid">
                  <span className="sched-badge">{modalityLabel}</span>
                  {slot.note && <span className="sched-note">{slot.note}</span>}
                </div>

                <p className="sched-note" style={{ margin: 0, minHeight: 32 }}>
                  {isLotada ? t('studioHome.schedule.cta.lotadaNote') : ''}
                </p>

                {isLotada ? (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="sched-btn sched-btn-outline">
                    {t('studioHome.schedule.cta.ask')}
                  </a>
                ) : (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="sched-btn sched-btn-primary">
                    {t('studioHome.schedule.cta.book')}
                  </a>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
