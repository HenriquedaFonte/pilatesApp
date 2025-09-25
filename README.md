# Pilates Studio Management System 🧘‍♀️

A comprehensive web application for managing Pilates studio operations, built with React, Supabase, and modern web technologies. This application provides a complete solution for studio owners to manage students, classes, attendance, and communications in multiple languages.

## 🌟 Features

### 👥 User Management
- **Dual Role System**: Separate interfaces for teachers and students
- **Student Registration**: Teachers can register students with language preferences
- **Secure Authentication**: Supabase-powered authentication with email/password
- **First-Time Login**: Automatic password change requirement for new students
- **Password Recovery**: Forgot password functionality with multi-language support

### 🌍 Multi-Language Support
- **Three Languages**: Portuguese (PT), English (EN), and French (FR)
- **Dynamic Switching**: Automatic language detection based on user preferences
- **Complete Localization**: All UI elements, emails, and content translated
- **Cultural Adaptation**: Date/time formatting and content adapted per language

### 📊 Teacher Dashboard
- **Student Management**: Add, view, and manage student profiles
- **Credit Management**: Track and update individual, duo, and group class credits
- **Class Scheduling**: Manage weekly class schedules and student enrollment
- **Reports & Analytics**:
  - Low Credits Report (students with ≤2 credits)
  - Attendance Reports with detailed analytics
  - Credit History tracking
- **Email Notifications**: Send customized notifications to students

### 👨‍🎓 Student Dashboard
- **Class Schedule**: View enrolled weekly classes
- **Credit Balance**: Monitor remaining class credits
- **Attendance History**: Track class attendance and credit usage
- **Profile Management**: Update personal information and language preferences
- **Activity Feed**: Recent credit transactions and class history

### 📧 Communication System
- **Multi-Language Emails**: All notifications sent in student's preferred language
- **Automated Notifications**:
  - Welcome emails for new students
  - Low credit alerts
  - Class reminders
  - Custom notifications
- **Email Templates**: Professionally designed HTML templates

### 📈 Reporting & Analytics
- **Low Credits Monitoring**: Identify students needing credit purchases
- **Attendance Tracking**: Detailed attendance records and statistics
- **Credit History**: Complete transaction history for all students
- **Export Functionality**: CSV export for all reports

## 🛠️ Technology Stack

### Frontend
- **React 19** - Modern React with hooks and concurrent features
- **Vite** - Fast build tool and development server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component library
- **React Hook Form** - Form management and validation
- **React i18next** - Internationalization framework

### Backend & Database
- **Supabase** - Backend-as-a-Service (Authentication, Database, Storage)
- **PostgreSQL** - Robust relational database
- **Supabase Functions** - Serverless functions for complex operations

### Development Tools
- **ESLint** - Code linting and formatting
- **Vite** - Development server and build tool
- **pnpm** - Fast package manager

## 🚀 Installation

### Prerequisites
- Node.js 18+ and pnpm
- Supabase account and project
- Git

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/HenriquedaFonte/pilatesApp.git
   cd pilatesApp
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_STUDIO_EMAIL=your_studio_email
   VITE_STUDIO_NAME=your_studio_name
   VITE_STUDIO_PHONE=your_studio_phone
   ```

4. **Database Setup**
   - Create a new Supabase project
   - Run the SQL migrations in `notification_functions.sql`
   - Configure authentication settings
   - Set up email service integration

5. **Start Development Server**
   ```bash
   pnpm dev
   ```

6. **Build for Production**
   ```bash
   pnpm build
   pnpm preview
   ```

## 📁 Project Structure

```
pilatesApp/
├── public/                 # Static assets
│   ├── favicon.ico
│   └── logo.jpg
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Radix UI components
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.jsx    # Authentication hook
│   │   └── use-mobile.js
│   ├── lib/               # Utility libraries
│   │   ├── supabase.js    # Supabase client
│   │   ├── emailService.js # Email functionality
│   │   ├── emailTemplates.js # Email templates
│   │   └── i18n.js        # Internationalization config
│   ├── locales/           # Translation files
│   │   ├── en.json        # English translations
│   │   ├── pt.json        # Portuguese translations
│   │   └── fr.json        # French translations
│   ├── pages/             # Application pages
│   │   ├── Login.jsx      # Authentication
│   │   ├── Signup.jsx     # Student registration
│   │   ├── TeacherDashboard.jsx
│   │   ├── StudentDashboard.jsx
│   │   ├── TeacherStudents.jsx
│   │   ├── StudentHistory.jsx
│   │   ├── lowCreditsReport.jsx
│   │   ├── AttendanceReport.jsx
│   │   ├── CreditHistoryReport.jsx
│   │   └── ...
│   └── utils/             # Utility functions
├── .env                   # Environment variables
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
└── README.md             # This file
```

## 🎯 Usage

### For Teachers
1. **Login** with teacher credentials
2. **Manage Students**: Add new students, update credits, enroll in classes
3. **View Reports**: Monitor attendance, credits, and generate reports
4. **Send Notifications**: Communicate with students via email
5. **Schedule Management**: Create and manage class schedules

### For Students
1. **First Login**: Change default password ("000000")
2. **Update Profile**: Set language preferences and personal information
3. **View Schedule**: See enrolled classes and times
4. **Track Progress**: Monitor credit balance and attendance history
5. **Receive Notifications**: Get updates in preferred language

## 🌐 Internationalization

The application supports three languages with complete localization:

- **Portuguese (pt)**: Primary language for Brazilian users
- **English (en)**: International standard
- **French (fr)**: For French-speaking users

Language switching is automatic based on user profile settings. All user-facing text, dates, emails, and content adapt to the selected language.

## 📧 Email System

The application includes a comprehensive email system:

- **Welcome Emails**: Sent to new students in their preferred language
- **Credit Alerts**: Notifications when credits are low
- **Password Reset**: Secure password recovery
- **Custom Notifications**: Teacher-initiated communications
- **Class Reminders**: Automated scheduling notifications

## 🔒 Security Features

- **Supabase Authentication**: Secure user authentication and authorization
- **Password Policies**: Enforced password changes for new users
- **Role-Based Access**: Separate permissions for teachers and students
- **Data Validation**: Input validation and sanitization
- **Secure API**: All backend communications secured

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Use TypeScript for type safety (when applicable)
- Maintain consistent code style
- Add tests for new features
- Update documentation

## 📄 License

This project is private and proprietary. All rights reserved.

## 👥 Support

For support or questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation for common solutions

## 🙏 Acknowledgments

- **Supabase** for the excellent backend platform
- **Radix UI** for accessible component primitives
- **Tailwind CSS** for the utility-first styling approach
- **React Community** for the amazing ecosystem

---

**Built with ❤️ for Pilates studios worldwide**