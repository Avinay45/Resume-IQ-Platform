# Resume IQ: AI-Powered Resume Screening & Recruitment Platform

Resume IQ is an enterprise-grade recruitment and candidate evaluation dashboard. It automates the parsing, screening, and grading of resumes using Google Gemini AI, transitioning manual recruiting processes into intelligent, data-driven workflows.

![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8.0-purple?style=flat-square&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=flat-square&logo=supabase)
![Google Gemini](https://img.shields.io/badge/Gemini-AI--Screening-orange?style=flat-square&logo=google)

---

## 🚀 Key Features

*   **Dual-Database Adapter Architecture**: Out-of-the-box local sandbox mode (browser IndexedDB/LocalStorage) for instant evaluation without backend setup, plus fully integrated production-ready **Supabase** backend support.
*   **Intelligent Resume Parsing & Screening**: Bulk upload candidate resumes (supports `.pdf`, `.docx`, and `.zip` archives containing multiple resumes). The system extracts contact info, work history, education, and skills.
*   **Multi-Dimensional AI Evaluation**: Scores candidates (0-100) across Skills, Experience, and Education compatibility, giving clear recommendations (`Strong Shortlist`, `Shortlist`, `Consider`, `Reject`) backed by detailed AI reasoning.
*   **Kanban Recruitment Funnel Board**: Drag-and-drop or seamlessly update candidate stages (`Applied`, `AI Screened`, `Under Review`, `Shortlisted`, `Interview`, `Offer`, `Rejected`, `Hired`).
*   **Candidate Deep-Dive Drawer**: Access comprehensive insights for any candidate, highlighting:
    *   AI-generated strengths, weaknesses, and missing skills.
    *   Potential hiring risks and future growth potential.
    *   Personalized interview questions tailored to their background.
    *   Coding assessment reports and email logs.
*   **Simulated Coding Assessments**: Run technical coding assessments inside the platform. It tracks candidate code, records tab-switches (for integrity checking), logs execution outputs, and generates automated AI code reviews.
*   **Template-Based Email Utility**: Draft and log personalized emails (shortlist, rejection, interview schedule) using dynamic placeholders like `{{name}}`, `{{skills}}`, and `{{job_title}}`.
*   **Recruitment Metrics Dashboard**: Visual graphs and statistics illustrating active jobs, average applicant scores, recommendations, funnel distribution, and recent activity logs.

---

## 🛠️ Technology Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **Styling**: Modern Vanilla CSS (with responsive grid layouts, glassmorphism UI elements, and sleek CSS custom properties)
*   **Backend & Database**: Supabase JS Client & PostgreSQL
*   **AI Integration**: Google Gemini API & OpenRouter API (fallback)
*   **Libraries**:
    *   `pdfjs-dist`: Client-side parsing of PDF files
    *   `jszip`: Decompressing bulk `.zip` uploads
    *   `lucide-react`: Modern SVG icon pack

---

## 📂 Project Structure

```text
resume-iq/
├── public/                  # Static assets
├── src/
│   ├── assets/              # Icons and images
│   ├── components/          # Core React views and dashboard blocks
│   │   ├── DashboardView.tsx # Analytics, metrics, and activity logs
│   │   ├── JobsView.tsx      # Job management and creation
│   │   ├── CandidatesView.tsx # Kanban recruitment board & bulk uploads
│   │   ├── CandidateDrawer.tsx # In-depth details, AI evaluations, code tests & email
│   │   └── SettingsView.tsx  # API key configs and custom email templates
│   ├── context/             # Toast notifications and globally accessible contexts
│   ├── services/            # Backend adapters and AI services
│   │   ├── ai/
│   │   │   └── ai.ts        # Gemini AI prompt engineering & schema validation
│   │   ├── db/
│   │   │   ├── database.ts  # Database interface and routing logic
│   │   │   ├── localDatabase.ts # Sandbox/Local Storage Database Implementation
│   │   │   ├── supabaseDatabase.ts # Supabase PostgreSQL Integration
│   │   │   └── types.ts     # TypeScript schemas and definitions
│   │   └── email/
│   │       └── email.ts     # Email dispatch simulation & template compilation
│   ├── utils/               # File parsing utilities
│   │   ├── docxParser.ts    # JSZip-based DOCX parser
│   │   └── pdfParser.ts     # PDF.js-based PDF text extractor
│   ├── App.tsx              # Application layout and view Router
│   ├── index.css            # Global design tokens and styles
│   └── main.tsx             # Application bootstrap
├── schema.sql               # PostgreSQL tables, triggers, policies & indexes for Supabase
├── .env.example             # Configuration placeholders
└── vite.config.ts           # Vite Bundler configurations
```

---

## 💾 Database Schema

The production Supabase setup relies on the tables, indexes, and triggers defined in `schema.sql`:

1.  **`profiles`**: Extends Supabase auth. Contains user profile, company details, Gemini API configuration, and customized templates.
2.  **`jobs`**: Job postings including titles, departments, requirements, descriptions, and assessment configurations.
3.  **`candidates`**: Extracted candidate profiles containing experience history, education history, skills, resume texts, and current pipeline stages.
4.  **`evaluations`**: Deep AI assessment details including overall and category scores, reasoning, strengths, weaknesses, and hiring recommendations.
5.  **`interviews`**: AI-generated structured interview questions mapped to specific candidates.
6.  **`email_logs`**: History of communication dispatched to candidates.
7.  **`activity_logs`**: Chronological audit trail of actions taken in the platform.
8.  **`assessments`**: Details of simulated coding tests completed by candidates, including code files, test outputs, tab-switch counts, and AI reviews.

> [!NOTE]  
> All tables have Row Level Security (RLS) policies enabled to guarantee data separation between recruiters.

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Avinay45/Resume-IQ-Platform.git
cd resume-iq
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your credentials:
```env
# 1. Supabase Credentials (Optional)
# If left blank, the app runs in local sandbox database mode
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# 2. AI Credentials (Optional)
# If left blank, the app uses a rule-based mock screener for local test runs
VITE_GEMINI_API_KEY=your-google-gemini-api-key
VITE_OPENROUTER_API_KEY=your-openrouter-api-key

# 3. Email Credentials (Optional)
VITE_RESEND_API_KEY=your-resend-api-key
```

### 4. Database Setup (For Supabase Mode)
If you are using Supabase:
1. Log in to your **Supabase Dashboard** and create a new project.
2. Open the **SQL Editor** in Supabase.
3. Copy the contents of [schema.sql](file:///c:/Users/vinay/.gemini/antigravity-ide/scratch/resume-iq/schema.sql) and execute the query. This script creates all the necessary tables, configures Row Level Security (RLS) policies, and creates the triggers to auto-initialize profile records on new user registration.

### 5. Run the Application
Start the Vite development server locally:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 🛡️ License

This project is licensed under the MIT License.
