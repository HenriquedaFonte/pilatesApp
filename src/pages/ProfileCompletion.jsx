// import { useState, useEffect } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { useAuth } from '../hooks/useAuth'
// import { Button } from '@/components/ui/button'
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { Input } from '@/components/ui/input'
// import { Label } from '@/components/ui/label'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { Alert, AlertDescription } from '@/components/ui/alert'
// import { Loader2, Phone, Globe, CheckCircle } from 'lucide-react'
// import Logo from '../components/Logo'

// const ProfileCompletion = () => {
//   const [formData, setFormData] = useState({
//     phone: '',
//     preferredLanguage: 'pt'
//   })
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')
//   const [success, setSuccess] = useState(false)
  
//   const { user, supabase } = useAuth()
//   const navigate = useNavigate()

//   useEffect(() => {
//     // If user is not authenticated, redirect to login
//     if (!user) {
//       navigate('/login')
//       return
//     }

//     // Check if profile is already complete
//     checkProfileStatus()
//   }, [user, navigate])

//   const checkProfileStatus = async () => {
//     if (!user) return

//     try {
//       const { data: profile, error } = await supabase
//         .from('profiles')
//         .select('phone, preferred_language, profile_complete, role')
//         .eq('id', user.id)
//         .single()

//       if (error) {
//         console.error('Error fetching profile:', error)
//         return
//       }

//       // If profile is already complete, redirect to appropriate dashboard
//       if (profile.profile_complete) {
//         if (profile.role === 'teacher') {
//           navigate('/teacher')
//         } else {
//           navigate('/student')
//         }
//         return
//       }

//       // Pre-fill form with existing data
//       setFormData({
//         phone: profile.phone || '',
//         preferredLanguage: profile.preferred_language || 'pt'
//       })
//     } catch (error) {
//       console.error('Error checking profile status:', error)
//     }
//   }

//   const formatPhoneNumber = (value) => {
//     // Remove all non-numeric characters
//     const phoneNumber = value.replace(/\D/g, '')
    
//     // Format as +1 555 555 5555
//     if (phoneNumber.length === 0) return ''
//     if (phoneNumber.length <= 1) return `+${phoneNumber}`
//     if (phoneNumber.length <= 4) return `+${phoneNumber.slice(0, 1)} ${phoneNumber.slice(1)}`
//     if (phoneNumber.length <= 7) return `+${phoneNumber.slice(0, 1)} ${phoneNumber.slice(1, 4)} ${phoneNumber.slice(4)}`
//     return `+${phoneNumber.slice(0, 1)} ${phoneNumber.slice(1, 4)} ${phoneNumber.slice(4, 7)} ${phoneNumber.slice(7, 11)}`
//   }

//   const handlePhoneChange = (e) => {
//     const formattedPhone = formatPhoneNumber(e.target.value)
//     setFormData(prev => ({
//       ...prev,
//       phone: formattedPhone
//     }))
//   }

//   const handleLanguageChange = (value) => {
//     setFormData(prev => ({
//       ...prev,
//       preferredLanguage: value
//     }))
//   }

//   const handleSubmit = async (e) => {
//     e.preventDefault()
//     setLoading(true)
//     setError('')

//     if (!user) {
//       setError('User not authenticated')
//       setLoading(false)
//       return
//     }

//     // Validate phone number (optional but if provided, must be valid format)
//     if (formData.phone && !formData.phone.match(/^\+[1-9]\d{1,14}$/)) {
//       setError('Please enter a valid phone number in international format')
//       setLoading(false)
//       return
//     }

//     try {
//       // Call the create-user Edge Function to update the profile
//       const { data, error } = await supabase.functions.invoke('create-user', {
//         body: {
//           oauth_user_id: user.id,
//           email: user.email,
//           fullName: user.user_metadata?.full_name || user.email,
//           phone: formData.phone || null,
//           preferredLanguage: formData.preferredLanguage,
//           update_existing: true
//         }
//       })

//       if (error) {
//         throw error
//       }

//       if (data.error) {
//         throw new Error(data.error)
//       }

//       setSuccess(true)
      
//       // Redirect to appropriate dashboard after a short delay
//       setTimeout(() => {
//         if (data.profile?.role === 'teacher') {
//           navigate('/teacher')
//         } else {
//           navigate('/student')
//         }
//       }, 2000)

//     } catch (error) {
//       console.error('Error updating profile:', error)
//       setError(error.message || 'Failed to update profile. Please try again.')
//     } finally {
//       setLoading(false)
//     }
//   }

//   if (success) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
//         <Card className="w-full max-w-md">
//           <CardHeader className="text-center">
//             <div className="flex justify-center mb-4">
//               <CheckCircle className="h-16 w-16 text-green-500" />
//             </div>
//             <CardTitle className="text-2xl font-bold text-green-600">Profile Complete!</CardTitle>
//             <CardDescription>
//               Your profile has been updated successfully. You will be redirected to your dashboard.
//             </CardDescription>
//           </CardHeader>
//         </Card>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
//       <Card className="w-full max-w-md">
//         <CardHeader className="text-center">
//           <div className="flex justify-center mb-4">
//             <Logo className="h-12 w-12" />
//           </div>
//           <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
//           <CardDescription>
//             Please provide some additional information to complete your account setup.
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           <form onSubmit={handleSubmit} className="space-y-4">
//             {error && (
//               <Alert variant="destructive">
//                 <AlertDescription>{error}</AlertDescription>
//               </Alert>
//             )}
            
