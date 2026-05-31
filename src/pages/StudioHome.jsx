import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MapPin,
  Award,
  Sparkles,
  Heart,
  User,
  Users,
  Calendar,
  ArrowRight,
  Lock,
  Globe,
  Instagram,
  Facebook,
  Check,
  Star
} from 'lucide-react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel'
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import emailService from '../lib/emailService'

// Dynamic asset imports
import capa1Image from '../assets/capa1.avif' // hero-studio.avif
import capa2Image from '../assets/capa2.avif' // studio-2.avif
import capa3Image from '../assets/capa3.jpg'
import instructorImage from '../assets/instructor-photo.jpg.avif' // josi-portrait.avif
import contactPhoto from '../assets/contactPhoto.avif' // josi-contact.avif

// Custom WhatsApp SVG Icon matching mockup path
const WhatsAppIcon = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.5 8.5c-.3 1.5.5 3.5 2 5s3.5 2.3 5 2c.6-.1 1-1 .8-1.5l-1.8-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-1.8c-.5-.2-1.3.1-1.4.6z"
    />
  </svg>
)

const StudioHome = () => {
  const { t, i18n } = useTranslation()
  const { user, profile, isProfileComplete } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: ''
  })
  const [contactFormSubmitting, setContactFormSubmitting] = useState(false)
  const [contactFormSuccess, setContactFormSuccess] = useState(false)
  const [contactFormError, setContactFormError] = useState('')
  const [currentHeroImage, setCurrentHeroImage] = useState(0)
  const [testimonialsApi, setTestimonialsApi] = useState(null)
  const [autoAdvancePaused, setAutoAdvancePaused] = useState(false)
  const [testimonials, setTestimonials] = useState([])
  const [expandedTestimonials, setExpandedTestimonials] = useState({})
  
  const resumeTimerRef = useRef(null)

  // Fetch testimonials from Supabase (matching original production query exactly)
  useEffect(() => {
    fetchTestimonials()
  }, [i18n.language])

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get static testimonials
      const staticTestimonials =
        t('studioHome.testimonials', { returnObjects: true }) || []

      // Transform database testimonials to match static format with language support
      const transformedDbTestimonials = (data || []).map(testimonial => {
        const parseField = field => {
          if (!field) return ''
          
          // If it is already parsed as an object by Supabase
          if (typeof field === 'object') {
            const val = field[i18n.language] !== undefined ? field[i18n.language] : (
              field.fr !== undefined ? field.fr : (
                field.en !== undefined ? field.en : (
                  field.pt !== undefined ? field.pt : ''
                )
              )
            )
            return val || ''
          }
          
          if (typeof field !== 'string') return field
          
          try {
            let current = field.trim()
            
            // Handle double-serialization quote wrapping if present
            if (current.startsWith('"') && current.endsWith('"')) {
              try {
                current = JSON.parse(current)
              } catch {
                // Keep original if parsing fails
              }
            }
            
            // If parsed to object in step above
            if (current && typeof current === 'object') {
              const val = current[i18n.language] !== undefined ? current[i18n.language] : (
                current.fr !== undefined ? current.fr : (
                  current.en !== undefined ? current.en : (
                    current.pt !== undefined ? current.pt : ''
                  )
                )
              )
              return val || ''
            }
            
            if (typeof current === 'string' && current.startsWith('{')) {
              const parsed = JSON.parse(current)
              if (parsed && typeof parsed === 'object') {
                const val = parsed[i18n.language] !== undefined ? parsed[i18n.language] : (
                  parsed.fr !== undefined ? parsed.fr : (
                    parsed.en !== undefined ? parsed.en : (
                      parsed.pt !== undefined ? parsed.pt : ''
                    )
                  )
                )
                return val || ''
              }
            }
            return field
          } catch {
            return field
          }
        }

        return {
          text: parseField(testimonial.text),
          author_name: parseField(testimonial.author_name),
          city: parseField(testimonial.city),
          state: parseField(testimonial.state),
          id: testimonial.id,
          created_at: testimonial.created_at
        }
      })

      const filteredDbTestimonials = transformedDbTestimonials.filter(
        t => t.text && t.text.trim()
      )
      const combinedTestimonials = [
        ...filteredDbTestimonials,
        ...staticTestimonials
      ]

      setTestimonials(combinedTestimonials)
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching testimonials:', error)
      setTestimonials(
        t('studioHome.testimonials', { returnObjects: true }) || []
      )
    }
  }

  // Hero image rotation (rotates every 7 seconds in background)
  const heroImages = [capa1Image, capa2Image, capa3Image]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroImage(prev => (prev + 1) % heroImages.length)
    }, 7000)

    return () => clearInterval(interval)
  }, [heroImages.length])

  // Testimonials Carousel Autoplay (auto-advance every 6 seconds)
  useEffect(() => {
    if (!testimonialsApi || autoAdvancePaused) return

    const interval = setInterval(() => {
      testimonialsApi.scrollNext()
    }, 6000)

    return () => clearInterval(interval)
  }, [testimonialsApi, autoAdvancePaused])

  // Pause autoplay on click and auto-resume after 10 seconds of inactivity
  const handleTestimonialInteraction = () => {
    setAutoAdvancePaused(true)
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
    }
    resumeTimerRef.current = setTimeout(() => {
      setAutoAdvancePaused(false)
    }, 10000)
  }

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current)
      }
    }
  }, [])

  const changeLanguage = language => {
    i18n.changeLanguage(language)
  }

  // Contact Form Submission logic (matching original production query exactly)
  const handleContactSubmit = async e => {
    e.preventDefault()
    setContactFormSubmitting(true)
    setContactFormError('')
    setContactFormSuccess(false)

    try {
      const fullName = `${contactForm.firstName} ${contactForm.lastName}`.trim()
      const subject = `Contact Form Message from ${fullName}`
      const message = `
New contact form submission:

Name: ${fullName}
Email: ${contactForm.email}

Message:
${contactForm.message}

Sent from Josi Pilates website contact form.
      `

      await emailService.sendEmail({
        to: { email: 'josipilatesmontreal@gmail.com', name: 'Josi Pilates' },
        subject,
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <div style="display: inline-flex; align-items: center; justify-content: center; gap: 30px;">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #01b48d;">JP</div>
                <div style="text-align: left;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
                  <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Contact Form Message</p>
                </div>
              </div>
            </div>

            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1e293b; margin-top: 0;">New Contact Form Submission</h2>

              <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #374151; margin-top: 0;">Contact Details</h3>
                <p style="margin: 5px 0;"><strong>Name:</strong> ${fullName}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${contactForm.email}</p>
              </div>

              <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1e293b; margin-top: 0;">Message</h3>
                <p style="margin: 10px 0; white-space: pre-line;">${contactForm.message.replace(
                  /\n/g,
                  '<br>'
                )}</p>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

              <p style="color: #64748b; font-size: 14px; text-align: center;">
                This message was sent from the Josi Pilates website contact form.
              </p>
            </div>
          </body>
          </html>
        `,
        textContent: message
      })

      setContactFormSuccess(true)
      setContactForm({
        firstName: '',
        lastName: '',
        email: '',
        message: ''
      })
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error sending contact form:', error)
      setContactFormError(
        'Failed to send message. Please try again or contact us directly.'
      )
    } finally {
      setContactFormSubmitting(false)
    }
  }

  // Dashboard routing logic (matching original production rules exactly)
  useEffect(() => {
    if (user && profile && isProfileComplete) {
      if (profile.role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true })
      } else if (profile.role === 'student') {
        navigate('/student/dashboard', { replace: true })
      }
    }
  }, [user, profile, isProfileComplete, navigate])

  // Split-text helper to format italic highlight in headings natively across FR/EN/PT
  const renderHeadingWithItalic = (text, highlight, highlightClass = 'text-[#a3e0d3] font-serif not-italic') => {
    if (!text) return ''
    if (!highlight) return text
    const parts = text.split(highlight)
    if (parts.length < 2) return text
    return (
      <>
        {parts[0]}
        <em className={highlightClass}>{highlight}</em>
        {parts[1]}
      </>
    )
  }

  // Toggle testimonial expanded text state
  const toggleTestimonialExpand = (id) => {
    setExpandedTestimonials(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Initials generator for testimonial avatars
  const getInitials = (name) => {
    if (!name) return 'JP'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].substring(0, 2).toUpperCase()
  }

  return (
    <div className="studio-home-site min-h-screen">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-in">
          <div className="nav-brand">
            <Logo className="h-[38px] w-[38px]" />
            <b>Josi Pilates</b>
          </div>
          <div className="nav-links hidden md:flex">
            <a href="#about">{t('studioHome.nav.about')}</a>
            <a href="#services">{t('studioHome.nav.services')}</a>
            <a href="#testimonials">{t('studioHome.nav.testimonials')}</a>
            <a href="#contact">{t('studioHome.nav.contact')}</a>
          </div>
          <div className="nav-right hidden md:flex">
            <Select onValueChange={changeLanguage} value={i18n.language}>
              <SelectTrigger className="w-[84px] bg-white border border-[#e7e9e3] text-[#1a2420] rounded-full py-1.5 px-3 flex items-center gap-1.5 font-bold text-xs h-[38px] shadow-none outline-none focus:ring-0">
                <Globe className="w-3.5 h-3.5 text-[#8a958f]" />
                <SelectValue placeholder={i18n.language.toUpperCase()} />
              </SelectTrigger>
              <SelectContent className="bg-white border border-[#e7e9e3]">
                <SelectItem value="fr">FR</SelectItem>
                <SelectItem value="en">EN</SelectItem>
                <SelectItem value="pt">PT</SelectItem>
              </SelectContent>
            </Select>
            <ThemeToggle />
            <Link to="/login" className="btn-link">
              {t('studioHome.nav.studentPortal')}
            </Link>
            <a href="#contact" className="btn btn-primary">
              <Calendar className="w-4 h-4" /> {t('studioHome.nav.bookTrial')}
            </a>
          </div>

          {/* Mobile navigation controls */}
          <div className="md:hidden flex items-center gap-3">
            <a href="#contact" className="btn btn-primary text-xs px-4 py-2 font-bold">
              <Calendar className="w-3.5 h-3.5" /> Essai
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 rounded-md text-[#1a2420] focus:outline-none"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#e7e9e3] bg-[#f6f3ec] px-4 py-4 flex flex-col gap-4 shadow-lg text-left">
            <div className="flex justify-between items-center px-2">
              <span className="lang">
                <Globe className="w-4 h-4 text-gray-400" />
                <Select onValueChange={changeLanguage} value={i18n.language}>
                  <SelectTrigger className="border-none p-0 h-auto bg-transparent focus:ring-0 text-sm font-semibold uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">FR</SelectItem>
                    <SelectItem value="en">EN</SelectItem>
                    <SelectItem value="pt">PT</SelectItem>
                  </SelectContent>
                </Select>
              </span>
              <ThemeToggle />
              <Link
                to="/login"
                className="btn-link text-sm font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('studioHome.nav.studentPortal')}
              </Link>
            </div>
            <nav className="flex flex-col space-y-1 px-2 border-t border-[#e7e9e3] pt-3">
              <a
                href="#about"
                className="text-[#4d5a54] hover:text-[#1a2420] py-2 block font-semibold text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('studioHome.nav.about')}
              </a>
              <a
                href="#services"
                className="text-[#4d5a54] hover:text-[#1a2420] py-2 block font-semibold text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('studioHome.nav.services')}
              </a>
              <a
                href="#testimonials"
                className="text-[#4d5a54] hover:text-[#1a2420] py-2 block font-semibold text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('studioHome.nav.testimonials')}
              </a>
              <a
                href="#contact"
                className="text-[#4d5a54] hover:text-[#1a2420] py-2 block font-semibold text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('studioHome.nav.contact')}
              </a>
            </nav>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-bg">
          {heroImages.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt="Studio de Pilates Josi à Montréal"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                idx === currentHeroImage ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>
        <div className="hero-in">
          <div className="hero-badges">
            <span className="hero-badge">
              <Award className="w-3.5 h-3.5" /> {t('studioHome.hero.badgePhysio')}
            </span>
            <span className="hero-badge">
              <Sparkles className="w-3.5 h-3.5" /> {t('studioHome.hero.badgeExperience')}
            </span>
            <span className="hero-badge">
              <MapPin className="w-3.5 h-3.5" /> {t('studioHome.hero.badgeLocation')}
            </span>
          </div>

          <h1>
            {renderHeadingWithItalic(
              t('studioHome.hero.title'),
              t('studioHome.hero.titleHighlight')
            )}
          </h1>
          <p>{t('studioHome.hero.description')}</p>
          <div className="hero-cta">
            <a href="#contact" className="btn btn-primary btn-lg">
              <Calendar className="w-4 h-4" /> {t('studioHome.hero.ctaTrial')}
            </a>
            <a href="#services" className="btn btn-white btn-lg">
              {t('studioHome.hero.ctaServices')} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="hero-note">
            <Heart className="w-3.5 h-3.5 text-[#a3e0d3] fill-current" /> {t('studioHome.hero.note')}
          </div>
        </div>
      </section>

      {/* TRUST STRIP BAR */}
      <div className="trust">
        <div className="trust-in">
          <div className="trust-item">
            <Award className="w-5 h-5 text-[#a3e0d3]" />
            <div>
              <div className="tt">{t('studioHome.trust.physioTitle')}</div>
              <div className="ts">{t('studioHome.trust.physioDesc')}</div>
            </div>
          </div>
          <div className="trust-item">
            <User className="w-5 h-5 text-[#a3e0d3]" />
            <div>
              <div className="tt">{t('studioHome.trust.attentionTitle')}</div>
              <div className="ts">{t('studioHome.trust.attentionDesc')}</div>
            </div>
          </div>
          <div className="trust-item">
            <Heart className="w-5 h-5 text-[#a3e0d3]" />
            <div>
              <div className="tt">{t('studioHome.trust.levelsTitle')}</div>
              <div className="ts">{t('studioHome.trust.levelsDesc')}</div>
            </div>
          </div>
          <div className="trust-item">
            <Globe className="w-5 h-5 text-[#a3e0d3]" />
            <div>
              <div className="tt">{t('studioHome.trust.languagesTitle')}</div>
              <div className="ts">{t('studioHome.trust.languagesDesc')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ABOUT SECTION */}
      <section id="about" className="sec">
        <div className="about">
          <div className="about-photo">
            <img src={instructorImage} alt="Josiane, Josi Pilates" />
            <div className="stamp">
              <div className="big">{t('studioHome.about.yearsExperience')}</div>
              <div className="sm">{t('studioHome.about.yearsLabel')}</div>
            </div>
          </div>
          <div className="about-body">
            <div className="eyebrow">{t('studioHome.about.eyebrow')}</div>
            <h2>
              {renderHeadingWithItalic(
                t('studioHome.about.subtitle'),
                t('studioHome.about.subtitleHighlight'),
                'text-[#017a6b] font-serif not-italic'
              )}
            </h2>
            <p>{t('studioHome.about.description')}</p>
            <p>{t('studioHome.about.extended')}</p>
            <div className="creds">
              <span className="cred">
                <Award className="w-4 h-4" /> {t('studioHome.about.badgePhysio')}
              </span>
              <span className="cred">
                <Sparkles className="w-4 h-4" /> {t('studioHome.about.badgePilates')}
              </span>
              <span className="cred">
                <Heart className="w-4 h-4" /> {t('studioHome.about.badgePrevention')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="services" className="svc-sec">
        <div className="sec">
          <div className="sec-head center">
            <div className="eyebrow">{t('studioHome.services.title')}</div>
            <h2>
              {renderHeadingWithItalic(
                t('studioHome.services.subtitle'),
                'vous convient',
                'text-[#017a6b] font-serif not-italic'
              )}
            </h2>
            <p>{t('studioHome.services.subtitleDesc')}</p>
          </div>
          
          <div className="svc-grid">
            {/* Private Plan */}
            <div className="svc">
              {/* TODO: substituir por foto real da aula */}
              <div className="svc-top">
                <div className="svc-ico">
                  <User className="w-6 h-6" />
                </div>
                <h3>{t('studioHome.services.private.title')}</h3>
                <div className="desc">{t('studioHome.services.private.intro')}</div>
              </div>
              <div className="svc-body">
                <ul>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.private.single')}</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.private.four')}</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.private.eight')}</span>
                  </li>
                </ul>
                <p className="text-xs text-[#8a958f] mt-4 leading-relaxed italic border-t border-[#e7e9e3] pt-3">
                  {t('studioHome.services.private.note')}
                </p>
              </div>
            </div>

            {/* Duo Plan */}
            <div className="svc">
              {/* TODO: substituir por foto real da aula */}
              <div className="svc-top">
                <div className="svc-ico">
                  <Users className="w-6 h-6" />
                </div>
                <h3>{t('studioHome.services.duos.title')}</h3>
                <div className="desc">{t('studioHome.services.duos.intro')}</div>
              </div>
              <div className="svc-body">
                <ul>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.duos.introClass')}</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.duos.single')}</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.duos.six')}</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.duos.twelve')}</span>
                  </li>
                </ul>
                <p className="text-xs text-[#8a958f] mt-4 leading-relaxed italic border-t border-[#e7e9e3] pt-3">
                  {t('studioHome.services.duos.note')}
                </p>
              </div>
            </div>

            {/* Group Plan (Highlighted as plus populaire) */}
            <div className="svc feat">
              {/* TODO: substituir por foto real da aula */}
              <div className="svc-tag">{t('studioHome.services.mostPopular')}</div>
              <div className="svc-top">
                <div className="svc-ico">
                  <Users className="w-6 h-6" />
                </div>
                <h3>{t('studioHome.services.group.title')}</h3>
                <div className="desc">{t('studioHome.services.group.intro')}</div>
              </div>
              <div className="svc-body">
                <ul>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.group.single')}</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.group.six')}</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-[#01b48d] flex-shrink-0 mt-0.5" />
                    <span>{t('studioHome.services.group.twelve')}</span>
                  </li>
                </ul>
                <p className="text-xs text-[#8a958f] mt-4 leading-relaxed italic border-t border-[#e7e9e3] pt-3">
                  {t('studioHome.services.group.note')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOURS & LOCATION SECTION */}
      <section className="hl-sec">
        <div className="sec">
          <div className="hl">
            <div className="hl-info">
              <div className="eyebrow">{t('studioHome.location.title')}</div>
              <h2>
                {renderHeadingWithItalic(
                  t('studioHome.location.subtitle'),
                  'rencontrer',
                  'text-[#a3e0d3] font-serif not-italic'
                )}
              </h2>
              {/* Sur rendez-vous uniquement */}
              <div className="hl-contact">
                <div className="hl-line">
                  <MapPin className="w-[19px] h-[19px] text-[#a3e0d3]" />
                  <span>{t('studioHome.location.address')}</span>
                </div>
                <div className="hl-line">
                  <Phone className="w-[19px] h-[19px] text-[#a3e0d3]" />
                  <span>{t('studioHome.location.phone')}</span>
                </div>
                <div className="hl-line">
                  <Mail className="w-[19px] h-[19px] text-[#a3e0d3]" />
                  <span>{t('studioHome.location.email')}</span>
                </div>
              </div>
            </div>
            
            <div className="map">
              {/* Google Maps active rounded centered iframe */}
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2794.618146747551!2d-73.650893!3d45.551772!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cc918dfcf093d93%3A0xe54d3cd561f22496!2s10145%20Av.%20Hamel%2C%20Montr%C3%A9al%2C%20QC%20H2C%202X1!5e0!3m2!1sen!2sca!4v1700000000000!5m2!1sen!2sca"
                width="100%"
                height="380"
                style={{ border: 0, display: 'block' }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Studio Location Map"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section id="testimonials" className="sec">
        <div className="sec-head center">
          <div className="eyebrow">{t('studioHome.nav.testimonials')}</div>
          <h2>
            {renderHeadingWithItalic(
              t('studioHome.testimonialsTitle'),
              'élèves',
              'text-[#017a6b] font-serif not-italic'
            )}
          </h2>
          <p>{t('studioHome.testimonialsSubtitle')}</p>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Carousel
            opts={{
              align: 'start',
              loop: true
            }}
            setApi={setTestimonialsApi}
            className="w-full"
          >
            <CarouselContent>
              {testimonials.map((testimonial, index) => {
                const parseFieldRender = field => {
                  if (!field) return ''
                  if (typeof field === 'object') {
                    const val = field[i18n.language] !== undefined ? field[i18n.language] : (
                      field.fr !== undefined ? field.fr : (
                        field.en !== undefined ? field.en : (
                          field.pt !== undefined ? field.pt : ''
                        )
                      )
                    )
                    return val || ''
                  }
                  if (typeof field !== 'string') return field
                  try {
                    let current = field.trim()
                    if (current.startsWith('"') && current.endsWith('"')) {
                      try {
                        current = JSON.parse(current)
                      } catch {}
                    }
                    if (current && typeof current === 'object') {
                      const val = current[i18n.language] !== undefined ? current[i18n.language] : (
                        current.fr !== undefined ? current.fr : (
                          current.en !== undefined ? current.en : (
                            current.pt !== undefined ? current.pt : ''
                          )
                        )
                      )
                      return val || ''
                    }
                    if (typeof current === 'string' && current.startsWith('{')) {
                      const parsed = JSON.parse(current)
                      if (parsed && typeof parsed === 'object') {
                        const val = parsed[i18n.language] !== undefined ? parsed[i18n.language] : (
                          parsed.fr !== undefined ? parsed.fr : (
                            parsed.en !== undefined ? parsed.en : (
                              parsed.pt !== undefined ? parsed.pt : ''
                            )
                          )
                        )
                        return val || ''
                      }
                    }
                    return field
                  } catch {
                    return field
                  }
                }

                const rawAuthor = testimonial.author_name || testimonial.author || ''
                const cleanAuthor = parseFieldRender(rawAuthor)
                const cleanCity = parseFieldRender(testimonial.city)
                const cleanState = parseFieldRender(testimonial.state)
                const cleanText = parseFieldRender(testimonial.text)

                const cityState = cleanCity && cleanState
                  ? `${cleanCity}, ${cleanState}`
                  : cleanCity || cleanState || ''

                const testimonialId = testimonial.id || index
                const isExpanded = expandedTestimonials[testimonialId] || false
                const textLimit = 160
                const isLongText = cleanText && cleanText.length > textLimit
                const displayText = isLongText && !isExpanded
                  ? `${cleanText.substring(0, textLimit)}...`
                  : cleanText

                return (
                  <CarouselItem
                    key={testimonialId}
                    className="md:basis-1/2 lg:basis-1/3"
                  >
                    <div className="p-1 h-full">
                      <Card
                        className="tst h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow"
                        onClick={handleTestimonialInteraction}
                      >
                        <CardContent className="flex flex-col justify-between p-6 h-full text-left">
                          <div>
                            <div className="stars mb-4">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-[17px] h-[17px] fill-[#c79a4b] text-[#c79a4b]" />
                              ))}
                            </div>
                            <p className="text-[#4d5a54] italic mb-4 leading-relaxed text-sm">
                              "{displayText}"
                            </p>
                            {isLongText && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation() // Prevent card click
                                  toggleTestimonialExpand(testimonialId)
                                }}
                                className="text-[#01b48d] hover:text-[#017a6b] font-bold text-xs flex items-center gap-1 mb-6 focus:outline-none"
                              >
                                {isExpanded ? (
                                  <>
                                    {t('studioHome.testimonialsReadLess') || 'Lire moins'} <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    {t('studioHome.testimonialsReadMore') || 'Lire plus'} <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <div className="who">
                            <div className="av">{getInitials(cleanAuthor)}</div>
                            <div>
                              <b>{cleanAuthor}</b>
                              <span>{cityState || 'Client'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                )
              })}
            </CarouselContent>
            <div onClick={handleTestimonialInteraction}>
              <CarouselPrevious className="hidden md:flex" />
            </div>
            <div onClick={handleTestimonialInteraction}>
              <CarouselNext className="hidden md:flex" />
            </div>
          </Carousel>
        </div>
      </section>

      {/* CTA BAND SECTION */}
      <section className="cta-band">
        <div className="cta-band-bg">
          <img src={capa2Image} alt="Pilates practice at Josi Studio" />
        </div>
        <div className="cta-in">
          <h2>{t('studioHome.ctaBand.title')}</h2>
          <p>{t('studioHome.ctaBand.subtitle')}</p>
          <div className="row">
            <a href="#contact" className="btn btn-white btn-lg">
              <Calendar className="w-4 h-4" /> {t('studioHome.ctaBand.ctaTrial')}
            </a>
            <a
              href="https://wa.me/14382748396"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp btn-lg"
            >
              WhatsApp <WhatsAppIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section id="contact" className="sec">
        <div className="ct">
          <div className="ct-side">
            <div className="eyebrow">{t('studioHome.nav.contact')}</div>
            <h2>
              {renderHeadingWithItalic(
                t('studioHome.contact.title'),
                'Écrivez-nous',
                'text-[#017a6b] font-serif not-italic'
              )}
            </h2>
            <p>{t('studioHome.contact.subtitle')}</p>
            <div className="ct-photo">
              <img src={contactPhoto} alt="Josiane contact, Josi Pilates" />
            </div>
            <div className="ct-lines">
              <div className="ct-line">
                <div className="ic">
                  <Mail className="w-[19px] h-[19px]" />
                </div>
                <div className="tx">
                  <b>{t('studioHome.contact.email')}</b>
                  <span>{t('studioHome.contact.responseNotice')}</span>
                </div>
              </div>
              <div className="ct-line">
                <div className="ic">
                  <Phone className="w-[19px] h-[19px]" />
                </div>
                <div className="tx">
                  <b>{t('studioHome.contact.phone')}</b>
                  <span>{t('studioHome.contact.whatsappNotice')}</span>
                </div>
              </div>
              <div className="ct-line">
                <div className="ic">
                  <MapPin className="w-[19px] h-[19px]" />
                </div>
                <div className="tx">
                  <b>10145 Av. Hamel</b>
                  <span>{t('studioHome.contact.address')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ct-form">
            <h3>{t('studioHome.contact.formTitle')}</h3>
            <div className="sub">{t('studioHome.contact.formSubtitle')}</div>
            
            {contactFormSuccess ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-[#e9f8f4] rounded-full flex items-center justify-center mx-auto mb-4 text-[#01b48d]">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#1a2420] mb-2">
                  {t('studioHome.contact.successTitle')}
                </h3>
                <p className="text-[#4d5a54] text-sm">
                  {t('studioHome.contact.successText')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                {contactFormError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm text-left">
                    {contactFormError}
                  </div>
                )}
                
                <div className="two">
                  <div className="fld">
                    <label>{t('studioHome.contact.firstName')}</label>
                    <input
                      type="text"
                      value={contactForm.firstName}
                      onChange={e =>
                        setContactForm({
                          ...contactForm,
                          firstName: e.target.value
                        })
                      }
                      placeholder={t('studioHome.contact.firstNamePlaceholder')}
                      required
                    />
                  </div>
                  <div className="fld">
                    <label>{t('studioHome.contact.lastName')}</label>
                    <input
                      type="text"
                      value={contactForm.lastName}
                      onChange={e =>
                        setContactForm({
                          ...contactForm,
                          lastName: e.target.value
                        })
                      }
                      placeholder={t('studioHome.contact.lastNamePlaceholder')}
                      required
                    />
                  </div>
                </div>
                
                <div className="fld">
                  <label>{t('studioHome.contact.emailField')}</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={e =>
                      setContactForm({
                        ...contactForm,
                        email: e.target.value
                      })
                    }
                    placeholder={t('studioHome.contact.emailPlaceholder')}
                    required
                  />
                </div>
                
                <div className="fld">
                  <label>{t('studioHome.contact.message')}</label>
                  <textarea
                    rows="4"
                    value={contactForm.message}
                    onChange={e =>
                      setContactForm({
                        ...contactForm,
                        message: e.target.value
                      })
                    }
                    placeholder={t('studioHome.contact.messagePlaceholder')}
                    required
                  ></textarea>
                </div>
                
                <button
                  type="submit"
                  disabled={contactFormSubmitting}
                  className="btn btn-primary w-full justify-center py-[14px] text-sm"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  {contactFormSubmitting
                    ? t('studioHome.contact.sending')
                    : t('studioHome.contact.send')}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ft">
        <div className="ft-in">
          <div className="ft-top">
            <div className="ft-col">
              <div className="ft-brand">
                <Logo className="h-9 w-9" />
                <b>Josi Pilates</b>
              </div>
              <p>{t('studioHome.footer.tagline')}</p>
              <div className="ft-social">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-[18px] h-[18px]" />
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                  <Facebook className="w-[18px] h-[18px]" />
                </a>
                <a href="https://wa.me/14382748396" target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="w-[18px] h-[18px]" />
                </a>
              </div>
            </div>
            
            <div className="ft-col">
              <h5>{t('studioHome.footer.navigation')}</h5>
              <a href="#about">{t('studioHome.nav.about')}</a>
              <a href="#services">{t('studioHome.nav.services')}</a>
              <a href="#testimonials">{t('studioHome.nav.testimonials')}</a>
              <a href="#contact">{t('studioHome.nav.contact')}</a>
            </div>
            
            {/* Excluded hours column */}
            
            <div className="ft-col">
              <h5>{t('studioHome.footer.contact')}</h5>
              <a href="mailto:josi@josipilates.com">josi@josipilates.com</a>
              <a href="tel:+14382748396">+1 438 274 8396</a>
              <a style={{ cursor: 'default' }}>10145 Av. Hamel, MTL</a>
            </div>
          </div>
          
          <div className="ft-bot">
            <span>{t('studioHome.footer.copyright')}</span>
            <div className="flex gap-5">
              <Link to="/privacy-policy">{t('studioHome.footer.privacy')}</Link>
              <Link to="/terms-of-service">{t('studioHome.footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default StudioHome
