-- ==========================================
-- RESUMEIQ SUPABASE SQL INITIALIZATION SCHEMA
-- Paste this script directly into your Supabase SQL Editor
-- ==========================================

-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  full_name TEXT,
  company_name TEXT,
  settings JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual read/write to profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Trigger to automatically create a profile record when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, settings)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Recruiter'),
    '{"geminiApiKey":"","useOpenRouter":false,"emailTemplates":{"shortlisted":"Hi {{name}},\\n\\nWe were highly impressed by your experience with {{skills}}. We''d love to invite you for an interview for the {{job_title}} position.\\n\\nBest regards,\\nRecruiting Team","rejected":"Hi {{name}},\\n\\nThank you for applying to the {{job_title}} role. While your background is impressive, we have decided to move forward with other candidates.\\n\\nBest regards,\\nRecruiting Team","interview":"Hi {{name}},\\n\\nWe would like to schedule an interview with you for the {{job_title}} role. Please let us know your availability.\\n\\nBest regards,\\nRecruiting Team"}}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Jobs Table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  location TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  seniority TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  assessment_test TEXT
);

-- Enable RLS for Jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user jobs access" ON public.jobs
  FOR ALL USING (auth.uid() = created_by);


-- 3. Candidates Table
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  skills TEXT[] DEFAULT '{}'::text[],
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  certifications TEXT[] DEFAULT '{}'::text[],
  projects JSONB DEFAULT '[]'::jsonb,
  resume_url TEXT,
  resume_text TEXT,
  stage TEXT DEFAULT 'applied' CHECK (stage IN ('applied', 'ai_screened', 'under_review', 'shortlisted', 'interview', 'offer', 'rejected', 'hired')),
  rank_position INT DEFAULT 0
);

-- Enable RLS for Candidates
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user candidate access" ON public.candidates
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.jobs WHERE jobs.id = candidates.job_id AND jobs.created_by = auth.uid()
  ));


-- 4. Evaluations Table
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE UNIQUE NOT NULL,
  overall_score INT CHECK (overall_score BETWEEN 0 AND 100) NOT NULL,
  skills_score INT CHECK (skills_score BETWEEN 0 AND 100) NOT NULL,
  experience_score INT CHECK (experience_score BETWEEN 0 AND 100) NOT NULL,
  education_score INT CHECK (education_score BETWEEN 0 AND 100) NOT NULL,
  recommendation TEXT CHECK (recommendation IN ('Strong Shortlist', 'Shortlist', 'Consider', 'Reject')) NOT NULL,
  reasoning TEXT NOT NULL,
  candidate_summary TEXT NOT NULL,
  strengths TEXT[] DEFAULT '{}'::text[] NOT NULL,
  weaknesses TEXT[] DEFAULT '{}'::text[] NOT NULL,
  missing_skills TEXT[] DEFAULT '{}'::text[] NOT NULL,
  hiring_risks TEXT[] DEFAULT '{}'::text[] NOT NULL,
  growth_potential TEXT,
  scoring_details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Evaluations
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user evaluations access" ON public.evaluations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.candidates 
    JOIN public.jobs ON jobs.id = candidates.job_id 
    WHERE candidates.id = evaluations.candidate_id AND jobs.created_by = auth.uid()
  ));


-- 5. Interviews Table
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE UNIQUE NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Interviews
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user interviews access" ON public.interviews
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.candidates 
    JOIN public.jobs ON jobs.id = candidates.job_id 
    WHERE candidates.id = interviews.candidate_id AND jobs.created_by = auth.uid()
  ));


-- 6. Email Logs Table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')) NOT NULL,
  trigger_event TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Email Logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user email_logs access" ON public.email_logs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.candidates 
    JOIN public.jobs ON jobs.id = candidates.job_id 
    WHERE candidates.id = email_logs.candidate_id AND jobs.created_by = auth.uid()
  ));


-- 7. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- Enable RLS for Activity Logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user activity_logs access" ON public.activity_logs
  FOR ALL USING (auth.uid() = user_id);

-- 8. Coding Assessments Table
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE UNIQUE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  test_name TEXT NOT NULL,
  language TEXT NOT NULL,
  score INT CHECK (score BETWEEN 0 AND 100) NOT NULL,
  time_taken_minutes INT NOT NULL,
  tab_switches_count INT NOT NULL,
  submitted_code TEXT NOT NULL,
  test_run_output TEXT NOT NULL,
  ai_code_review JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Assessments
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user assessments access" ON public.assessments
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.candidates 
    JOIN public.jobs ON jobs.id = candidates.job_id 
    WHERE candidates.id = assessments.candidate_id AND jobs.created_by = auth.uid()
  ));

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assessments_candidate_id ON public.assessments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON public.candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates(email);
CREATE INDEX IF NOT EXISTS idx_evaluations_candidate_id ON public.evaluations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON public.interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_candidate_id ON public.email_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