//             <div className="space-y-2">
//               <Label htmlFor="phone">Phone Number (Optional)</Label>
//               <div className="relative">
//                 <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                 <Input
//                   id="phone"
//                   name="phone"
//                   type="tel"
//                   value={formData.phone}
//                   onChange={handlePhoneChange}
//                   placeholder="+1 555 555 5555"
//                   className="pl-10"
//                   disabled={loading}
//                 />
//               </div>
//               <p className="text-xs text-gray-500">
//                 Format: +1 555 555 5555 (optional but recommended for notifications)
//               </p>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="preferredLanguage">Email Language Preference *</Label>
//               <div className="relative">
//                 <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
//                 <Select value={formData.preferredLanguage} onValueChange={handleLanguageChange} disabled={loading}>
//                   <SelectTrigger className="pl-10">
//                     <SelectValue placeholder="Select language" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="pt">🇧🇷 Português</SelectItem>
//                     <SelectItem value="en">🇺🇸 English</SelectItem>
//                     <SelectItem value="fr">🇫🇷 Français</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
//               <p className="text-xs text-gray-500">
//                 Language for email notifications about credits and classes
//               </p>
//             </div>
            
//             <Button type="submit" className="w-full" disabled={loading}>
//               {loading ? (
//                 <>
//                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                   Updating profile...
//                 </>
//               ) : (
//                 'Complete Profile'
//               )}
//             </Button>
//           </form>
          
//           <div className="mt-6 text-center">
//             <p className="text-xs text-muted-foreground">
//               * Required fields. You can update this information later in your profile settings.
//             </p>
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   )
// }

// export default ProfileCompletion

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Phone, Globe, CheckCircle } from 'lucide-react'
import Logo from '../components/Logo'

const ProfileCompletion = () => {
  const [formData, setFormData] = useState({
    phone: '',
    preferredLanguage: 'pt'
  })
  const [displayPhone, setDisplayPhone] = useState('') // State to hold the formatted phone for display
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const { user, supabase } = useAuth()
  const navigate = useNavigate()

  const checkProfileStatus = useCallback(async () => {
    if (!user) return

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('phone, preferred_language, profile_complete, role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      // If profile is already complete, redirect to appropriate dashboard
      if (profile.profile_complete) {
        if (profile.role === 'teacher') {
          navigate('/teacher')
        } else {
          navigate('/student')
        }
        return
      }

      // Pre-fill form with existing data
      setFormData({
        phone: profile.phone || '',
        preferredLanguage: profile.preferred_language || 'pt'
      })
      setDisplayPhone(formatPhoneNumber(profile.phone || '')) // Format for display
    } catch (error) {
      console.error('Error checking profile status:', error)
    }
  }, [user, supabase, navigate, setFormData, setDisplayPhone])

  useEffect(() => {
    // If user is not authenticated, redirect to login
    if (!user) {
      navigate('/login')
      return
    }

    // Check if profile is already complete
    checkProfileStatus()
  }, [user, navigate, checkProfileStatus])

  const formatPhoneNumber = (value) => {
    // Remove all non-numeric characters except the leading '+'
    let cleaned = value.startsWith('+') ? '+' + value.slice(1).replace(/\D/g, '') : value.replace(/\D/g, '');
    
    // Apply formatting for display
    if (cleaned.length === 0) return '';
    if (cleaned.length === 1 && cleaned === '+') return '+';
    if (cleaned.length <= 2) return cleaned; // e.g., +1
    if (cleaned.length <= 5) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`; // e.g., +1 514
    if (cleaned.length <= 8) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`; // e.g., +1 514 712
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 12)}`; // e.g., +1 514 712 2368
  };

  const handlePhoneChange = (e) => {
    const rawValue = e.target.value;
    // Store the raw, unformatted number in formData
    const cleanedValue = rawValue.startsWith('+') ? '+' + rawValue.slice(1).replace(/\D/g, '') : rawValue.replace(/\D/g, '');
    setFormData(prev => ({
      ...prev,
      phone: cleanedValue
    }));
    // Update displayPhone with the formatted version
    setDisplayPhone(formatPhoneNumber(cleanedValue));
  };

  const handleLanguageChange = (value) => {
    setFormData(prev => ({
      ...prev,
      preferredLanguage: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!user) {
      setError('User not authenticated')
      setLoading(false)
      return
    }

    // Validate phone number (optional but if provided, must be valid format)
    if (formData.phone && !formData.phone.match(/^\+[1-9]\d{1,14}$/)) {
      setError('Please enter a valid phone number in international format')
      setLoading(false)
      return
    }

    try {
      // Call the create-user Edge Function to update the profile
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          oauth_user_id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || user.email,
          phone: formData.phone || null,
          preferredLanguage: formData.preferredLanguage,
          update_existing: true
        }
      })

      if (error) {
        throw error
      }

      if (data.error) {
        throw new Error(data.error)
      }

      setSuccess(true)
      
      // Redirect to appropriate dashboard after a short delay
      setTimeout(() => {
        if (data.profile?.role === 'teacher') {
          navigate('/teacher')
        } else {
          navigate('/student')
        }
      }, 2000)

    } catch (error) {
      console.error('Error updating profile:', error)
      setError(error.message || 'Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">Profile Complete!</CardTitle>
            <CardDescription>
              Your profile has been updated successfully. You will be redirected to your dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription>
            Please provide some additional information to complete your account setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={displayPhone} // Use displayPhone for the input value
                  onChange={handlePhoneChange}
                  placeholder="+1 555 555 5555"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                Format: +1 555 555 5555 (optional but recommended for notifications)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">Email Language Preference *</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                <Select value={formData.preferredLanguage} onValueChange={handleLanguageChange} disabled={loading}>
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">🇧🇷 Português</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                Language for email notifications about credits and classes
              </p>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating profile...
                </>
              ) : (
                'Complete Profile'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              * Required fields. You can update this information later in your profile settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfileCompletion
