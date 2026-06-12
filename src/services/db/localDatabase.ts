import type { IDatabaseService } from './database';
import type { IJob, ICandidate, IEvaluation, IInterviewGuide, IEmailLog, IActivityLog, ISettings, IAssessment } from './types';

// Mock IDs for seed data
const MOCK_JOB_ID = 'job-dev-001';
const MOCK_CANDIDATE_1_ID = 'cand-001';
const MOCK_CANDIDATE_2_ID = 'cand-002';
const MOCK_CANDIDATE_3_ID = 'cand-003';

export class LocalDatabase implements IDatabaseService {
  constructor() {
    this.initializeSeedData();
  }

  isSupabaseConfigured(): boolean {
    return false;
  }

  private getStorageItem<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(`resumeiq_${key}`);
    return data ? JSON.parse(data) : defaultValue;
  }

  private setStorageItem<T>(key: string, value: T): void {
    localStorage.setItem(`resumeiq_${key}`, JSON.stringify(value));
  }

  // --- Seed Data Setup ---
  private initializeSeedData() {
    const isInitialized = localStorage.getItem('resumeiq_initialized_v2');
    if (isInitialized) return;

    // 1. Seed Settings
    const defaultSettings: ISettings = {
      geminiApiKey: '',
      openrouterApiKey: '',
      useOpenRouter: false,
      resendApiKey: '',
      emailTemplates: {
        shortlisted: `Hi {{name}},\n\nWe were highly impressed by your experience with {{skills}}. We'd love to invite you for an interview for the {{job_title}} position.\n\nBest regards,\nRecruiting Team`,
        rejected: `Hi {{name}},\n\nThank you for applying to the {{job_title}} role. While your background is impressive, we have decided to move forward with other candidates whose skills align more closely with our current needs.\n\nWe wish you all the best.\n\nBest regards,\nRecruiting Team`,
        interview: `Hi {{name}},\n\nGreat news! We have scheduled your interview for the {{job_title}} role. A calendar invite will be sent shortly.\n\nBest regards,\nRecruiting Team`
      }
    };
    this.setStorageItem('settings', defaultSettings);

    // 2. Seed Jobs
    const mockJobs: IJob[] = [
      {
        id: MOCK_JOB_ID,
        created_at: new Date().toISOString(),
        title: 'Senior Frontend Engineer (React/TS)',
        department: 'Engineering',
        location: 'San Francisco, CA (Hybrid)',
        employment_type: 'Full-time',
        seniority: 'Senior',
        description: 'We are seeking a Senior Frontend Engineer with expert-level React, TypeScript, and state management skills. You will drive architecture decisions, optimize bundle performance, and build premium UX features.',
        requirements: {
          required_skills: ['React', 'TypeScript', 'CSS/CSS Modules', 'State Management (Redux/Zustand)'],
          preferred_skills: ['Next.js', 'Vite', 'GraphQL', 'Web Performance Optimization'],
          experience_years: 5,
          education: "Bachelor's in Computer Science or equivalent experience",
          keywords: ['Frontend', 'Vite', 'Single Page Application', 'Web Accessibility'],
          technologies: ['React', 'TypeScript', 'CSS', 'Zustand', 'HTML5']
        },
        status: 'active',
        assessment_test: 'React Stateful Counter'
      }
    ];
    this.setStorageItem('jobs', mockJobs);

    // 3. Seed Candidates
    const mockCandidates: ICandidate[] = [
      {
        id: MOCK_CANDIDATE_1_ID,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        job_id: MOCK_JOB_ID,
        name: 'Sarah Jenkins',
        email: 'sarah.jenkins@example.com',
        phone: '+1 (555) 019-2834',
        skills: ['React', 'TypeScript', 'CSS', 'Redux', 'Webpack', 'Next.js', 'Jest'],
        experience: [
          { company: 'Linear Tech', role: 'Staff Frontend Engineer', duration: '3 years', description: 'Led core dashboard optimization, reducing initial load times by 40%. Implemented responsive component libraries.' },
          { company: 'Atom Software', role: 'Senior React Developer', duration: '3 years', description: 'Developed high-performance SPAs and mentored junior developers.' }
        ],
        education: [
          { institution: 'Stanford University', degree: 'B.S.', field: 'Computer Science', year: '2018' }
        ],
        certifications: ['AWS Certified Cloud Practitioner'],
        projects: [
          { name: 'SleekEditor', description: 'A lightweight canvas-based layout editor written in TypeScript.' }
        ],
        resume_text: 'Sarah Jenkins. Staff Frontend Engineer. Expert in React, TypeScript, CSS, Redux, Next.js. Worked at Linear Tech and Atom Software.',
        stage: 'shortlisted',
        rank_position: 1
      },
      {
        id: MOCK_CANDIDATE_2_ID,
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        job_id: MOCK_JOB_ID,
        name: 'David Kojo',
        email: 'david.kojo@example.com',
        phone: '+1 (555) 482-9102',
        skills: ['React', 'JavaScript', 'HTML5', 'Tailwind CSS', 'Redux Toolkit'],
        experience: [
          { company: 'DevCorp Solutions', role: 'Frontend Engineer', duration: '3 years', description: 'Created client dashboards and admin portals using React.' }
        ],
        education: [
          { institution: 'State University', degree: 'B.A.', field: 'Information Technology', year: '2020' }
        ],
        certifications: [],
        projects: [],
        resume_text: 'David Kojo. Frontend Developer. Worked at DevCorp Solutions. Proficient in React, JavaScript, and CSS.',
        stage: 'under_review',
        rank_position: 2
      },
      {
        id: MOCK_CANDIDATE_3_ID,
        created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        job_id: MOCK_JOB_ID,
        name: 'Alex Rivera',
        email: 'alex.rivera@example.com',
        phone: '+1 (555) 739-1229',
        skills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'AWS'],
        experience: [
          { company: 'CloudBase Systems', role: 'Backend Engineer', duration: '4 years', description: 'Designed scalable APIs and data sync microservices.' }
        ],
        education: [
          { institution: 'Tech Institute', degree: 'Associate Degree', field: 'Software Engineering', year: '2019' }
        ],
        certifications: [],
        projects: [],
        resume_text: 'Alex Rivera. Backend Developer focusing on Python, Django, PostgreSQL, Docker, AWS.',
        stage: 'rejected',
        rank_position: 3
      }
    ];
    this.setStorageItem('candidates', mockCandidates);

    // 4. Seed Evaluations
    const mockEvaluations: IEvaluation[] = [
      {
        id: 'eval-001',
        candidate_id: MOCK_CANDIDATE_1_ID,
        overall_score: 95,
        skills_score: 98,
        experience_score: 94,
        education_score: 90,
        recommendation: 'Strong Shortlist',
        reasoning: '### Executive Summary\nSarah is an outstanding candidate with 6 years of robust frontend engineering experience. She holds a B.S. in CS from Stanford and has proven experience leading performance optimizations at Linear Tech.\n\n### Scoring Explanation\n- **Skills Alignment:** Perfect match. She has deep expertise in React, TypeScript, CSS, and Next.js.\n- **Experience Alignment:** Exceeds expectations. Leading optimization projects at scale aligns directly with our architecture needs.\n- **Education Alignment:** Excellent fit with a Stanford Computer Science degree.',
        candidate_summary: 'Experienced Staff/Senior Frontend Engineer with deep React & TypeScript knowledge and a record of visual UX & performance gains.',
        strengths: ['Expert React & TypeScript', 'Performance engineering pedigree (Linear)', 'Stanford CS degree'],
        weaknesses: ['Minimal backend exposure (Node/Go) mentioned in resume'],
        missing_skills: [],
        hiring_risks: [],
        growth_potential: 'High. Capable of driving frontend architecture and leading a team.',
        scoring_details: {
          skills: [
            { name: 'React', matched: true, evidence: 'Staff Frontend Engineer at Linear Tech' },
            { name: 'TypeScript', matched: true, evidence: 'Built SleekEditor in TypeScript' },
            { name: 'CSS/CSS Modules', matched: true, evidence: 'Implemented responsive component libraries' },
            { name: 'State Management', matched: true, evidence: 'Proficient in Redux' }
          ],
          experience: [
            { requirement: '5+ Years Experience', matched: true, evidence: '6 years total frontend experience' }
          ],
          education: [
            { requirement: 'B.S. Computer Science', matched: true, evidence: 'B.S. in CS from Stanford' }
          ]
        },
        created_at: new Date().toISOString()
      },
      {
        id: 'eval-002',
        candidate_id: MOCK_CANDIDATE_2_ID,
        overall_score: 72,
        skills_score: 75,
        experience_score: 70,
        education_score: 70,
        recommendation: 'Consider',
        reasoning: '### Executive Summary\nDavid is a competent frontend engineer with 3 years of experience. He meets basic UI/React needs, but lacks TypeScript depth and senior architecture exposure.\n\n### Scoring Explanation\n- **Skills Match:** Strong React and CSS, but lacks TypeScript, which is a key requirement.\n- **Experience Match:** Junior-to-mid level (3 years vs 5 years required).\n- **Education Match:** B.A. in IT instead of CS.',
        candidate_summary: 'Mid-level Frontend Developer with solid React and UI development background, but needs mentorship in TypeScript and system design.',
        strengths: ['Strong React experience', 'Responsive layout design'],
        weaknesses: ['No TypeScript listed', 'Does not meet 5 years seniority requirement'],
        missing_skills: ['TypeScript', 'Vite', 'State Management (Zustand)'],
        hiring_risks: ['Under-qualified for architectural tasks'],
        growth_potential: 'Moderate with strong engineering mentorship.',
        scoring_details: {
          skills: [
            { name: 'React', matched: true, evidence: 'DevCorp Solutions' },
            { name: 'TypeScript', matched: false, evidence: 'Not mentioned' },
            { name: 'CSS/CSS Modules', matched: true, evidence: 'Tailwind CSS developer' },
            { name: 'State Management', matched: true, evidence: 'Redux Toolkit' }
          ],
          experience: [
            { requirement: '5+ Years Experience', matched: false, evidence: '3 years experience' }
          ],
          education: [
            { requirement: 'B.S. Computer Science', matched: true, evidence: 'B.A. in IT is comparable' }
          ]
        },
        created_at: new Date().toISOString()
      },
      {
        id: 'eval-003',
        candidate_id: MOCK_CANDIDATE_3_ID,
        overall_score: 25,
        skills_score: 10,
        experience_score: 30,
        education_score: 40,
        recommendation: 'Reject',
        reasoning: '### Executive Summary\nAlex is a pure backend developer (Python, Django, AWS). The job description requires expert-level React & TypeScript frontend engineering. There is zero alignment.\n\n### Scoring Explanation\n- **Skills Alignment:** Fails. None of the required frontend skills are present.\n- **Role Misalignment:** Backend profile applying for a Senior Frontend role.',
        candidate_summary: 'Backend Engineer with Python & Cloud experience. Not suitable for frontend interface role.',
        strengths: ['Docker & cloud experience'],
        weaknesses: ['No frontend experience'],
        missing_skills: ['React', 'TypeScript', 'CSS', 'State Management'],
        hiring_risks: ['Would require complete retraining'],
        scoring_details: {
          skills: [
            { name: 'React', matched: false },
            { name: 'TypeScript', matched: false },
            { name: 'CSS/CSS Modules', matched: false },
            { name: 'State Management', matched: false }
          ],
          experience: [
            { requirement: '5+ Years Experience', matched: false }
          ],
          education: [
            { requirement: 'B.S. Computer Science', matched: false }
          ]
        },
        created_at: new Date().toISOString()
      }
    ];
    this.setStorageItem('evaluations', mockEvaluations);

    // 5. Seed Interview Guides
    const mockInterviews: IInterviewGuide[] = [
      {
        id: 'int-001',
        candidate_id: MOCK_CANDIDATE_1_ID,
        questions: {
          technical: [
            { question: 'Describe how you optimized dashboard loading times at Linear Tech. What tools and techniques did you use?', focus: 'Performance & Bundle Optimization', ideal_answer: 'Ideal answer should cover: code splitting, lazy loading, image asset optimization, Webpack/Vite analyzer tools, and caching strategies.' }
          ],
          behavioral: [
            { question: 'How do you handle architectural disagreements within a frontend engineering team?', focus: 'Collaboration & Leadership' }
          ],
          experience_validation: [
            { question: 'Can you describe the design and architecture of SleekEditor? What was the hardest rendering problem you solved?', focus: 'Technical Ownership' }
          ],
          skill_verification: [
            { question: 'In React, what are the architectural trade-offs between Zustand and Redux?', focus: 'React State Management' }
          ]
        },
        created_at: new Date().toISOString()
      }
    ];
    this.setStorageItem('interviews', mockInterviews);

    // 5.5 Seed Assessments
    const mockAssessments: IAssessment[] = [
      {
        id: 'assess-001',
        candidate_id: MOCK_CANDIDATE_1_ID,
        job_id: MOCK_JOB_ID,
        test_name: 'React Stateful Counter',
        language: 'typescript',
        score: 94,
        time_taken_minutes: 22,
        tab_switches_count: 1,
        submitted_code: `import React, { useState } from 'react';

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
        <button onClick={decrement} disabled={count <= min} data-testid="decrement-btn">
          -
        </button>
        <button onClick={reset} data-testid="reset-btn">
          Reset
        </button>
        <button onClick={increment} disabled={count >= max} data-testid="increment-btn">
          +
        </button>
      </div>
    </div>
  );
};`,
        test_run_output: '8/8 test cases passed',
        ai_code_review: {
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
          refactored_code: `import React, { useState, useCallback } from 'react';

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

  const increment = useCallback(() => {
    setCount(prev => Math.min(prev + step, max));
  }, [step, max]);

  const decrement = useCallback(() => {
    setCount(prev => Math.max(prev - step, min));
  }, [step, min]);

  const reset = useCallback(() => {
    setCount(initialCount);
  }, [initialCount]);

  return (
    <div className="counter-container" data-testid="counter">
      <h2 data-testid="count-display">Count: {count}</h2>
      <div className="controls">
        <button onClick={decrement} disabled={count <= min} data-testid="decrement-btn">
          -
        </button>
        <button onClick={reset} data-testid="reset-btn">
          Reset
        </button>
        <button onClick={increment} disabled={count >= max} data-testid="increment-btn">
          +
        </button>
      </div>
    </div>
  );
};`
        },
        created_at: new Date().toISOString()
      },
      {
        id: 'assess-002',
        candidate_id: MOCK_CANDIDATE_2_ID,
        job_id: MOCK_JOB_ID,
        test_name: 'React Stateful Counter',
        language: 'javascript',
        score: 68,
        time_taken_minutes: 38,
        tab_switches_count: 4,
        submitted_code: `import React, { useState } from 'react';

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
}`,
        test_run_output: '5/8 test cases passed',
        ai_code_review: {
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
        },
        created_at: new Date().toISOString()
      },
      {
        id: 'assess-003',
        candidate_id: MOCK_CANDIDATE_3_ID,
        job_id: MOCK_JOB_ID,
        test_name: 'React Stateful Counter',
        language: 'javascript',
        score: 10,
        time_taken_minutes: 15,
        tab_switches_count: 12,
        submitted_code: `// React Counter Implementation
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
}`,
        test_run_output: '0/8 test cases passed',
        ai_code_review: {
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
        },
        created_at: new Date().toISOString()
      }
    ];
    this.setStorageItem('assessments', mockAssessments);

    // 6. Seed Activity Logs
    const mockActivityLogs: IActivityLog[] = [
      {
        id: 'act-001',
        created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        action: 'job_created',
        details: { jobTitle: 'Senior Frontend Engineer (React/TS)' }
      },
      {
        id: 'act-002',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        action: 'resume_uploaded',
        details: { candidateName: 'Sarah Jenkins', jobTitle: 'Senior Frontend Engineer (React/TS)' }
      },
      {
        id: 'act-003',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        action: 'candidate_screened',
        details: { candidateName: 'Sarah Jenkins', score: 95 }
      },
      {
        id: 'act-004',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        action: 'candidate_shortlisted',
        details: { candidateName: 'Sarah Jenkins' }
      }
    ];
    this.setStorageItem('activity_logs', mockActivityLogs);

    localStorage.setItem('resumeiq_initialized_v2', 'true');
  }

  // --- Job API ---
  async getJobs(): Promise<IJob[]> {
    return this.getStorageItem<IJob[]>('jobs', []);
  }

  async getJob(id: string): Promise<IJob | null> {
    const jobs = await this.getJobs();
    return jobs.find(j => j.id === id) || null;
  }

  async createJob(job: Omit<IJob, 'id' | 'created_at'>): Promise<IJob> {
    const jobs = await this.getJobs();
    const newJob: IJob = {
      ...job,
      id: `job-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    jobs.push(newJob);
    this.setStorageItem('jobs', jobs);
    
    await this.createActivityLog({
      action: 'job_created',
      details: { jobTitle: newJob.title }
    });
    
    return newJob;
  }

  // --- Candidate API ---
  async getCandidates(jobId: string): Promise<ICandidate[]> {
    const candidates = this.getStorageItem<ICandidate[]>('candidates', []);
    return candidates
      .filter(c => c.job_id === jobId)
      .sort((a, b) => a.rank_position - b.rank_position);
  }

  async getCandidate(id: string): Promise<ICandidate | null> {
    const candidates = this.getStorageItem<ICandidate[]>('candidates', []);
    return candidates.find(c => c.id === id) || null;
  }

  async createCandidate(candidate: Omit<ICandidate, 'id' | 'created_at' | 'rank_position'>): Promise<ICandidate> {
    const candidates = this.getStorageItem<ICandidate[]>('candidates', []);
    
    // Check duplicate email for the same job
    const duplicate = candidates.find(c => c.job_id === candidate.job_id && c.email === candidate.email);
    if (duplicate && candidate.email) {
      throw new Error(`Candidate with email ${candidate.email} is already uploaded for this job.`);
    }

    const jobCandidates = candidates.filter(c => c.job_id === candidate.job_id);
    const newCandidate: ICandidate = {
      ...candidate,
      id: `cand-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      rank_position: jobCandidates.length + 1
    };
    candidates.push(newCandidate);
    this.setStorageItem('candidates', candidates);

    await this.createActivityLog({
      job_id: candidate.job_id,
      candidate_id: newCandidate.id,
      action: 'resume_uploaded',
      details: { candidateName: newCandidate.name }
    });

    return newCandidate;
  }

  async updateCandidateStage(id: string, stage: ICandidate['stage']): Promise<ICandidate> {
    const candidates = this.getStorageItem<ICandidate[]>('candidates', []);
    const index = candidates.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Candidate not found.');

    const oldStage = candidates[index].stage;
    candidates[index].stage = stage;
    this.setStorageItem('candidates', candidates);

    let logAction: IActivityLog['action'] = 'stage_changed';
    if (stage === 'shortlisted') logAction = 'candidate_shortlisted';
    if (stage === 'rejected') logAction = 'candidate_rejected';

    await this.createActivityLog({
      job_id: candidates[index].job_id,
      candidate_id: id,
      action: logAction,
      details: {
        candidateName: candidates[index].name,
        stageFrom: oldStage,
        stageTo: stage
      }
    });

    return candidates[index];
  }

  async updateCandidateRank(id: string, rankPosition: number): Promise<void> {
    const candidates = this.getStorageItem<ICandidate[]>('candidates', []);
    const index = candidates.findIndex(c => c.id === id);
    if (index !== -1) {
      candidates[index].rank_position = rankPosition;
      this.setStorageItem('candidates', candidates);
    }
  }

  // --- Evaluation API ---
  async getEvaluation(candidateId: string): Promise<IEvaluation | null> {
    const evaluations = this.getStorageItem<IEvaluation[]>('evaluations', []);
    return evaluations.find(e => e.candidate_id === candidateId) || null;
  }

  async createEvaluation(evaluation: Omit<IEvaluation, 'id' | 'created_at'>): Promise<IEvaluation> {
    const evaluations = this.getStorageItem<IEvaluation[]>('evaluations', []);
    
    // Remove existing if any (replace behavior)
    const filtered = evaluations.filter(e => e.candidate_id !== evaluation.candidate_id);
    
    const newEval: IEvaluation = {
      ...evaluation,
      id: `eval-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    filtered.push(newEval);
    this.setStorageItem('evaluations', filtered);

    // Update candidate stage to ai_screened automatically if stage is 'applied'
    const candidate = await this.getCandidate(evaluation.candidate_id);
    if (candidate && candidate.stage === 'applied') {
      await this.updateCandidateStage(candidate.id, 'ai_screened');
    }

    // Recalculate ranking order for this job
    if (candidate) {
      await this.recalculateRankings(candidate.job_id);
      await this.createActivityLog({
        job_id: candidate.job_id,
        candidate_id: candidate.id,
        action: 'candidate_screened',
        details: { candidateName: candidate.name, score: evaluation.overall_score }
      });
    }

    return newEval;
  }

  private async recalculateRankings(jobId: string): Promise<void> {
    const candidates = this.getStorageItem<ICandidate[]>('candidates', []);
    const jobCandidates = candidates.filter(c => c.job_id === jobId);
    
    // Load evaluations for matching
    const evaluations = this.getStorageItem<IEvaluation[]>('evaluations', []);
    const evalMap = new Map(evaluations.map(e => [e.candidate_id, e.overall_score]));

    // Sort: Screened with higher scores first, then unscreened candidates
    jobCandidates.sort((a, b) => {
      const scoreA = evalMap.get(a.id);
      const scoreB = evalMap.get(b.id);
      
      if (scoreA !== undefined && scoreB !== undefined) {
        return scoreB - scoreA; // Descending score
      }
      if (scoreA !== undefined) return -1; // Screened first
      if (scoreB !== undefined) return 1;
      
      // Default: date order
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Write back rank positions
    jobCandidates.forEach((cand, idx) => {
      const globalIndex = candidates.findIndex(c => c.id === cand.id);
      if (globalIndex !== -1) {
        candidates[globalIndex].rank_position = idx + 1;
      }
    });

    this.setStorageItem('candidates', candidates);
  }

  // --- Interview Guide API ---
  async getInterviewGuide(candidateId: string): Promise<IInterviewGuide | null> {
    const guides = this.getStorageItem<IInterviewGuide[]>('interviews', []);
    return guides.find(g => g.candidate_id === candidateId) || null;
  }

  async createInterviewGuide(guide: Omit<IInterviewGuide, 'id' | 'created_at'>): Promise<IInterviewGuide> {
    const guides = this.getStorageItem<IInterviewGuide[]>('interviews', []);
    const filtered = guides.filter(g => g.candidate_id !== guide.candidate_id);
    
    const newGuide: IInterviewGuide = {
      ...guide,
      id: `int-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    filtered.push(newGuide);
    this.setStorageItem('interviews', filtered);
    return newGuide;
  }

  // --- Email Logs API ---
  async getEmailLogs(candidateId: string): Promise<IEmailLog[]> {
    const logs = this.getStorageItem<IEmailLog[]>('email_logs', []);
    return logs.filter(l => l.candidate_id === candidateId);
  }

  async createEmailLog(log: Omit<IEmailLog, 'id' | 'sent_at'>): Promise<IEmailLog> {
    const logs = this.getStorageItem<IEmailLog[]>('email_logs', []);
    const newLog: IEmailLog = {
      ...log,
      id: `elog-${Math.random().toString(36).substr(2, 9)}`,
      sent_at: new Date().toISOString()
    };
    logs.push(newLog);
    this.setStorageItem('email_logs', logs);

    // Write activity log for sending email
    const candidate = await this.getCandidate(log.candidate_id);
    await this.createActivityLog({
      job_id: candidate?.job_id,
      candidate_id: log.candidate_id,
      action: 'email_sent',
      details: {
        candidateName: candidate?.name || 'Candidate',
        emailTrigger: log.trigger_event
      }
    });

    return newLog;
  }

  // --- Activity Logs API ---
  async getActivityLogs(limit: number = 20): Promise<IActivityLog[]> {
    const logs = this.getStorageItem<IActivityLog[]>('activity_logs', []);
    return logs
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  async createActivityLog(log: Omit<IActivityLog, 'id' | 'created_at'>): Promise<IActivityLog> {
    const logs = this.getStorageItem<IActivityLog[]>('activity_logs', []);
    const newLog: IActivityLog = {
      ...log,
      id: `act-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    logs.push(newLog);
    this.setStorageItem('activity_logs', logs);
    return newLog;
  }

  // --- Settings API ---
  async getSettings(): Promise<ISettings> {
    return this.getStorageItem<ISettings>('settings', {});
  }

  async saveSettings(settings: ISettings): Promise<void> {
    this.setStorageItem('settings', settings);
  }

  // --- Assessments API ---
  async getAssessment(candidateId: string): Promise<IAssessment | null> {
    const assessments = this.getStorageItem<IAssessment[]>('assessments', []);
    return assessments.find(a => a.candidate_id === candidateId) || null;
  }

  async createAssessment(assessment: Omit<IAssessment, 'id' | 'created_at'>): Promise<IAssessment> {
    const assessments = this.getStorageItem<IAssessment[]>('assessments', []);
    const filtered = assessments.filter(a => a.candidate_id !== assessment.candidate_id);
    
    const newAssessment: IAssessment = {
      ...assessment,
      id: `assess-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    filtered.push(newAssessment);
    this.setStorageItem('assessments', filtered);
    return newAssessment;
  }
}

