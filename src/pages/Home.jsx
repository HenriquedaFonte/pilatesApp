import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Logo from '../components/Logo'
import {
  Users,
  Calendar,
  Heart,
  Phone,
  Mail,
  MapPin,
  Star,
  Award,
  Clock
} from 'lucide-react'

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo className="h-10 w-10 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Josi Pilates</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login">
                <Button>Student Portal</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-pink-500 to-purple-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Welcome to Josi Pilates
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Transform your body and mind with professional Pilates instruction in Montreal.
            Join our community of dedicated practitioners.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Start Your Journey
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-purple-600">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">About Josi Pilates</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              With years of experience in Pilates instruction, Josi brings passion and expertise
              to help you achieve your fitness goals in a supportive, welcoming environment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Award className="h-12 w-12 text-pink-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Certified Instructor</h3>
                <p className="text-gray-600">
                  Professional certification with extensive training in Pilates methodology
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Heart className="h-12 w-12 text-pink-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Personalized Approach</h3>
                <p className="text-gray-600">
                  Individual attention and customized programs for your unique needs
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Users className="h-12 w-12 text-pink-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Community Focused</h3>
                <p className="text-gray-600">
                  Join a supportive community of Pilates enthusiasts in Montreal
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Services</h2>
            <p className="text-lg text-gray-600">
              Comprehensive Pilates programs for all levels
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-6">
                <Calendar className="h-8 w-8 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Private Sessions</h3>
                <p className="text-gray-600 mb-4">
                  One-on-one instruction tailored to your goals and fitness level
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Personalized attention</li>
                  <li>• Flexible scheduling</li>
                  <li>• Progress tracking</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Users className="h-8 w-8 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Group Classes</h3>
                <p className="text-gray-600 mb-4">
                  Join a small group for a motivating class experience
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Maximum 6 participants</li>
                  <li>• Social atmosphere</li>
                  <li>• Cost effective</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Star className="h-8 w-8 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Special Packages</h3>
                <p className="text-gray-600 mb-4">
                  Save with our class packages and membership options
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 10-class packages</li>
                  <li>• Monthly memberships</li>
                  <li>• Introductory offers</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What Our Students Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">
                  "Josi's instruction is exceptional. I've seen amazing improvements in my core strength
                  and overall posture. The personalized approach makes all the difference."
                </p>
                <p className="font-semibold">- Marie L.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">
                  "The studio atmosphere is welcoming and the classes are challenging yet accessible.
                  Josi's expertise and encouragement keep me motivated."
                </p>
                <p className="font-semibold">- Pierre M.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-lg text-gray-600">
              Ready to start your Pilates journey? Get in touch!
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Phone className="h-8 w-8 text-pink-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Phone</h3>
                <p className="text-gray-600">(514) 555-PILATES</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Mail className="h-8 w-8 text-pink-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Email</h3>
                <p className="text-gray-600">info@josipilates.com</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <MapPin className="h-8 w-8 text-pink-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Location</h3>
                <p className="text-gray-600">Montreal, QC</p>
              </CardContent>
            </Card>
          </div>
          <div className="text-center mt-8">
            <Link to="/login">
              <Button size="lg">
                Access Student Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Logo className="h-8 w-8 mr-3" />
              <span className="text-lg font-semibold">Josi Pilates</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400">
                © 2024 Josi Pilates. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home