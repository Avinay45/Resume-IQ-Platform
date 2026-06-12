import React, { useState, useEffect } from 'react';
import { db } from '../services/db/database';
import type { IJob, ICandidate, IActivityLog } from '../services/db/types';
import { Users, Clock, ArrowRight, Plus, Upload, Sparkles, ChevronRight } from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: 'dashboard' | 'jobs' | 'candidates' | 'settings', jobId?: string) => void;
  triggerCreateJobModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    activeJobs: 0,
    candidatesUploaded: 0,
    candidatesScreened: 0,
    pendingReview: 0,
    shortlisted: 0,
    completedAssessments: 0,
    averageCodeScore: 0
  });
  
  const [recentActivities, setRecentActivities] = useState<IActivityLog[]>([]);
  const [topCandidates, setTopCandidates] = useState<{ candidate: ICandidate; jobTitle: string; score: number }[]>([]);
  const [jobsRequiringAttention, setJobsRequiringAttention] = useState<IJob[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // 1. Fetch raw data
        const jobs = await db.getJobs();
        const activeJobsList = jobs.filter(j => j.status === 'active');
        
        let allCandidates: ICandidate[] = [];
        for (const job of jobs) {
          const cands = await db.getCandidates(job.id);
          allCandidates = [...allCandidates, ...cands];
        }

        // Calculate screened, code assessments and load score mappings
        let screenedCount = 0;
        let assessmentsCount = 0;
        let totalCodeScore = 0;
        const evalScoresMap: Record<string, number> = {};
        for (const cand of allCandidates) {
          const ev = await db.getEvaluation(cand.id);
          if (ev) {
            screenedCount++;
            evalScoresMap[cand.id] = ev.overall_score;
          }
          const ass = await db.getAssessment(cand.id);
          if (ass) {
            assessmentsCount++;
            totalCodeScore += ass.score;
          }
        }

        // Metrics calculations
        const pendingCount = allCandidates.filter(c => c.stage === 'applied' || c.stage === 'under_review').length;
        const shortlistedCount = allCandidates.filter(c => c.stage === 'shortlisted').length;
        const averageCodeScore = assessmentsCount > 0 ? Math.round(totalCodeScore / assessmentsCount) : 0;

        setMetrics({
          activeJobs: activeJobsList.length,
          candidatesUploaded: allCandidates.length,
          candidatesScreened: screenedCount,
          pendingReview: pendingCount,
          shortlisted: shortlistedCount,
          completedAssessments: assessmentsCount,
          averageCodeScore
        });

        // 2. Recent activities
        const logs = await db.getActivityLogs(10);
        setRecentActivities(logs);

        // 3. Top candidates recommendation
        const scoredCandidates = allCandidates
          .filter(c => evalScoresMap[c.id] !== undefined)
          .map(c => {
            const matchedJob = jobs.find(j => j.id === c.job_id);
            return {
              candidate: c,
              jobTitle: matchedJob?.title || 'Unknown Role',
              score: evalScoresMap[c.id]
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        setTopCandidates(scoredCandidates);

        // 4. Jobs requiring attention (0 candidates, or most pending reviews)
        const jobsAttention = activeJobsList
          .map(job => {
            const jobCands = allCandidates.filter(c => c.job_id === job.id);
            const pendingCands = jobCands.filter(c => c.stage === 'applied' || c.stage === 'under_review').length;
            
            return {
              job,
              total: jobCands.length,
              pending: pendingCands,
              // Higher score means higher attention required
              priorityScore: jobCands.length === 0 ? 100 : pendingCands * 10
            };
          })
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .filter(item => item.priorityScore > 0)
          .map(item => item.job)
          .slice(0, 3);

        setJobsRequiringAttention(jobsAttention);
      } catch (error) {
        console.error('Error compiling dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard workspace...</p>
      </div>
    );
  }

  return (
    <div className="page-body">
      {/* Title Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Recruiting Command Center</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Evaluate applicant counts, shortlists, and key action points at a glance.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid-6 metrics-container">
        <div className="metric-card">
          <span className="metric-card-label">Active Jobs</span>
          <strong className="metric-card-value" style={{ color: 'var(--accent-blue)' }}>{metrics.activeJobs}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Resumes Uploaded</span>
          <strong className="metric-card-value">{metrics.candidatesUploaded}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">AI Screened</span>
          <strong className="metric-card-value" style={{ color: 'var(--accent-green)' }}>{metrics.candidatesScreened}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Code Assessments</span>
          <strong className="metric-card-value" style={{ color: '#8b5cf6' }}>{metrics.completedAssessments}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Avg Code Score</span>
          <strong className="metric-card-value" style={{ 
            color: metrics.averageCodeScore >= 80 ? 'var(--accent-green)' : 
                   metrics.averageCodeScore >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)' 
          }}>
            {metrics.averageCodeScore > 0 ? `${metrics.averageCodeScore}%` : 'N/A'}
          </strong>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Shortlisted</span>
          <strong className="metric-card-value" style={{ color: 'var(--accent-blue)' }}>{metrics.shortlisted}</strong>
        </div>
      </div>

      {/* Split Dashboard Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
        
        {/* Left Column: Top Candidates & Attention Jobs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top Ranked Candidates Panel */}
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-header">
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-green)' }} /> Top Ranked Candidates
              </h3>
            </div>
            
            {topCandidates.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                No evaluated candidates available yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {topCandidates.map(({ candidate, jobTitle, score }) => (
                  <div 
                    key={candidate.id}
                    onClick={() => onNavigate('candidates', candidate.job_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    className="candidate-row-hover"
                  >
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>{candidate.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Applying for {jobTitle}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`score-indicator ${score >= 80 ? 'score-high' : 'score-mid'}`}>
                        {score}% Fit
                      </span>
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jobs Requiring Attention */}
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-header">
              <h3 className="panel-title">Jobs Requiring Attention</h3>
            </div>

            {jobsRequiringAttention.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                All pipelines are healthy!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {jobsRequiringAttention.map(job => (
                  <div 
                    key={job.id}
                    onClick={() => onNavigate('candidates', job.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.85rem', display: 'block' }}>{job.title}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{job.department} • {job.location}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-yellow)' }}>
                      <span>Needs Screening</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Actions & Activity Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Quick Actions Panel */}
          <div className="panel" style={{ margin: 0, padding: '1.25rem' }}>
            <h3 className="panel-title" style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Quick Actions
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
                onClick={() => onNavigate('jobs')}
              >
                <Plus size={16} style={{ color: 'var(--accent-blue)' }} /> Create Job Listing
              </button>
              
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
                onClick={() => {
                  // If jobs exist, go to candidate page for first job, else go to job view
                  db.getJobs().then(list => {
                    if (list.length > 0) {
                      onNavigate('candidates', list[0].id);
                    } else {
                      onNavigate('jobs');
                    }
                  });
                }}
              >
                <Upload size={16} style={{ color: 'var(--accent-green)' }} /> Bulk Upload Resumes
              </button>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
                onClick={() => {
                  db.getJobs().then(list => {
                    if (list.length > 0) {
                      onNavigate('candidates', list[0].id);
                    } else {
                      onNavigate('jobs');
                    }
                  });
                }}
              >
                <Users size={16} style={{ color: 'var(--accent-blue)' }} /> Review Active Candidates
              </button>
            </div>
          </div>

          {/* Recent Activity Logs */}
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-header">
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} /> Recent Activity
              </h3>
            </div>
            
            {recentActivities.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem' }}>
                No recent activity logged.
              </p>
            ) : (
              <div className="activity-list">
                {recentActivities.map(act => (
                  <div key={act.id} className="activity-item">
                    <div className="activity-item-text" style={{ flex: 1 }}>
                      {act.action === 'job_created' && (
                        <span>
                          Created active job listing <strong>{act.details.jobTitle}</strong>.
                        </span>
                      )}
                      {act.action === 'resume_uploaded' && (
                        <span>
                          Uploaded resume for candidate <strong>{act.details.candidateName}</strong>.
                        </span>
                      )}
                      {act.action === 'candidate_screened' && (
                        <span>
                          Screened candidate <strong>{act.details.candidateName}</strong> with match score{' '}
                          <strong>{act.details.score}%</strong>.
                        </span>
                      )}
                      {act.action === 'candidate_shortlisted' && (
                        <span>
                          Shortlisted candidate <strong>{act.details.candidateName}</strong>.
                        </span>
                      )}
                      {act.action === 'candidate_rejected' && (
                        <span>
                          Rejected applicant <strong>{act.details.candidateName}</strong>.
                        </span>
                      )}
                      {act.action === 'email_sent' && (
                        <span>
                          Sent email notification (Trigger: <code>{act.details.emailTrigger}</code>) to{' '}
                          <strong>{act.details.candidateName}</strong>.
                        </span>
                      )}
                      {act.action === 'stage_changed' && (
                        <span>
                          Moved <strong>{act.details.candidateName}</strong> to{' '}
                          <strong>{act.details.stageTo}</strong>.
                        </span>
                      )}
                    </div>
                    <div className="activity-item-time">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
export default DashboardView;
