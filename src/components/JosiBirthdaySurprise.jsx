import { useEffect, useState } from 'react'

// Surpresa de aniversário da Josi (45 anos), pedida pelo Henrique.
// Só aparece em 18/11/2026 (horário de Montreal), na tela de check-in,
// uma vez por hora. Some sozinha à meia-noite. Remover depois em outro PR.
// Texto só em português, a pedido do usuário (mensagem pessoal).

const BIRTHDAY = '2026-11-18'
const TIME_ZONE = 'America/Montreal'
const STORAGE_PREFIX = 'josi-bday-2026-seen-'

const montrealNow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date())
  const get = type => parts.find(p => p.type === type)?.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: get('hour')
  }
}

const seenThisHour = hour => {
  try {
    return localStorage.getItem(STORAGE_PREFIX + hour) === '1'
  } catch {
    return false
  }
}

const markSeen = hour => {
  try {
    localStorage.setItem(STORAGE_PREFIX + hour, '1')
  } catch {
    // sem localStorage: aparece de novo ao recarregar, tudo bem
  }
}

// "Parabéns pra você" (melodia tradicional), em batidas de 3/4.
const G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33
const E5 = 659.25, F5 = 698.46, G5 = 783.99
const MELODY = [
  [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
  [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
  [G4, 0.75], [G4, 0.25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2],
  [F5, 0.75], [F5, 0.25], [E5, 1], [C5, 1], [D5, 1], [C5, 3]
]

const playSong = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return 0
  const ctx = new AudioCtx()
  const beat = 0.5
  let t = ctx.currentTime + 0.1
  MELODY.forEach(([freq, beats]) => {
    const dur = beats * beat
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur)
    t += dur
  })
  const total = t - ctx.currentTime
  setTimeout(() => {
    try {
      ctx.close()
    } catch {
      // ignora
    }
  }, (total + 0.5) * 1000)
  return total
}

const FLOWERS = ['🌸', '🌷', '🌹', '🌺', '🌼', '💐', '🎉', '🎈']

const JosiBirthdaySurprise = () => {
  const [hour, setHour] = useState(null)
  const [opened, setOpened] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    // Qualquer erro aqui só faz a surpresa não aparecer; nunca derruba a tela.
    const check = () => {
      try {
        const now = montrealNow()
        if (now.date === BIRTHDAY && !seenThisHour(now.hour)) {
          setHour(current => current ?? now.hour)
        }
      } catch {
        // ignora
      }
    }
    check()
    const id = setInterval(check, 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (hour === null) return null

  const handlePlay = () => {
    setOpened(true)
    let seconds = 0
    try {
      seconds = playSong()
    } catch {
      seconds = 0
    }
    if (seconds > 0) {
      setPlaying(true)
      setTimeout(() => setPlaying(false), seconds * 1000)
    }
  }

  const handleClose = () => {
    markSeen(hour)
    setHour(null)
    setOpened(false)
    setPlaying(false)
  }

  const petals = Array.from({ length: 40 }, (_, i) => ({
    emoji: FLOWERS[i % FLOWERS.length],
    left: (i * 37) % 100,
    delay: (i * 0.37) % 6,
    duration: 5 + ((i * 1.3) % 5),
    size: 24 + ((i * 7) % 28)
  }))

  return (
    <div
      role="dialog"
      aria-label="Feliz aniversário, Josianinha!"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 40%, #fff1f5 0%, #fbcfe8 55%, #f9a8d4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <style>{`
        @keyframes josiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0.9; }
        }
        @keyframes josiPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>

      {petals.map((p, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            fontSize: p.size,
            animation: `josiFall ${p.duration}s linear ${p.delay}s infinite`,
            pointerEvents: 'none'
          }}
        >
          {p.emoji}
        </span>
      ))}

      <div
        style={{
          position: 'relative',
          maxWidth: 560,
          width: '100%',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.88)',
          borderRadius: 28,
          padding: '32px 24px',
          boxShadow: '0 20px 60px rgba(190, 24, 93, 0.25)',
          color: '#831843'
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            fontSize: 28,
            lineHeight: 1,
            border: 'none',
            background: 'transparent',
            color: '#9d174d',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
        <div style={{ fontSize: 64, lineHeight: 1 }}>💐</div>
        <h2
          style={{
            fontSize: 'clamp(28px, 6vw, 44px)',
            fontWeight: 800,
            margin: '16px 0 8px',
            animation: 'josiPulse 2s ease-in-out infinite'
          }}
        >
          Parabéns, Josianinha!
        </h2>
        <p style={{ fontSize: 'clamp(20px, 4vw, 28px)', margin: '0 0 8px' }}>
          Feliz 45 anos! 🎂
        </p>
        <p style={{ fontSize: 18, margin: '0 0 24px', color: '#9d174d' }}>
          Que seu dia seja tão lindo quanto você! 💗
        </p>

        {!opened ? (
          <button
            type="button"
            onClick={handlePlay}
            style={{
              fontSize: 24,
              fontWeight: 700,
              padding: '16px 32px',
              borderRadius: 999,
              border: 'none',
              background: '#db2777',
              color: '#fff',
              cursor: 'pointer',
              animation: 'josiPulse 1.4s ease-in-out infinite'
            }}
          >
            🎁 Toque aqui
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={handlePlay}
              disabled={playing}
              style={{
                fontSize: 18,
                padding: '12px 24px',
                borderRadius: 999,
                border: '2px solid #db2777',
                background: '#fff',
                color: '#db2777',
                cursor: playing ? 'default' : 'pointer',
                opacity: playing ? 0.6 : 1
              }}
            >
              {playing ? '🎶 Tocando...' : '🎶 Tocar de novo'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={{
                fontSize: 18,
                padding: '12px 24px',
                borderRadius: 999,
                border: 'none',
                background: '#db2777',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Fechar 💗
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default JosiBirthdaySurprise
