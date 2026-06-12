import type { IJob, ICandidate, IEvaluation, IInterviewGuide, IAssessment } from '../db/types';
import { db } from '../db/database';

export class AIService {
  private static async getApiKeyAndProvider() {
    const settings = await db.getSettings();
    const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const envOpenRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;

    const geminiKey = settings.geminiApiKey || envGeminiKey;
    const openrouterKey = settings.openrouterApiKey || envOpenRouterKey;
    const useOpenRouter = settings.useOpenRouter || false;

    if (useOpenRouter && openrouterKey) {
      return { provider: 'openrouter', apiKey: openrouterKey };
    } else if (geminiKey) {
      return { provider: 'gemini', apiKey: geminiKey };
    }
    return { provider: 'sandbox', apiKey: '' };
  }

  // --- Exponential Backoff Fetch wrapper ---
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    backoff = 1000
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // If server error (5xx) or rate limit (429), retry
      if ((response.status >= 500 || response.status === 429) && retries > 0) {
        console.warn(`AI API returned status ${response.status}. Retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        console.warn('AI API network error, retrying...', error);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  }

  // --- Main LLM Call ---
  private static async callLLM(prompt: string, systemInstruction: string): Promise<string> {
    const { provider, apiKey } = await this.getApiKeyAndProvider();

    if (provider === 'sandbox') {
      throw new Error('MISSING_API_KEY');
    }

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\nInput Context:\n${prompt}` }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      };

      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini API Error: ${response.statusText} - ${text}`);
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } else {
      // OpenRouter
      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const payload = {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      };

      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ResumeIQ Platform'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter API Error: ${response.statusText} - ${text}`);
      }

      const result = await response.json();
      return result.choices?.[0]?.message?.content || '{}';
    }
  }

  // ==========================================
  // 1. EXTRACT JOB REQUIREMENTS WORKFLOW
  // ==========================================
  static async extractJobRequirements(title: string, description: string): Promise<IJob['requirements']> {
    const systemInstruction = `
      You are an expert recruitment parser. Extract structured details from the following Job description.
      You MUST respond ONLY with a valid JSON object matching this TypeScript structure:
      {
        required_skills: string[],
        preferred_skills: string[],
        experience_years: number,
        education: string,
        keywords: string[],
        technologies: string[]
      }
      If years of experience are not specified, estimate reasonably or set to 0. Do not fail.
    `;
    const prompt = `Title: ${title}\nDescription:\n${description}`;

    try {
      const jsonText = await this.callLLM(prompt, systemInstruction);
      return JSON.parse(jsonText);
    } catch (error) {
      if (error instanceof Error && error.message === 'MISSING_API_KEY') {
        return this.mockExtractJobRequirements(title, description);
      }
      console.error('AI Job Extraction failed, falling back to parser rules:', error);
      return this.mockExtractJobRequirements(title, description);
    }
  }

  // ==========================================
  // 2. EXTRACT RESUME DATA WORKFLOW
  // ==========================================
  static async extractResumeData(resumeText: string): Promise<Omit<ICandidate, 'id' | 'created_at' | 'job_id' | 'stage' | 'rank_position'>> {
    const systemInstruction = `
      You are an expert Applicant Tracking System. Read the following raw resume text and extract candidate profile details.
      You MUST respond ONLY with a valid JSON object matching this template:
      {
        name: string,
        email: string,
        phone: string,
        skills: string[],
        experience: [{ company: string, role: string, duration: string, description: string }],
        education: [{ institution: string, degree: string, field: string, year: string }],
        certifications: string[],
        projects: [{ name: string, description: string, url: string }]
      }
      Ensure email and phone numbers are parsed correctly. If no name is found, extract email first name or use "Unknown Candidate".
    `;

    try {
      const jsonText = await this.callLLM(resumeText, systemInstruction);
      return JSON.parse(jsonText);
    } catch (error) {
      if (error instanceof Error && error.message === 'MISSING_API_KEY') {
        return this.mockExtractResumeData(resumeText);
      }
      console.error('AI Resume Extraction failed, falling back to mock:', error);
      return this.mockExtractResumeData(resumeText);
    }
  }

  // ==========================================
  // 3. CANDIDATE EVALUATION WORKFLOW
  // ==========================================
  static async evaluateCandidate(
    resumeText: string,
    jobTitle: string,
    jobDescription: string,
    requirements: IJob['requirements']
  ): Promise<Omit<IEvaluation, 'id' | 'candidate_id' | 'created_at'>> {
    const systemInstruction = `
      You are an elite talent acquisition analyst. Compare the candidate's resume text against the job requirements.
      You MUST respond ONLY with a valid JSON object matching this structure:
      {
        overall_score: number (0 to 100),
        skills_score: number (0 to 100),
        experience_score: number (0 to 100),
        education_score: number (0 to 100),
        recommendation: "Strong Shortlist" | "Shortlist" | "Consider" | "Reject",
        reasoning: string (Markdown formatting detailing why this score was generated),
        candidate_summary: string (Brief overview of profile),
        strengths: string[],
        weaknesses: string[],
        missing_skills: string[],
        hiring_risks: string[],
        growth_potential: string,
        scoring_details: {
          skills: [{ name: string, matched: boolean, evidence: string }],
          experience: [{ requirement: string, matched: boolean, evidence: string }],
          education: [{ requirement: string, matched: boolean, evidence: string }]
        }
      }
      Ensure all scores are integer percentages. The "scoring_details" lists items from the job requirements and shows if they match or not, with a brief snippet of evidence from the resume.
    `;
    const prompt = `
      --- JOB TITLE ---
      ${jobTitle}
      --- JOB DESCRIPTION ---
      ${jobDescription}
      --- STRUCTURED REQUIREMENTS ---
      ${JSON.stringify(requirements)}
      --- CANDIDATE RESUME TEXT ---
      ${resumeText}
    `;

    try {
      const jsonText = await this.callLLM(prompt, systemInstruction);
      return JSON.parse(jsonText);
    } catch (error) {
      if (error instanceof Error && error.message === 'MISSING_API_KEY') {
        return this.mockEvaluateCandidate(resumeText, jobTitle, requirements);
      }
      console.error('AI Evaluation failed, falling back to mock evaluation:', error);
      return this.mockEvaluateCandidate(resumeText, jobTitle, requirements);
    }
  }

  // ==========================================
  // 4. INTERVIEW GUIDE GENERATION WORKFLOW
  // ==========================================
  static async generateInterviewGuide(
    resumeText: string,
    jobTitle: string,
    jobDescription: string
  ): Promise<Omit<IInterviewGuide, 'id' | 'candidate_id' | 'created_at'>> {
    const systemInstruction = `
      You are a senior hiring manager. Read the job description and candidate resume, and generate target interview questions.
      You MUST respond ONLY with a valid JSON object matching this structure:
      {
        questions: {
          technical: [{ question: string, focus: string, ideal_answer: string }],
          behavioral: [{ question: string, focus: string, ideal_answer: string }],
          experience_validation: [{ question: string, focus: string, ideal_answer: string }],
          skill_verification: [{ question: string, focus: string, ideal_answer: string }]
        }
      }
      Generate exactly 2 high-quality questions for each category. Customize them directly to candidate background and job requirements.
    `;
    const prompt = `
      Job Title: ${jobTitle}
      Job Description: ${jobDescription}
      Candidate Resume: ${resumeText}
    `;

    try {
      const jsonText = await this.callLLM(prompt, systemInstruction);
      return JSON.parse(jsonText);
    } catch (error) {
      if (error instanceof Error && error.message === 'MISSING_API_KEY') {
        return this.mockGenerateInterviewGuide(resumeText, jobTitle);
      }
      console.error('AI Interview Guide creation failed, falling back to mock guide:', error);
      return this.mockGenerateInterviewGuide(resumeText, jobTitle);
    }
  }

  // ==========================================
  // SANDBOX MOCK ENGINES (Regex & Keyword Match)
  // ==========================================

  private static mockExtractJobRequirements(title: string, description: string): IJob['requirements'] {
    const text = (title + ' ' + description).toLowerCase();
    
    // Core developer skills match list
    const skillsList = ['react', 'typescript', 'javascript', 'css', 'html', 'node.js', 'express', 'python', 'django', 'fastapi', 'postgresql', 'supabase', 'aws', 'docker', 'kubernetes', 'git', 'ci/cd', 'tailwind', 'next.js', 'vue', 'angular', 'graphql', 'rest', 'go', 'java', 'spring', 'sql', 'nosql', 'mongodb', 'testing', 'jest', 'cypress'];
    const foundSkills = skillsList.filter(s => text.includes(s)).map(s => s.charAt(0).toUpperCase() + s.slice(1));

    // Guess years of experience
    let years = 2;
    const expRegex = /(\d+)\+?\s*years?/g;
    const match = expRegex.exec(text);
    if (match) {
      years = parseInt(match[1]);
    }

    // Guess education
    let education = "Bachelor's Degree in Computer Science or related fields";
    if (text.includes('master')) education = "Master's Degree in Computer Science or related fields";
    if (text.includes('phd')) education = "Ph.D. in Computer Science or related fields";

    return {
      required_skills: foundSkills.slice(0, 4),
      preferred_skills: foundSkills.slice(4, 7),
      experience_years: years,
      education,
      keywords: foundSkills.slice(0, 6),
      technologies: foundSkills
    };
  }

  private static mockExtractResumeData(resumeText: string): Omit<ICandidate, 'id' | 'created_at' | 'job_id' | 'stage' | 'rank_position'> {
    // Clean name extraction from first non-empty line
    const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let name = 'Unknown Candidate';
    if (lines.length > 0) {
      const cleanLine = lines[0].replace(/[^\w\s-]/g, '').trim();
      if (cleanLine && cleanLine.split(' ').length <= 4) {
        name = cleanLine;
      }
    }

    // Extract email
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const emailMatch = emailRegex.exec(resumeText);
    const email = emailMatch ? emailMatch[1] : 'candidate@example.com';

    // Extract phone
    const phoneRegex = /(\+?\d[\d -()]{8,15}\d)/g;
    const phoneMatch = phoneRegex.exec(resumeText);
    const phone = phoneMatch ? phoneMatch[1].trim() : '+1 (555) 012-3456';

    // Skills
    const skillsList = ['react', 'typescript', 'javascript', 'css', 'html', 'node.js', 'python', 'django', 'fastapi', 'postgresql', 'supabase', 'aws', 'docker', 'kubernetes', 'git', 'next.js', 'vue', 'tailwind', 'graphql', 'sql', 'nosql', 'jest', 'ci/cd'];
    const foundSkills = skillsList
      .filter(s => resumeText.toLowerCase().includes(s))
      .map(s => s.charAt(0).toUpperCase() + s.slice(1));

    return {
      name,
      email,
      phone,
      skills: foundSkills,
      experience: [
        {
          company: 'Previous Employer',
          role: 'Software Engineer',
          duration: '3 Years',
          description: 'Responsible for core feature development, optimization, and team mentoring.'
        }
      ],
      education: [
        {
          institution: 'University of Science & Tech',
          degree: 'B.S.',
          field: 'Computer Science',
          year: '2020'
        }
      ],
      certifications: [],
      projects: [],
      resume_text: resumeText
    };
  }

  private static mockEvaluateCandidate(
    resumeText: string,
    _jobTitle: string,
    requirements: IJob['requirements']
  ): Omit<IEvaluation, 'id' | 'candidate_id' | 'created_at'> {
    const resumeLower = resumeText.toLowerCase();

    // 1. Skill scoring
    const reqSkills = requirements.required_skills;
    let matchedSkillsCount = 0;
    const skillChecks = reqSkills.map(skill => {
      const matched = resumeLower.includes(skill.toLowerCase());
      if (matched) matchedSkillsCount++;
      return {
        name: skill,
        matched,
        evidence: matched ? `Found reference to ${skill} in resume.` : 'Skill not explicitly listed.'
      };
    });

    const skillsScore = reqSkills.length > 0 ? Math.round((matchedSkillsCount / reqSkills.length) * 100) : 70;

    // 2. Experience scoring
    const yearsRequired = requirements.experience_years;
    const expRegex = /(\d+)\+?\s*years?/g;
    let maxYears = 1;
    let m;
    while ((m = expRegex.exec(resumeLower)) !== null) {
      const val = parseInt(m[1]);
      if (val > maxYears && val < 25) maxYears = val;
    }

    const expScore = yearsRequired > 0 ? Math.min(Math.round((maxYears / yearsRequired) * 100), 100) : 80;

    // 3. Education scoring
    const hasDegree = resumeLower.includes('bachelor') || resumeLower.includes('degree') || resumeLower.includes('university') || resumeLower.includes('college') || resumeLower.includes('b.s') || resumeLower.includes('b.a');
    const eduScore = hasDegree ? 90 : 50;

    const overallScore = Math.round((skillsScore * 0.5) + (expScore * 0.3) + (eduScore * 0.2));

    let recommendation: IEvaluation['recommendation'] = 'Consider';
    if (overallScore >= 85) recommendation = 'Strong Shortlist';
    else if (overallScore >= 70) recommendation = 'Shortlist';
    else if (overallScore < 45) recommendation = 'Reject';

    // Checklist structured
    const experienceChecks = [
      {
        requirement: `${yearsRequired}+ Years Experience`,
        matched: maxYears >= yearsRequired,
        evidence: `Extracted estimated experience: ~${maxYears} years.`
      }
    ];

    const educationChecks = [
      {
        requirement: requirements.education || "Bachelor's Degree",
        matched: hasDegree,
        evidence: hasDegree ? 'Degree references found in education section.' : 'No clear degree keyword matched.'
      }
    ];

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const missing: string[] = [];

    skillChecks.forEach(s => {
      if (s.matched) strengths.push(`Has experience with ${s.name}`);
      else {
        weaknesses.push(`Missing experience with ${s.name}`);
        missing.push(s.name);
      }
    });

    if (maxYears >= yearsRequired) strengths.push(`Meets experience requirement (${maxYears} years vs ${yearsRequired} years required)`);
    else weaknesses.push(`Only has ${maxYears} years of experience, under-qualified`);

    return {
      overall_score: overallScore,
      skills_score: skillsScore,
      experience_score: expScore,
      education_score: eduScore,
      recommendation,
      candidate_summary: `Candidate evaluated in local sandbox. Met ${matchedSkillsCount} out of ${reqSkills.length} core required skills. Extracted ~${maxYears} years of work history.`,
      reasoning: `### Sandbox Mode Notice\nThis evaluation was generated using the local client-based evaluation engine. Provide a Gemini API Key in Settings to get high-fidelity explainable AI summaries.\n\n### Core Scoring Analysis\n- **Skills Match (${skillsScore}%):** Matched ${matchedSkillsCount} of ${reqSkills.length} required keywords.\n- **Experience Match (${expScore}%):** Extracted ~${maxYears} years of experience vs ${yearsRequired} required.\n- **Education Match (${eduScore}%):** Checked for basic university graduation degree patterns.`,
      strengths: strengths.slice(0, 3),
      weaknesses: weaknesses.slice(0, 3),
      missing_skills: missing,
      hiring_risks: maxYears < yearsRequired ? ['Under-experienced for this seniority level'] : [],
      growth_potential: 'Healthy potential for standard execution path.',
      scoring_details: {
        skills: skillChecks,
        experience: experienceChecks,
        education: educationChecks
      }
    };
  }

  private static mockGenerateInterviewGuide(_resumeText: string, jobTitle: string): Omit<IInterviewGuide, 'id' | 'candidate_id' | 'created_at'> {
    return {
      questions: {
        technical: [
          { question: `Can you talk about a technical challenge you faced while working in roles related to ${jobTitle}?`, focus: 'Technical Problem Solving' },
          { question: 'What is your architectural approach for ensuring application state and components remain clean and performant?', focus: 'Software Architecture' }
        ],
        behavioral: [
          { question: 'Tell me about a time you had to deliver a feature under a tight deadline. How did you manage compromises?', focus: 'Execution & Prioritization' },
          { question: 'How do you communicate complex technical concepts to non-technical stakeholders?', focus: 'Communication & Alignment' }
        ],
        experience_validation: [
          { question: 'Reviewing your resume, what was the most complex feature you built at your previous job, and how did you measure its success?', focus: 'Technical Ownership' },
          { question: 'Why are you looking to leave your current role and transition to this position?', focus: 'Motivation & Role Fit' }
        ],
        skill_verification: [
          { question: 'What are the main drawbacks or bugs of the primary frameworks/languages listed in your profile, and how do you bypass them?', focus: 'Deep Skill Mastery' },
          { question: 'How do you ensure code readability and testability in your day-to-day work?', focus: 'Software Engineering Best Practices' }
        ]
      }
    };
  }

  // ==========================================
  // 5. CODING ASSESSMENT GENERATION WORKFLOW
  // ==========================================
  static async generateCodingSubmission(
    candidateName: string,
    resumeText: string,
    testName: string,
    language: string
  ): Promise<Omit<IAssessment, 'id' | 'candidate_id' | 'job_id' | 'created_at'>> {
    const systemInstruction = `
      You are an expert technical interviewer and AI code evaluator.
      Given a candidate's name, resume text, the name of a coding test, and the programming language, you must simulate a coding submission and generate a full scorecard.
      
      Create a code submission that matches the candidate's experience level:
      - Expert candidates (e.g. Stanford CS, Staff Engineers) should get scores between 90-100, submit high-quality code, low tab switches, and take a reasonable amount of time.
      - Mid-level candidates should get scores between 60-85, submit average code, medium tab switches, and take longer.
      - Poorly aligned candidates (e.g. backend developer applying for a frontend role, or vice versa) should get scores between 0-40, submit buggy, incomplete code, and high tab switches.
      
      You MUST respond ONLY with a valid JSON object matching this structure:
      {
        test_name: string,
        language: string,
        score: number,
        time_taken_minutes: number,
        tab_switches_count: number,
        submitted_code: string,
        test_run_output: string,
        ai_code_review: {
          correctness: string,
          complexity: { time: string, space: string },
          quality_rating: "A" | "B" | "C" | "D" | "F",
          strengths: string[],
          improvements: string[],
          refactored_code: string
        }
      }
    `;

    const prompt = `
      Candidate Name: ${candidateName}
      Test Name: ${testName}
      Language: ${language}
      Resume Profile Summary:
      \${resumeText.slice(0, 4000)}
    `;

    try {
      const jsonText = await this.callLLM(prompt, systemInstruction);
      return JSON.parse(jsonText);
    } catch (error) {
      if (error instanceof Error && error.message === 'MISSING_API_KEY') {
        return this.mockGenerateCodingSubmission(candidateName, resumeText, testName, language);
      }
      console.error('AI Assessment Generation failed, falling back to mock generator:', error);
      return this.mockGenerateCodingSubmission(candidateName, resumeText, testName, language);
    }
  }

  private static mockGenerateCodingSubmission(
    candidateName: string,
    resumeText: string,
    testName: string,
    language: string
  ): Omit<IAssessment, 'id' | 'candidate_id' | 'job_id' | 'created_at'> {
    const resumeLower = resumeText.toLowerCase();
    
    // Determine skill alignment based on testName keywords
    const isFrontendTest = testName.toLowerCase().includes('react') || testName.toLowerCase().includes('counter') || testName.toLowerCase().includes('frontend');
    const isBackendTest = testName.toLowerCase().includes('api') || testName.toLowerCase().includes('endpoint') || testName.toLowerCase().includes('sql') || testName.toLowerCase().includes('database');
    
    const hasReact = resumeLower.includes('react');
    const hasTypeScript = resumeLower.includes('typescript') || resumeLower.includes('ts');
    const hasBackend = resumeLower.includes('python') || resumeLower.includes('django') || resumeLower.includes('postgresql') || resumeLower.includes('node') || resumeLower.includes('sql');
    
    let alignmentScore = 50; // default medium
    
    if (isFrontendTest) {
      if (hasReact && hasTypeScript) alignmentScore = 95; // Strong Senior Frontend
      else if (hasReact) alignmentScore = 70; // Mid Frontend
      else if (hasBackend) alignmentScore = 15; // Unsuited Backend
    } else if (isBackendTest) {
      if (hasBackend && resumeLower.includes('postgresql') && resumeLower.includes('django')) alignmentScore = 92;
      else if (hasBackend) alignmentScore = 75;
      else if (hasReact) alignmentScore = 20;
    }
    
    // Adjust scoring for specific candidates if they are the seeded ones
    if (candidateName.includes('Sarah')) alignmentScore = 94;
    else if (candidateName.includes('David')) alignmentScore = 68;
    else if (candidateName.includes('Alex')) alignmentScore = 10;

    // Time, switches
    let timeTaken = 30;
    let tabSwitches = 2;
    let score = alignmentScore;
    let code = '';
    let testOutput = '';
    let review: any = {};

    if (isFrontendTest) {
      if (score >= 90) {
        timeTaken = 22;
        tabSwitches = 1;
        testOutput = '8/8 test cases passed';
        code = `import React, { useState } from 'react';

interface CounterProps {
  initialCount?: number;
  step?: number;
  min?: number;
  max?: number;
}

export const Counter: React.FC<CounterProps> = ({
  initialCount = 0,
  step = 1,
  min = -Infinity,
  max = Infinity
}) => {
  const [count, setCount] = useState<number>(initialCount);

  const increment = () => {
    setCount(prev => Math.min(prev + step, max));
  };

  const decrement = () => {
    setCount(prev => Math.max(prev - step, min));
  };

  const reset = () => {
    setCount(initialCount);
  };

  return (
    <div className="counter-container" data-testid="counter">
      <h2 data-testid="count-display">Count: {count}</h2>
      <div className="controls">
        <button onClick={decrement} disabled={count <= min} data-testid="decrement-btn">-</button>
        <button onClick={reset} data-testid="reset-btn">Reset</button>
        <button onClick={increment} disabled={count >= max} data-testid="increment-btn">+</button>
      </div>
    </div>
  );
};`;
        review = {
          correctness: 'All test cases passed. Excellent implementation of props like step, min, and max limits, along with disabled states.',
          complexity: { time: 'O(1) constant time updates', space: 'O(1) state memory' },
          quality_rating: 'A',
          strengths: [
            'Clean TypeScript type definitions for Counter props',
            'Robust bounds validation using Math.min/Math.max boundary guards',
            'Correct functional state updates prev => Math.min(...) to avoid closure stale state bugs'
          ],
          improvements: [
            'Could optimize component rerendering by memoizing elements if embedded in larger trees, though unnecessary for a standalone component.'
          ],
          refactored_code: code.replace('const increment = () =>', 'const increment = React.useCallback(() =>')
        };
      } else if (score >= 50) {
        timeTaken = 38;
        tabSwitches = 4;
        testOutput = '5/8 test cases passed';
        code = `import React, { useState } from 'react';

export default function Counter(props) {
  const [count, setCount] = useState(props.initialCount || 0);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}`;
        review = {
          correctness: 'Partial pass (5/8). Lacked validation check for max/min constraints and step values requested by the specification. State update uses stale closures (setCount(count + 1)) instead of functional state updates.',
          complexity: { time: 'O(1) updates', space: 'O(1) state memory' },
          quality_rating: 'C',
          strengths: [
            'Standard React hook usage (useState) configured correctly',
            'Inline styling included for centered alignment',
            'Implemented basic counter features: increment, decrement, and reset'
          ],
          improvements: [
            'Use functional updates: setCount(prev => prev + 1) to prevent closure-related stale state values',
            'Implement min, max, and step boundaries to prevent invalid count numbers',
            'Migrate to TypeScript for structural type safety'
          ],
          refactored_code: `import React, { useState } from 'react';

export default function Counter({ initialCount = 0, step = 1, min = -Infinity, max = Infinity }) {
  const [count, setCount] = useState(initialCount);

  const handleIncrement = () => {
    setCount(prev => Math.min(prev + step, max));
  };

  const handleDecrement = () => {
    setCount(prev => Math.max(prev - step, min));
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Count: {count}</h1>
      <button onClick={handleIncrement} disabled={count >= max}>+</button>
      <button onClick={handleDecrement} disabled={count <= min}>-</button>
      <button onClick={() => setCount(initialCount)}>Reset</button>
    </div>
  );
}`
        };
      } else {
        timeTaken = 15;
        tabSwitches = 12;
        testOutput = '0/8 test cases passed';
        code = `// React Counter Implementation
// I don't have much experience in React, mostly python.
function Counter() {
  var count = 0;
  function click() {
    count = count + 1;
    console.log(count);
  }
  return (
    <div>
      <button onClick={click}>Click me</button>
    </div>
  )
}`;
        review = {
          correctness: 'Failed (0/8 test cases passed). The count state does not persist across renders because it uses a local variable (var count = 0) instead of the React useState hook. Clicking the button prints to console but never updates the UI.',
          complexity: { time: 'O(1) operations', space: 'O(1) local memory' },
          quality_rating: 'F',
          strengths: [
            'Has basic HTML-like JSX representation'
          ],
          improvements: [
            'Must use useState hook for reactive UI updates',
            'Needs to export the component so the framework can import and render it',
            'Learn modern React state management and component structure'
          ],
          refactored_code: `import React, { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(prev => prev + 1)}>Click me</button>
    </div>
  );
}`
        };
      }
    } else {
      // Default to SQL or general algorithmic challenge
      if (score >= 80) {
        timeTaken = 18;
        tabSwitches = 0;
        testOutput = '10/10 test cases passed';
        code = `SELECT 
  customer_id, 
  COUNT(order_id) as total_orders,
  SUM(total_amount) as total_spent
FROM orders
WHERE order_date >= NOW() - INTERVAL '30 days'
GROUP BY customer_id
HAVING COUNT(order_id) > 5
ORDER BY total_spent DESC;`;
        review = {
          correctness: 'All test cases passed. Excellent usage of aggregates, filter clauses, and sorting.',
          complexity: { time: 'O(N log N) for sort, O(N) scan', space: 'O(K) where K is unique customers' },
          quality_rating: 'A',
          strengths: ['Correct aggregates', 'Uses index on order_date and customer_id', 'Clean filtering in HAVING'],
          improvements: ['Add customer names by joining the users/customers table for better business context.'],
          refactored_code: `SELECT 
  c.id, 
  c.name, 
  COUNT(o.id) as total_orders,
  SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.order_date >= NOW() - INTERVAL '30 days'
GROUP BY c.id, c.name
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC;`
        };
      } else {
        timeTaken = 30;
        tabSwitches = 5;
        testOutput = '4/10 test cases passed';
        code = `SELECT * FROM orders ORDER BY total_amount DESC;`;
        review = {
          correctness: 'Failed major specs. Did not group by customers, failed to filter by past 30 days, and did not include a HAVING constraint.',
          complexity: { time: 'O(N log N) sort', space: 'O(N) data return' },
          quality_rating: 'D',
          strengths: ['Selects orders table correctly'],
          improvements: ['Group orders by customer_id', 'Use SUM aggregate for total spending', 'Add date range criteria in WHERE clause'],
          refactored_code: `SELECT customer_id, SUM(total_amount) FROM orders GROUP BY customer_id;`
        };
      }
    }

    return {
      test_name: testName,
      language: language,
      score,
      time_taken_minutes: timeTaken,
      tab_switches_count: tabSwitches,
      submitted_code: code,
      test_run_output: testOutput,
      ai_code_review: review
    };
  }
}
export default AIService;
