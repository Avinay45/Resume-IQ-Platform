export interface IProfile {
  id: string;
  updated_at?: string;
  full_name?: string;
  company_name?: string;
  settings: ISettings;
}

export interface ISettings {
  geminiApiKey?: string;
  openrouterApiKey?: string;
  useOpenRouter?: boolean;
  resendApiKey?: string;
  emailTemplates?: {
    shortlisted: string;
    rejected: string;
    interview: string;
  };
}

export interface IJob {
  id: string;
  created_at: string;
  created_by?: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  seniority: string;
  description: string;
  requirements: {
    required_skills: string[];
    preferred_skills: string[];
    experience_years: number;
    education: string;
    keywords: string[];
    technologies: string[];
  };
  status: 'active' | 'archived';
  assessment_test?: string;
}

export interface ICandidate {
  id: string;
  created_at: string;
  job_id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: {
    company: string;
    role: string;
    duration: string;
    description: string;
  }[];
  education: {
    institution: string;
    degree: string;
    field: string;
    year: string;
  }[];
  certifications: string[];
  projects: {
    name: string;
    description: string;
    url?: string;
  }[];
  resume_url?: string;
  resume_text?: string;
  stage: 'applied' | 'ai_screened' | 'under_review' | 'shortlisted' | 'interview' | 'offer' | 'rejected' | 'hired';
  rank_position: number;
}

export interface IEvaluation {
  id: string;
  candidate_id: string;
  overall_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  recommendation: 'Strong Shortlist' | 'Shortlist' | 'Consider' | 'Reject';
  reasoning: string; // Markdown summary of comparison
  candidate_summary: string;
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  hiring_risks: string[];
  growth_potential?: string;
  scoring_details: {
    skills: { name: string; matched: boolean; evidence?: string }[];
    experience: { requirement: string; matched: boolean; evidence?: string }[];
    education: { requirement: string; matched: boolean; evidence?: string }[];
  };
  created_at: string;
}

export interface IInterviewGuide {
  id: string;
  candidate_id: string;
  questions: {
    technical: { question: string; focus: string; ideal_answer?: string }[];
    behavioral: { question: string; focus: string; ideal_answer?: string }[];
    experience_validation: { question: string; focus: string; ideal_answer?: string }[];
    skill_verification: { question: string; focus: string; ideal_answer?: string }[];
  };
  created_at: string;
}

export interface IEmailLog {
  id: string;
  candidate_id: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  trigger_event: string; // e.g. 'shortlisted', 'rejected', 'interview'
  sent_at: string;
}

export interface IActivityLog {
  id: string;
  created_at: string;
  user_id?: string;
  job_id?: string;
  candidate_id?: string;
  action: 'resume_uploaded' | 'candidate_screened' | 'candidate_shortlisted' | 'candidate_rejected' | 'email_sent' | 'stage_changed' | 'job_created';
  details: {
    candidateName?: string;
    jobTitle?: string;
    stageFrom?: string;
    stageTo?: string;
    emailTrigger?: string;
    [key: string]: any;
  };
}

export interface IAssessment {
  id: string;
  candidate_id: string;
  job_id: string;
  test_name: string;
  language: string;
  score: number;
  time_taken_minutes: number;
  tab_switches_count: number;
  submitted_code: string;
  test_run_output: string;
  ai_code_review: {
    correctness: string;
    complexity: { time: string; space: string };
    quality_rating: 'A' | 'B' | 'C' | 'D' | 'F';
    strengths: string[];
    improvements: string[];
    refactored_code: string;
  };
  created_at: string;
}
