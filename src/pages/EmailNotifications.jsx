import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import emailService from '../lib/emailService';
import EmailTemplates from '../components/EmailTemplates';
import { getTemplate } from '../lib/emailTemplates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Send,
  Users,
  AlertTriangle,
  ArrowLeft,
  Activity,
  LogOut,
  Mail,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Search
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle'

const EmailNotifications = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [lowCreditsThreshold, setLowCreditsThreshold] = useState(3);
  const [senderName, setSenderName] = useState(profile?.full_name || 'Professora');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [previewLanguage, setPreviewLanguage] = useState('pt');
  const [activeTab, setActiveTab] = useState('notifications');

  const [emailHistory, setEmailHistory] = useState([]);

  useEffect(() => {
    loadData();
    loadEmailHistory();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const studentParam = searchParams.get('student');
    const filterParam = searchParams.get('filter');
    const tabParam = searchParams.get('tab');
    const templateParam = searchParams.get('template');

    if (filterParam) {
      setFilterType(filterParam);
    }

    if (studentParam) {
      setSelectedStudents([studentParam]);
      setFilterType('selected');
    }

    if (tabParam) {
      setActiveTab(tabParam);
    }

    if (templateParam) {
      // Load the template
      const template = getTemplate(templateParam, previewLanguage);
      if (template) {
        setSelectedTemplateId(templateParam);
        setEmailSubject(template.subject || '');
        setEmailMessage(template.message || '');
      }
    }
  }, [searchParams, previewLanguage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select(`
          id, 
          full_name, 
          email, 
          individual_credits, 
          duo_credits, 
          group_credits, 
          created_at,
          phone
        `)
        .eq('role', 'student')
        .order('full_name');

      if (studentsError) throw studentsError;

      const studentsWithTotalCredits = (studentsData || []).map(student => ({
        ...student,
        totalCredits: (student.individual_credits || 0) + (student.duo_credits || 0) + (student.group_credits || 0)
      }));

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, type')
        .order('name');

      if (classesError) throw classesError;

      setStudents(studentsWithTotalCredits);
      setClasses(classesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading data: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmailHistory = async () => {
    try {
      const { data: notifications, error } = await supabase
        .from('email_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const groupedHistory = {};
      notifications.forEach(notification => {
        const key = `${notification.subject}_${new Date(notification.created_at).getTime()}`;

        if (!groupedHistory[key]) {
          groupedHistory[key] = {
            id: key,
            type: notification.email_type,
            subject: notification.subject,
            recipients: 0,
            success: 0,
            failed: 0,
            timestamp: notification.created_at,
            details: []
          };
        }

        groupedHistory[key].recipients++;
        if (notification.status === 'sent') {
          groupedHistory[key].success++;
        } else if (notification.status === 'failed') {
          groupedHistory[key].failed++;
        }

        groupedHistory[key].details.push({
          student: notification.recipient_email,
          success: notification.status === 'sent',
          error: notification.error_message
        });
      });

      const historyArray = Object.values(groupedHistory);
      setEmailHistory(historyArray);
    } catch (error) {
      console.error('Error loading email history:', error);
    }
  };

  const getFilteredStudents = () => {
    let filtered = [...students];

    switch (filterType) {
      case 'low_credits':
        filtered = filtered.filter(student => student.totalCredits <= lowCreditsThreshold);
        break;
      case 'zero_credits':
        filtered = filtered.filter(student => student.totalCredits === 0);
        break;
      case 'class':
        if (selectedClass) {
          filtered = students; 
        }
        break;
      case 'registration_day':
        if (selectedDay) {
          filtered = filtered.filter(student => {
            const registrationDay = new Date(student.created_at).getDay();
            return registrationDay.toString() === selectedDay;
          });
        }
        break;
      case 'selected':
        filtered = students.filter(student => selectedStudents.includes(student.id));
        break;
      default:
        break;
    }

    return filtered;
  };

  const sendLowCreditsNotifications = async () => {
    setSending(true);
    setMessage('');
    
    try {
      const lowCreditsStudents = students.filter(student => student.totalCredits <= lowCreditsThreshold);
      
      if (lowCreditsStudents.length === 0) {
        setMessage('No students with low credits found.');
        setMessageType('info');
        return;
      }

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const student of lowCreditsStudents) {
        try {
          await emailService.sendLowCreditsNotification(student, student.totalCredits);

          await supabase.rpc('log_email_notification', {
            p_student_id: student.id,
            p_email_type: 'low_credits',
            p_recipient_email: student.email,
            p_subject: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
            p_status: 'sent',
            p_credits_at_time: {
              individual: student.individual_credits,
              duo: student.duo_credits,
              group: student.group_credits,
              total: student.totalCredits
            }
          });

          results.push({ student: student.full_name, success: true });
          successCount++;
        } catch (error) {
          console.error(`Error sending email to ${student.full_name}:`, error);

          await supabase.rpc('log_email_notification', {
            p_student_id: student.id,
            p_email_type: 'low_credits',
            p_recipient_email: student.email,
            p_subject: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
            p_status: 'failed',
            p_error_message: error.message,
            p_credits_at_time: {
              individual: student.individual_credits,
              duo: student.duo_credits,
              group: student.group_credits,
              total: student.totalCredits
            }
          });

          results.push({ student: student.full_name, success: false, error: error.message });
          failCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      
      setMessage(`Notifications sent: ${successCount} successes, ${failCount} failures.`);
      setMessageType(failCount === 0 ? 'success' : 'error');

      await loadEmailHistory();
    } catch (error) {
      console.error('Error sending notifications:', error);
      setMessage('Error sending notifications: ' + error.message);
      setMessageType('error');
    } finally {
      setSending(false);
    }
  };

  const sendCustomEmail = async () => {
    // Special handling for consent form template
    if (selectedTemplateId === 'consentForm') {
      const targetStudents = getFilteredStudents();

      if (targetStudents.length === 0) {
        setMessage('No students selected for sending.');
        setMessageType('error');
        return;
      }

      setSending(true);
      setMessage('');

      try {
        let successCount = 0;
        let failCount = 0;

        for (const student of targetStudents) {
          const result = await sendConsentFormEmail(student);
          if (result.success) {
            successCount++;
          } else {
            console.error(`Error sending consent form to ${student.full_name}:`, result.error);
            failCount++;
          }
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        setMessage(`Consent forms sent: ${successCount} successes, ${failCount} failures.`);
        setMessageType(failCount === 0 ? 'success' : 'error');

        await loadEmailHistory();
      } catch (error) {
        console.error('Error sending consent forms:', error);
        setMessage('Error sending consent forms: ' + error.message);
        setMessageType('error');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!emailSubject.trim() || !emailMessage.trim()) {
      setMessage('Please fill in the email subject and message.');
      setMessageType('error');
      return;
    }

    const targetStudents = getFilteredStudents();

    if (targetStudents.length === 0) {
      setMessage('No students selected for sending.');
      setMessageType('error');
      return;
    }

    setSending(true);
    setMessage('');

    try {
      const results = await emailService.sendCustomNotification(
        targetStudents,
        emailSubject,
        emailMessage,
        senderName
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const student = targetStudents[i];

        await supabase.rpc('log_email_notification', {
          p_student_id: student.id,
          p_email_type: 'custom',
          p_recipient_email: student.email,
          p_subject: emailSubject,
          p_status: result.success ? 'sent' : 'failed',
          p_error_message: result.error || null,
          p_credits_at_time: {
            individual: student.individual_credits,
            duo: student.duo_credits,
            group: student.group_credits,
            total: student.totalCredits
          }
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;


      setMessage(`Email sent: ${successCount} successes, ${failCount} failures.`);
      setMessageType(failCount === 0 ? 'success' : 'error');

      await loadEmailHistory();

      if (failCount === 0) {
        setEmailSubject('');
        setEmailMessage('');
      }
    } catch (error) {
      console.error('Error sending custom email:', error);
      setMessage('Error sending email: ' + error.message);
      setMessageType('error');
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelection = (template) => {
    setSelectedTemplateId(template.id);

    // Special handling for consent form template
    if (template.id === 'consentForm') {
      // For consent form, we don't set subject/message as it's handled by the service
      setEmailSubject('');
      setEmailMessage('');
      setMessage(`Template "${template.title}" selected! This will send the consent form with PDF attachment.`);
      setMessageType('info');
    } else {
      setEmailSubject(template.subject);
      setEmailMessage(template.message);
      setMessage(`Template "${template.title}" selected! You can customize the message before sending.`);
      setMessageType('info');
    }
  };

  const sendConsentFormEmail = async (student) => {
    try {
      await emailService.sendConsentFormEmail(student);

      await supabase.rpc('log_email_notification', {
        p_student_id: student.id,
        p_email_type: 'consent_form',
        p_recipient_email: student.email,
        p_subject: 'Formulário de Consentimento - Josi Pilates',
        p_status: 'sent',
        p_credits_at_time: {
          individual: student.individual_credits,
          duo: student.duo_credits,
          group: student.group_credits,
          total: student.totalCredits
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending consent form:', error);

      await supabase.rpc('log_email_notification', {
        p_student_id: student.id,
        p_email_type: 'consent_form',
        p_recipient_email: student.email,
        p_subject: 'Formulário de Consentimento - Josi Pilates',
        p_status: 'failed',
        p_error_message: error.message,
        p_credits_at_time: {
          individual: student.individual_credits,
          duo: student.duo_credits,
          group: student.group_credits,
          total: student.totalCredits
        }
      });

      return { success: false, error: error.message };
    }
  };
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllFiltered = () => {
    if (filterType === 'selected') {
      // For manual selection, use searched students
      const allSelected = searchedStudents.every(student => selectedStudents.includes(student.id));

      if (allSelected) {
        setSelectedStudents(prev => prev.filter(id => !searchedStudents.some(s => s.id === id)));
      } else {
        const newSelections = searchedStudents.map(s => s.id);
        setSelectedStudents(prev => [...new Set([...prev, ...newSelections])]);
      }
    } else {
      // For other filters, use filtered students
      const filteredStudents = getFilteredStudents();
      const allSelected = filteredStudents.every(student => selectedStudents.includes(student.id));

      if (allSelected) {
        setSelectedStudents(prev => prev.filter(id => !filteredStudents.some(s => s.id === id)));
      } else {
        const newSelections = filteredStudents.map(s => s.id);
        setSelectedStudents(prev => [...new Set([...prev, ...newSelections])]);
      }
    }
  };

  const filteredStudents = getFilteredStudents();
  const lowCreditsStudents = students.filter(s => s.totalCredits <= lowCreditsThreshold);

  const searchedStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/teacher/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" />
              </Link>
              <Activity className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Email Notifications</h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-700 dark:text-gray-300">Welcome, {profile?.full_name}</span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <Alert variant={messageType === 'error' ? 'destructive' : 'default'} className="mb-6">
            {messageType === 'success' && <CheckCircle className="h-4 w-4" />}
            {messageType === 'error' && <XCircle className="h-4 w-4" />}
            {messageType === 'info' && <AlertTriangle className="h-4 w-4" />}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Balance</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{lowCreditsStudents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No Credits</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {students.filter(s => s.totalCredits === 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Mail className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Sent</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {emailHistory.reduce((total, entry) => total + entry.success, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="notifications" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 px-1 sm:px-3">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-center">Low Balance</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 px-1 sm:px-3">
              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-center">Custom Email</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 px-1 sm:px-3">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-center">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 px-1 sm:px-3">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-center">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Low Balance Notifications
                  </CardTitle>
                  <CardDescription>
                    Send automatic notifications to students with low credits
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="threshold">Credit threshold:</Label>
                    <Input
                      id="threshold"
                      type="number"
                      value={lowCreditsThreshold}
                      onChange={(e) => setLowCreditsThreshold(parseInt(e.target.value) || 0)}
                      className="w-20"
                      min="0"
                      max="50"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {lowCreditsStudents.length} student(s) eligible
                    </span>
                  </div>
                  
                  <Button 
                    onClick={sendLowCreditsNotifications}
                    disabled={sending || lowCreditsStudents.length === 0}
                    className="w-full"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send to {lowCreditsStudents.length} student(s)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Students with Low Balance</CardTitle>
                  <CardDescription>
                    List of students who will receive the notification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lowCreditsStudents.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {lowCreditsStudents.map((student) => (
                        <div key={student.id} className="flex justify-between items-center p-2 border rounded">
                          <div>
                            <div className="font-medium">{student.full_name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{student.email}</div>
                          </div>
                          <Badge variant={student.totalCredits === 0 ? 'destructive' : 'secondary'}>
                            {student.totalCredits} credits
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No students with low balance found
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send Custom Email
                </CardTitle>
                <CardDescription>
                  Send personalized messages to specific groups of students
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="sender-name">Sender name:</Label>
                  <Input
                    id="sender-name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Ex: Teacher Ana, Instructor Maria"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="filter-type">Filter students by:</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All students</SelectItem>
                        <SelectItem value="low_credits">Low credits</SelectItem>
                        <SelectItem value="zero_credits">Zero credits</SelectItem>
                        <SelectItem value="class">Specific class</SelectItem>
                        <SelectItem value="registration_day">Registration day</SelectItem>
                        <SelectItem value="selected">Manual selection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filterType === 'class' && (
                    <div>
                      <Label htmlFor="class-select">Select class:</Label>
                      <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map(cls => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name} - {cls.day_of_week} at {cls.time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {filterType === 'registration_day' && (
                    <div>
                      <Label htmlFor="day-select">Registration day of week:</Label>
                      <Select value={selectedDay} onValueChange={setSelectedDay}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a day" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {filterType === 'selected' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Manually select students:</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={selectAllFiltered}
                        >
                          {searchedStudents.every(s => selectedStudents.includes(s.id)) ? 'Unselect All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                          <Input
                            placeholder="Search students by name or email..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
                        {searchedStudents.map(student => (
                          <div key={student.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`student-${student.id}`}
                              checked={selectedStudents.includes(student.id)}
                              onCheckedChange={() => toggleStudentSelection(student.id)}
                            />
                            <Label htmlFor={`student-${student.id}`} className="text-sm flex-1">
                              {student.full_name} ({student.totalCredits} credits)
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                     <Filter className="h-4 w-4" />
                     <span className="font-medium text-gray-900 dark:text-white">
                       Selected students: {filteredStudents.length}
                     </span>
                   </div>
                  {filteredStudents.length > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {filteredStudents.slice(0, 5).map(s => s.full_name).join(', ')}
                      {filteredStudents.length > 5 && ` and ${filteredStudents.length - 5} more...`}
                    </div>
                  )}
                </div>

                {selectedTemplateId !== 'consentForm' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email-subject">Email subject:</Label>
                      <Input
                        id="email-subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Enter email subject"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email-message">Message:</Label>
                      <Textarea
                        id="email-message"
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        placeholder="Enter your message here..."
                        rows={6}
                      />
                    </div>
                  </div>
                )}

                {selectedTemplateId === 'consentForm' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        Consent Form Template Selected
                      </h4>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                      This will send the Pilates Lessons Policies consent form with the PDF attachment to selected students.
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      📎 Attachment: PilatesLessonsPolicies.pdf
                    </p>
                  </div>
                )}

                <Button
                  onClick={sendCustomEmail}
                  disabled={sending || filteredStudents.length === 0 || (selectedTemplateId !== 'consentForm' && (!emailSubject.trim() || !emailMessage.trim()))}
                  className="w-full"
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {selectedTemplateId === 'consentForm'
                        ? `Send Consent Form to ${filteredStudents.length} student(s)`
                        : `Send Email to ${filteredStudents.length} student(s)`
                      }
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Email Templates
                </CardTitle>
                <CardDescription>
                  Choose a pre-defined template to speed up email sending
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label htmlFor="preview-language">Template language:</Label>
                  <Select value={previewLanguage} onValueChange={setPreviewLanguage}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">🇧🇷 Portuguese</SelectItem>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                      <SelectItem value="fr">🇫🇷 French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <EmailTemplates
                  onSelectTemplate={handleTemplateSelection}
                  selectedTemplateId={selectedTemplateId}
                  language={previewLanguage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Email History
                </CardTitle>
                <CardDescription>
                  Record of all sent emails
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emailHistory.length > 0 ? (
                  <div className="space-y-4">
                    {emailHistory.map((entry) => (
                      <div key={entry.id} className="border rounded p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{entry.subject}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(entry.timestamp).toLocaleString('en-US')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="default">
                              {entry.success} sent
                            </Badge>
                            {entry.failed > 0 && (
                              <Badge variant="destructive">
                                {entry.failed} failed
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p>Type: {entry.type === 'low_credits' ? 'Low Balance' : 'Custom'}</p>
                          <p>Recipients: {entry.recipients}</p>
                          {entry.filterType && <p>Filter: {entry.filterType}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No emails sent yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
        </Tabs>
      </div>
    </div>
  );
};

export default EmailNotifications;

