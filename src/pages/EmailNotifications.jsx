import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import emailService from '../lib/emailService';
import EmailTemplates from '../components/EmailTemplates';
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
import { Switch } from '@/components/ui/switch';
import { MessageCircle } from 'lucide-react'; 
import { 
  Loader2, 
  Send, 
  Users, 
  AlertTriangle, 
  ArrowLeft, 
  Activity,
  LogOut,
  Mail,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  FileText
} from 'lucide-react';

const EmailNotifications = () => {
  const { profile, signOut } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info', 'success', 'error'
  // Form state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [lowCreditsThreshold, setLowCreditsThreshold] = useState(3);
  const [senderName, setSenderName] = useState(profile?.full_name || 'Professora');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Email history
  const [emailHistory, setEmailHistory] = useState([]);
  //const [showHistory, setShowHistory] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadData();
    loadEmailHistory();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load students with their credits
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

      // Calculate total credits for each student
      const studentsWithTotalCredits = (studentsData || []).map(student => ({
        ...student,
        totalCredits: (student.individual_credits || 0) + (student.duo_credits || 0) + (student.group_credits || 0)
      }));

      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, type')
        .order('name');

      if (classesError) throw classesError;

      setStudents(studentsWithTotalCredits);
      setClasses(classesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Erro ao carregar dados: ' + error.message);
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

      // Group notifications by batch (same timestamp and subject)
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

  // Filter students based on selected criteria
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
          // For now, return all students since we'd need enrollment data
          // In a real implementation, you'd join with enrollments table
          filtered = students; // This would be filtered by actual class enrollment
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
        // 'all' - return all students
        break;
    }

    return filtered;
  };

  // Send low credits notifications
  const sendLowCreditsNotifications = async () => {
    setSending(true);
    setMessage('');
    
    try {
      const lowCreditsStudents = students.filter(student => student.totalCredits <= lowCreditsThreshold);
      
      if (lowCreditsStudents.length === 0) {
        setMessage('Nenhum aluno com saldo baixo de créditos encontrado.');
        setMessageType('info');
        return;
      }

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const student of lowCreditsStudents) {
        try {
          await emailService.sendLowCreditsNotification(student, student.totalCredits);

          // Log successful email to database
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

          // Log failed email to database
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

        // Add small delay between emails
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      
      setMessage(`Notificações enviadas: ${successCount} sucessos, ${failCount} falhas.`);
      setMessageType(failCount === 0 ? 'success' : 'error');

      // Reload email history to show the new entries
      await loadEmailHistory();
    } catch (error) {
      console.error('Error sending notifications:', error);
      setMessage('Erro ao enviar notificações: ' + error.message);
      setMessageType('error');
    } finally {
      setSending(false);
    }
  };

  // Send custom email
  const sendCustomEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      setMessage('Por favor, preencha o assunto e a mensagem do e-mail.');
      setMessageType('error');
      return;
    }

    const targetStudents = getFilteredStudents();
    
    if (targetStudents.length === 0) {
      setMessage('Nenhum aluno selecionado para envio.');
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

      // Log each email result to database
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


      setMessage(`E-mail enviado: ${successCount} sucessos, ${failCount} falhas.`);
      setMessageType(failCount === 0 ? 'success' : 'error');

      // Reload email history to show the new entries
      await loadEmailHistory();

      // Clear form on success
      if (failCount === 0) {
        setEmailSubject('');
        setEmailMessage('');
      }
    } catch (error) {
      console.error('Error sending custom email:', error);
      setMessage('Erro ao enviar e-mail: ' + error.message);
      setMessageType('error');
    } finally {
      setSending(false);
    }
  };

  // Handle template selection
  const handleTemplateSelection = (template) => {
    setSelectedTemplateId(template.id);
    setEmailSubject(template.subject);
    setEmailMessage(template.message);
    setMessage(`Template "${template.title}" selecionado! Você pode personalizar a mensagem antes de enviar.`);
    setMessageType('info');
  };
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Select all filtered students
  const selectAllFiltered = () => {
    const filteredStudents = getFilteredStudents();
    const allSelected = filteredStudents.every(student => selectedStudents.includes(student.id));
    
    if (allSelected) {
      // Deselect all filtered students
      setSelectedStudents(prev => prev.filter(id => !filteredStudents.some(s => s.id === id)));
    } else {
      // Select all filtered students
      const newSelections = filteredStudents.map(s => s.id);
      setSelectedStudents(prev => [...new Set([...prev, ...newSelections])]);
    }
  };

  const filteredStudents = getFilteredStudents();
  const lowCreditsStudents = students.filter(s => s.totalCredits <= lowCreditsThreshold);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/teacher/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <Activity className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Notificações por E-mail</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Olá, {profile?.full_name}</span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>            
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Messages */}
        {message && (
          <Alert variant={messageType === 'error' ? 'destructive' : 'default'} className="mb-6">
            {messageType === 'success' && <CheckCircle className="h-4 w-4" />}
            {messageType === 'error' && <XCircle className="h-4 w-4" />}
            {messageType === 'info' && <AlertTriangle className="h-4 w-4" />}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Alunos</p>
                  <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Saldo Baixo</p>
                  <p className="text-2xl font-bold text-gray-900">{lowCreditsStudents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Sem Créditos</p>
                  <p className="text-2xl font-bold text-gray-900">
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
                  <p className="text-sm font-medium text-gray-600">E-mails Enviados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {emailHistory.reduce((total, entry) => total + entry.success, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="notifications" className="space-y-4">
          <TabsList>
            <TabsTrigger value="notifications">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Saldo Baixo
            </TabsTrigger>
            <TabsTrigger value="custom">
              <Send className="h-4 w-4 mr-2" />
              E-mail Personalizado
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Low Credits Notifications Tab */}
          <TabsContent value="notifications">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Notificações de Saldo Baixo
                  </CardTitle>
                  <CardDescription>
                    Envie notificações automáticas para alunos com poucos créditos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="threshold">Limite de créditos:</Label>
                    <Input
                      id="threshold"
                      type="number"
                      value={lowCreditsThreshold}
                      onChange={(e) => setLowCreditsThreshold(parseInt(e.target.value) || 0)}
                      className="w-20"
                      min="0"
                      max="50"
                    />
                    <span className="text-sm text-gray-600">
                      {lowCreditsStudents.length} aluno(s) elegível(is)
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
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar para {lowCreditsStudents.length} aluno(s)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Preview of students with low credits */}
              <Card>
                <CardHeader>
                  <CardTitle>Alunos com Saldo Baixo</CardTitle>
                  <CardDescription>
                    Lista de alunos que receberão a notificação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lowCreditsStudents.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {lowCreditsStudents.map((student) => (
                        <div key={student.id} className="flex justify-between items-center p-2 border rounded">
                          <div>
                            <div className="font-medium">{student.full_name}</div>
                            <div className="text-sm text-gray-500">{student.email}</div>
                          </div>
                          <Badge variant={student.totalCredits === 0 ? 'destructive' : 'secondary'}>
                            {student.totalCredits} créditos
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      Nenhum aluno com saldo baixo encontrado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Custom Email Tab */}
          <TabsContent value="custom">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Enviar E-mail Personalizado
                </CardTitle>
                <CardDescription>
                  Envie mensagens personalizadas para grupos específicos de alunos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sender Name */}
                <div>
                  <Label htmlFor="sender-name">Nome do remetente:</Label>
                  <Input
                    id="sender-name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Ex: Professora Ana, Instrutora Maria"
                  />
                </div>

                {/* Filter Options */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="filter-type">Filtrar alunos por:</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um filtro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os alunos</SelectItem>
                        <SelectItem value="low_credits">Saldo baixo de créditos</SelectItem>
                        <SelectItem value="zero_credits">Sem créditos</SelectItem>
                        <SelectItem value="class">Aula específica</SelectItem>
                        <SelectItem value="registration_day">Dia de cadastro</SelectItem>
                        <SelectItem value="selected">Seleção manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filterType === 'class' && (
                    <div>
                      <Label htmlFor="class-select">Selecionar aula:</Label>
                      <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma aula" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map(cls => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name} - {cls.day_of_week} às {cls.time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {filterType === 'registration_day' && (
                    <div>
                      <Label htmlFor="day-select">Dia da semana de cadastro:</Label>
                      <Select value={selectedDay} onValueChange={setSelectedDay}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um dia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Domingo</SelectItem>
                          <SelectItem value="1">Segunda-feira</SelectItem>
                          <SelectItem value="2">Terça-feira</SelectItem>
                          <SelectItem value="3">Quarta-feira</SelectItem>
                          <SelectItem value="4">Quinta-feira</SelectItem>
                          <SelectItem value="5">Sexta-feira</SelectItem>
                          <SelectItem value="6">Sábado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {filterType === 'selected' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Selecionar alunos manualmente:</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={selectAllFiltered}
                        >
                          {filteredStudents.every(s => selectedStudents.includes(s.id)) ? 'Desmarcar Todos' : 'Marcar Todos'}
                        </Button>
                      </div>
                      <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
                        {students.map(student => (
                          <div key={student.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`student-${student.id}`}
                              checked={selectedStudents.includes(student.id)}
                              onCheckedChange={() => toggleStudentSelection(student.id)}
                            />
                            <Label htmlFor={`student-${student.id}`} className="text-sm flex-1">
                              {student.full_name} ({student.totalCredits} créditos)
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview filtered students */}
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="h-4 w-4" />
                    <span className="font-medium">
                      Alunos selecionados: {filteredStudents.length}
                    </span>
                  </div>
                  {filteredStudents.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {filteredStudents.slice(0, 5).map(s => s.full_name).join(', ')}
                      {filteredStudents.length > 5 && ` e mais ${filteredStudents.length - 5}...`}
                    </div>
                  )}
                </div>

                {/* Email content */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email-subject">Assunto do e-mail:</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Digite o assunto do e-mail"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email-message">Mensagem:</Label>
                    <Textarea
                      id="email-message"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Digite sua mensagem aqui..."
                      rows={6}
                    />
                  </div>
                </div>

                <Button 
                  onClick={sendCustomEmail}
                  disabled={sending || filteredStudents.length === 0 || !emailSubject.trim() || !emailMessage.trim()}
                  className="w-full"
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar E-mail para {filteredStudents.length} aluno(s)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Templates de E-mail
                </CardTitle>
                <CardDescription>
                  Escolha um template pré-definido para agilizar o envio de e-mails
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmailTemplates
                  onSelectTemplate={handleTemplateSelection}
                  selectedTemplateId={selectedTemplateId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico de E-mails
                </CardTitle>
                <CardDescription>
                  Registro de todos os e-mails enviados
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
                            <p className="text-sm text-gray-500">
                              {new Date(entry.timestamp).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="default">
                              {entry.success} enviados
                            </Badge>
                            {entry.failed > 0 && (
                              <Badge variant="destructive">
                                {entry.failed} falhas
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p>Tipo: {entry.type === 'low_credits' ? 'Saldo Baixo' : 'Personalizado'}</p>
                          <p>Destinatários: {entry.recipients}</p>
                          {entry.filterType && <p>Filtro: {entry.filterType}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum e-mail enviado ainda
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

