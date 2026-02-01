import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'
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
import studentPilatesImage from '../assets/1584341045.jpg.avif'
import duosImage from '../assets/screen-shot-2014-07-27-at-10-07-46-pm.png.avif'
import groupImage from '../assets/download.jpeg.avif'
import capa1Image from '../assets/capa1.avif'
import capa2Image from '../assets/capa2.avif'
import capa3Image from '../assets/capa3.jpg'
import instructorImage from '../assets/instructor-photo.jpg.avif'
import aboutPhoto from '../assets/aboutPhoto.avif'
import contactPhoto from '../assets/contactPhoto.avif'

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

  useEffect(() => {
    // Always start in French for homepage
    i18n.changeLanguage('fr')
  }, [i18n])

  useEffect(() => {
    fetchTestimonials()
  }, [])

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTestimonials(data || [])
    } catch (error) {
      console.error('Error fetching testimonials:', error)
      // Fallback to static testimonials if database fails
      setTestimonials(
        t('studioHome.testimonials', { returnObjects: true }) || []
      )
    }
  }

  // Hero image rotation
  const heroImages = [capa1Image, capa2Image, capa3Image]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroImage(prev => (prev + 1) % heroImages.length)
    }, 7000) // Change every 7 seconds

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!testimonialsApi || autoAdvancePaused) return

    const interval = setInterval(() => {
      testimonialsApi.scrollNext()
    }, 3000) // Auto-advance every 3 seconds

    return () => clearInterval(interval)
  }, [testimonialsApi, autoAdvancePaused])

  const changeLanguage = language => {
    i18n.changeLanguage(language)
  }

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
                <p style="margin: 5px 0;"><strong>Email:</strong> ${
                  contactForm.email
                }</p>
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
      console.error('Error sending contact form:', error)
      setContactFormError(
        'Failed to send message. Please try again or contact us directly.'
      )
    } finally {
      setContactFormSubmitting(false)
    }
  }

  useEffect(() => {
    if (user && profile && isProfileComplete) {
      // Only redirect authenticated users with complete profiles to their dashboards
      if (profile.role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true })
      } else if (profile.role === 'student') {
        navigate('/student/dashboard', { replace: true })
      }
    }
  }, [user, profile, isProfileComplete, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 pt-20 md:pt-0">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-50 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Logo className="h-8 w-8 mr-2" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Josi Pilates
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <Select onValueChange={changeLanguage} value={i18n.language}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                </SelectContent>
              </Select>
              <nav className="flex space-x-6">
                <a
                  href="#about"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {t('studioHome.nav.about')}
                </a>
                <a
                  href="#testimonials"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {t('studioHome.nav.testimonials')}
                </a>
                <a
                  href="#services"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {t('studioHome.nav.services')}
                </a>
                <a
                  href="#contact"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {t('studioHome.nav.contact')}
                </a>
              </nav>
              <ThemeToggle />
              <Button asChild>
                <Link to="/login">{t('studioHome.nav.studentPortal')}</Link>
              </Button>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden flex items-center space-x-2">
              <Button asChild size="sm">
                <Link to="/login">{t('studioHome.nav.studentPortal')}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4">
              <div className="flex flex-col space-y-4">
                <div className="px-4">
                  <Select onValueChange={changeLanguage} value={i18n.language}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="px-4">
                  <ThemeToggle />
                </div>
                <nav className="flex flex-col space-y-2 px-4">
                  <a
                    href="#about"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('studioHome.nav.about')}
                  </a>
                  <a
                    href="#testimonials"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('studioHome.nav.testimonials')}
                  </a>
                  <a
                    href="#services"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('studioHome.nav.services')}
                  </a>
                  <a
                    href="#contact"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('studioHome.nav.contact')}
                  </a>
                </nav>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="w-full mb-12 overflow-hidden">
            <div
              className="flex transition-transform duration-2000 ease-in-out"
              style={{ transform: `translateX(-${currentHeroImage * 100}%)` }}
            >
              {heroImages.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt="Student doing Pilates exercise"
                  className="w-full h-[550px] object-cover shadow-lg flex-shrink-0"
                  style={{ width: '100%' }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Text Content */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 p-10 rounded-lg shadow-sm">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                  {t('studioHome.hero.greeting')}
                  <br />
                  {t('studioHome.hero.intro')}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed">
                  {t('studioHome.hero.description')}
                </p>
                <Button size="lg" asChild>
                  <a href="#about">{t('studioHome.hero.aboutButton')}</a>
                </Button>
              </div>
            </div>

            {/* Instructor Photo */}
            <div className="lg:col-span-1">
              <img
                src={aboutPhoto}
                alt="Josi Pilates Instructor"
                className="w-full h-80 object-cover rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <img
                src={instructorImage}
                alt="Josi Pilates Instructor"
                className="w-48 h-48 object-cover rounded-full mx-auto mb-6"
              />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                {t('studioHome.about.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {t('studioHome.about.description')}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {t('studioHome.about.extendedTitle')}
              </h3>
              <div className="text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {t('studioHome.about.extended')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section
        id="testimonials"
        className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('studioHome.testimonialsTitle', 'What Our Students Say')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t(
                'studioHome.testimonialsSubtitle',
                'Real experiences from our Pilates community'
              )}
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
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
                  const author = testimonial.author_name
                    ? testimonial.city && testimonial.state
                      ? `${testimonial.author_name}, ${testimonial.city}, ${testimonial.state}`
                      : testimonial.author_name
                    : testimonial.author
                  return (
                    <CarouselItem
                      key={testimonial.id || index}
                      className="md:basis-1/2 lg:basis-1/3"
                    >
                      <div className="p-1">
                        <Card className="h-full">
                          <CardContent className="flex flex-col justify-between p-6 h-full">
                            <div>
                              <div className="flex items-center mb-4">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className="w-5 h-5 text-yellow-400 fill-current"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <p className="text-gray-600 dark:text-gray-300 italic mb-4 flex-grow">
                                "{testimonial.text}"
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              - {author}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </CarouselItem>
                  )
                })}
              </CarouselContent>
              <div onClick={() => setAutoAdvancePaused(true)}>
                <CarouselPrevious className="hidden md:flex" />
              </div>
              <div onClick={() => setAutoAdvancePaused(true)}>
                <CarouselNext className="hidden md:flex" />
              </div>
            </Carousel>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 bg-white dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('studioHome.services.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('studioHome.services.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <img
                src={studentPilatesImage}
                alt="Private Classes"
                className="w-full aspect-video object-cover rounded-t-lg"
              />
              <CardHeader>
                <CardTitle>{t('studioHome.services.private.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>{t('studioHome.services.private.intro')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.private.single')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.private.four')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.private.eight')}</strong>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-4">
                    {t('studioHome.services.private.note')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <img
                src={duosImage}
                alt="Duos Classes"
                className="w-full aspect-video object-cover rounded-t-lg"
              />
              <CardHeader>
                <CardTitle>{t('studioHome.services.duos.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>{t('studioHome.services.duos.intro')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.duos.single')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.duos.six')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.duos.twelve')}</strong>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-4">
                    {t('studioHome.services.duos.note')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <img
                src={groupImage}
                alt="Group Classes"
                className="w-full aspect-video object-cover rounded-t-lg"
              />
              <CardHeader>
                <CardTitle>{t('studioHome.services.group.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>{t('studioHome.services.group.intro')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.group.single')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.group.six')}</strong>
                  </p>
                  <p>
                    <strong>{t('studioHome.services.group.twelve')}</strong>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-4">
                    {t('studioHome.services.group.note')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Contactez nous
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Get in touch with us
            </p>
          </div>

          {/* Top Section: Photo and Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            {/* Instructor Photo */}
            <div className="flex justify-center">
              <img
                src={contactPhoto}
                alt="Josi Pilates Instructor"
                className="w-full h-auto object-cover rounded-lg shadow-lg"
              />
            </div>

            {/* Contact Form */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-sm flex justify-center items-center min-h-[400px]">
              {contactFormSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Message Sent!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Thank you for your message. We'll get back to you soon.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleContactSubmit}
                  className="space-y-6 w-full max-w-md"
                >
                  {contactFormError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
                      {contactFormError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={contactForm.firstName}
                        onChange={e =>
                          setContactForm({
                            ...contactForm,
                            firstName: e.target.value
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="First Name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={contactForm.lastName}
                        onChange={e =>
                          setContactForm({
                            ...contactForm,
                            lastName: e.target.value
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Last Name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={e =>
                        setContactForm({
                          ...contactForm,
                          email: e.target.value
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Email"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Message
                    </label>
                    <textarea
                      rows="4"
                      value={contactForm.message}
                      onChange={e =>
                        setContactForm({
                          ...contactForm,
                          message: e.target.value
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                      placeholder="Your message"
                      required
                    ></textarea>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={contactFormSubmitting}
                  >
                    {contactFormSubmitting ? 'Sending...' : 'Send'}
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Bottom Section: Contact Info and Map */}
          <div className="space-y-8">
            {/* Contact Info - Horizontal */}
            <div className="flex flex-wrap justify-center items-center gap-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-white">@</span>
                </div>
                <span className="text-gray-700 dark:text-gray-300">
                  josi@josipilates.com
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white">💬</span>
                </div>
                <span className="text-gray-700 dark:text-gray-300">
                  +1 438 274 8396 (Whatsapp)
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white">📍</span>
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  <div>Montreal, H2C 2X1</div>
                </div>
              </div>
            </div>

            {/* Google Maps
            <div className="bg-white p-4 rounded-lg shadow-sm max-w-4xl mx-auto">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2796.1234567890123!2d-73.567890!3d45.501234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cc91a1b2c3d4e5f%3A0x1234567890abcdef!2sAv.%20Hamel%2C%20Montreal%2C%20H2C%202X1!5e0!3m2!1sen!2sca!4v1234567890123!5m2!1sen!2sca"
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Studio Location"
              ></iframe>
            </div> */}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Logo className="h-6 w-6 mr-2" />
              <span className="text-lg font-semibold">Josi Pilates</span>
            </div>
            <div className="flex space-x-6">
              <Link to="/privacy-policy" className="hover:text-gray-300">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="hover:text-gray-300">
                Terms of Service
              </Link>
              <a href="tel:+14382748396" className="hover:text-gray-300">
                Contact
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>{t('studioHome.footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default StudioHome
