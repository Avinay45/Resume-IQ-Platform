import type { IJob, ICandidate, IEvaluation, IInterviewGuide, IEmailLog, IActivityLog, ISettings, IAssessment } from './types';
import { LocalDatabase } from './localDatabase';
import { SupabaseDatabase } from './supabaseDatabase';

export interface IDatabaseService {
  getJobs(): Promise<IJob[]>;
  getJob(id: string): Promise<IJob | null>;
  createJob(job: Omit<IJob, 'id' | 'created_at'>): Promise<IJob>;
  
  getCandidates(jobId: string): Promise<ICandidate[]>;
  getCandidate(id: string): Promise<ICandidate | null>;
  createCandidate(candidate: Omit<ICandidate, 'id' | 'created_at' | 'rank_position'>): Promise<ICandidate>;
  updateCandidateStage(id: string, stage: ICandidate['stage']): Promise<ICandidate>;
  updateCandidateRank(id: string, rankPosition: number): Promise<void>;
  
  getEvaluation(candidateId: string): Promise<IEvaluation | null>;
  createEvaluation(evaluation: Omit<IEvaluation, 'id' | 'created_at'>): Promise<IEvaluation>;
  
  getInterviewGuide(candidateId: string): Promise<IInterviewGuide | null>;
  createInterviewGuide(guide: Omit<IInterviewGuide, 'id' | 'created_at'>): Promise<IInterviewGuide>;
  
  getAssessment(candidateId: string): Promise<IAssessment | null>;
  createAssessment(assessment: Omit<IAssessment, 'id' | 'created_at'>): Promise<IAssessment>;
  
  getEmailLogs(candidateId: string): Promise<IEmailLog[]>;
  createEmailLog(log: Omit<IEmailLog, 'id' | 'sent_at'>): Promise<IEmailLog>;
  
  getActivityLogs(limit?: number): Promise<IActivityLog[]>;
  createActivityLog(log: Omit<IActivityLog, 'id' | 'created_at'>): Promise<IActivityLog>;
  
  getSettings(): Promise<ISettings>;
  saveSettings(settings: ISettings): Promise<void>;
  
  isSupabaseConfigured(): boolean;
}

class DatabaseManager implements IDatabaseService {
  private activeService: IDatabaseService;
  private isSupabase: boolean = false;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // Check if valid environment variables exist
    const hasEnvConfig = supabaseUrl && supabaseUrl !== 'your-supabase-url' && 
                         supabaseKey && supabaseKey !== 'your-supabase-anon-key';

    if (hasEnvConfig) {
      console.log('ResumeIQ: Supabase configuration detected. Connecting to production database.');
      this.activeService = new SupabaseDatabase(supabaseUrl, supabaseKey);
      this.isSupabase = true;
    } else {
      console.warn('ResumeIQ: No Supabase configuration found in .env. Initializing Local Sandbox (IndexedDB/LocalStorage).');
      this.activeService = new LocalDatabase();
      this.isSupabase = false;
    }
  }

  isSupabaseConfigured(): boolean {
    return this.isSupabase;
  }

  getJobs() { return this.activeService.getJobs(); }
  getJob(id: string) { return this.activeService.getJob(id); }
  createJob(job: Omit<IJob, 'id' | 'created_at'>) { return this.activeService.createJob(job); }
  
  getCandidates(jobId: string) { return this.activeService.getCandidates(jobId); }
  getCandidate(id: string) { return this.activeService.getCandidate(id); }
  createCandidate(candidate: Omit<ICandidate, 'id' | 'created_at' | 'rank_position'>) { return this.activeService.createCandidate(candidate); }
  updateCandidateStage(id: string, stage: ICandidate['stage']) { return this.activeService.updateCandidateStage(id, stage); }
  updateCandidateRank(id: string, rankPosition: number) { return this.activeService.updateCandidateRank(id, rankPosition); }
  
  getEvaluation(candidateId: string) { return this.activeService.getEvaluation(candidateId); }
  createEvaluation(evaluation: Omit<IEvaluation, 'id' | 'created_at'>) { return this.activeService.createEvaluation(evaluation); }
  
  getInterviewGuide(candidateId: string) { return this.activeService.getInterviewGuide(candidateId); }
  createInterviewGuide(guide: Omit<IInterviewGuide, 'id' | 'created_at'>) { return this.activeService.createInterviewGuide(guide); }
  
  getAssessment(candidateId: string) { return this.activeService.getAssessment(candidateId); }
  createAssessment(assessment: Omit<IAssessment, 'id' | 'created_at'>) { return this.activeService.createAssessment(assessment); }
  
  getEmailLogs(candidateId: string) { return this.activeService.getEmailLogs(candidateId); }
  createEmailLog(log: Omit<IEmailLog, 'id' | 'sent_at'>) { return this.activeService.createEmailLog(log); }
  
  getActivityLogs(limit?: number) { return this.activeService.getActivityLogs(limit); }
  createActivityLog(log: Omit<IActivityLog, 'id' | 'created_at'>) { return this.activeService.createActivityLog(log); }
  
  getSettings() { return this.activeService.getSettings(); }
  saveSettings(settings: ISettings) { return this.activeService.saveSettings(settings); }
}

export const db = new DatabaseManager();
