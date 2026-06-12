import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { IDatabaseService } from './database';
import type { IJob, ICandidate, IEvaluation, IInterviewGuide, IEmailLog, IActivityLog, ISettings, IAssessment } from './types';

export class SupabaseDatabase implements IDatabaseService {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  isSupabaseConfigured(): boolean {
    return true;
  }

  private async getUserId(): Promise<string | undefined> {
    const { data: { user } } = await this.client.auth.getUser();
    return user?.id;
  }

  // --- Jobs ---
  async getJobs(): Promise<IJob[]> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as IJob[];
  }

  async getJob(id: string): Promise<IJob | null> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as IJob | null;
  }

  async createJob(job: Omit<IJob, 'id' | 'created_at'>): Promise<IJob> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('jobs')
      .insert({
        ...job,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    
    // Log activity
    await this.createActivityLog({
      job_id: data.id,
      action: 'job_created',
      details: { jobTitle: data.title }
    });

    return data as IJob;
  }

  // --- Candidates ---
  async getCandidates(jobId: string): Promise<ICandidate[]> {
    const { data, error } = await this.client
      .from('candidates')
      .select('*')
      .eq('job_id', jobId)
      .order('rank_position', { ascending: true });

    if (error) throw error;
    return (data || []) as ICandidate[];
  }

  async getCandidate(id: string): Promise<ICandidate | null> {
    const { data, error } = await this.client
      .from('candidates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as ICandidate | null;
  }

  async createCandidate(candidate: Omit<ICandidate, 'id' | 'created_at' | 'rank_position'>): Promise<ICandidate> {
    // Check duplicates
    const { data: duplicate } = await this.client
      .from('candidates')
      .select('id')
      .eq('job_id', candidate.job_id)
      .eq('email', candidate.email)
      .maybeSingle();

    if (duplicate) {
      throw new Error(`Candidate with email ${candidate.email} is already uploaded for this job.`);
    }

    // Get current candidates count to set rank
    const { count } = await this.client
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', candidate.job_id);

    const { data, error } = await this.client
      .from('candidates')
      .insert({
        ...candidate,
        rank_position: (count || 0) + 1
      })
      .select()
      .single();

    if (error) throw error;

    await this.createActivityLog({
      job_id: candidate.job_id,
      candidate_id: data.id,
      action: 'resume_uploaded',
      details: { candidateName: data.name }
    });

    return data as ICandidate;
  }

  async updateCandidateStage(id: string, stage: ICandidate['stage']): Promise<ICandidate> {
    const oldCandidate = await this.getCandidate(id);
    if (!oldCandidate) throw new Error('Candidate not found.');

    const { data, error } = await this.client
      .from('candidates')
      .update({ stage })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    let logAction: IActivityLog['action'] = 'stage_changed';
    if (stage === 'shortlisted') logAction = 'candidate_shortlisted';
    if (stage === 'rejected') logAction = 'candidate_rejected';

    await this.createActivityLog({
      job_id: data.job_id,
      candidate_id: id,
      action: logAction,
      details: {
        candidateName: data.name,
        stageFrom: oldCandidate.stage,
        stageTo: stage
      }
    });

    return data as ICandidate;
  }

  async updateCandidateRank(id: string, rankPosition: number): Promise<void> {
    const { error } = await this.client
      .from('candidates')
      .update({ rank_position: rankPosition })
      .eq('id', id);

    if (error) throw error;
  }

  // --- Evaluations ---
  async getEvaluation(candidateId: string): Promise<IEvaluation | null> {
    const { data, error } = await this.client
      .from('evaluations')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) throw error;
    return data as IEvaluation | null;
  }

  async createEvaluation(evaluation: Omit<IEvaluation, 'id' | 'created_at'>): Promise<IEvaluation> {
    // Delete existing evaluation if present
    await this.client
      .from('evaluations')
      .delete()
      .eq('candidate_id', evaluation.candidate_id);

    const { data, error } = await this.client
      .from('evaluations')
      .insert(evaluation)
      .select()
      .single();

    if (error) throw error;

    // Update stage if applied
    const candidate = await this.getCandidate(evaluation.candidate_id);
    if (candidate && candidate.stage === 'applied') {
      await this.updateCandidateStage(candidate.id, 'ai_screened');
    }

    if (candidate) {
      await this.recalculateRankings(candidate.job_id);
      await this.createActivityLog({
        job_id: candidate.job_id,
        candidate_id: candidate.id,
        action: 'candidate_screened',
        details: { candidateName: candidate.name, score: evaluation.overall_score }
      });
    }

    return data as IEvaluation;
  }

  private async recalculateRankings(jobId: string): Promise<void> {
    const candidates = await this.getCandidates(jobId);
    
    // Fetch all evaluations for these candidates
    const candidateIds = candidates.map(c => c.id);
    if (candidateIds.length === 0) return;

    const { data: evals } = await this.client
      .from('evaluations')
      .select('candidate_id, overall_score')
      .in('candidate_id', candidateIds);

    const evalMap = new Map((evals || []).map((e: any) => [e.candidate_id, e.overall_score]));

    // Sort candidates descending by score
    candidates.sort((a, b) => {
      const scoreA = evalMap.get(a.id);
      const scoreB = evalMap.get(b.id);
      
      if (scoreA !== undefined && scoreB !== undefined) {
        return scoreB - scoreA;
      }
      if (scoreA !== undefined) return -1;
      if (scoreB !== undefined) return 1;
      
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Update ranks in database
    for (let i = 0; i < candidates.length; i++) {
      await this.updateCandidateRank(candidates[i].id, i + 1);
    }
  }

  // --- Interview Guides ---
  async getInterviewGuide(candidateId: string): Promise<IInterviewGuide | null> {
    const { data, error } = await this.client
      .from('interviews')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) throw error;
    return data as IInterviewGuide | null;
  }

  async createInterviewGuide(guide: Omit<IInterviewGuide, 'id' | 'created_at'>): Promise<IInterviewGuide> {
    await this.client
      .from('interviews')
      .delete()
      .eq('candidate_id', guide.candidate_id);

    const { data, error } = await this.client
      .from('interviews')
      .insert(guide)
      .select()
      .single();

    if (error) throw error;
    return data as IInterviewGuide;
  }

  // --- Email Logs ---
  async getEmailLogs(candidateId: string): Promise<IEmailLog[]> {
    const { data, error } = await this.client
      .from('email_logs')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return (data || []) as IEmailLog[];
  }

  async createEmailLog(log: Omit<IEmailLog, 'id' | 'sent_at'>): Promise<IEmailLog> {
    const { data, error } = await this.client
      .from('email_logs')
      .insert(log)
      .select()
      .single();

    if (error) throw error;

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

    return data as IEmailLog;
  }

  // --- Activity Logs ---
  async getActivityLogs(limit: number = 20): Promise<IActivityLog[]> {
    const { data, error } = await this.client
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as IActivityLog[];
  }

  async createActivityLog(log: Omit<IActivityLog, 'id' | 'created_at'>): Promise<IActivityLog> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('activity_logs')
      .insert({
        ...log,
        user_id: userId
      })
      .select()
      .single();

    if (error) throw error;
    return data as IActivityLog;
  }

  // --- Settings ---
  async getSettings(): Promise<ISettings> {
    const userId = await this.getUserId();
    if (!userId) {
      // Fallback if not authenticated
      const localSettings = localStorage.getItem('resumeiq_settings_fallback');
      return localSettings ? JSON.parse(localSettings) : {};
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return (data?.settings || {}) as ISettings;
  }

  async saveSettings(settings: ISettings): Promise<void> {
    const userId = await this.getUserId();
    if (!userId) {
      localStorage.setItem('resumeiq_settings_fallback', JSON.stringify(settings));
      return;
    }

    const { error } = await this.client
      .from('profiles')
      .update({ settings })
      .eq('id', userId);

    if (error) throw error;
  }

  // --- Coding Assessments ---
  async getAssessment(candidateId: string): Promise<IAssessment | null> {
    const { data, error } = await this.client
      .from('assessments')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) throw error;
    return data as IAssessment | null;
  }

  async createAssessment(assessment: Omit<IAssessment, 'id' | 'created_at'>): Promise<IAssessment> {
    await this.client
      .from('assessments')
      .delete()
      .eq('candidate_id', assessment.candidate_id);

    const { data, error } = await this.client
      .from('assessments')
      .insert(assessment)
      .select()
      .single();

    if (error) throw error;
    return data as IAssessment;
  }
}
