import React, { useState, useEffect } from 'react';
import { db } from '../services/db/database';
import type { ICandidate, IEvaluation, IInterviewGuide, IEmailLog, IActivityLog, IAssessment } from '../services/db/types';
import { EmailService } from '../services/email/email';
import { useToast } from '../context/ToastContext';
import { 
  X, Briefcase, GraduationCap, Award, FolderGit, 
  Sparkles, CheckCircle2, AlertTriangle, HelpCircle, 
  Send, ChevronDown, ChevronUp, Save, Clock, Terminal
} from 'lucide-react';

interface CandidateDrawerProps {
  candidateId: string;
  jobTitle: string;
  onClose: () => void;
  onStageUpdated: () => void;
}

export const CandidateDrawer: React.FC<CandidateDrawerProps> = ({
  candidateId,
  jobTitle,
  onClose,
  onStageUpdated
}) => {
  const { showToast } = useToast();
  const [candidate, setCandidate] = useState<ICandidate | null>(null);
  const [evaluation, setEvaluation] = useState<IEvaluation | null>(null);
  const [assessment, setAssessment] = useState<IAssessment | null>(null);
  const [interviewGuide, setInterviewGuide] = useState<IInterviewGuide | null>(null);
  const [emailLogs, setEmailLogs] = useState<IEmailLog[]>([]);
  const [activities, setActivities] = useState<IActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'assessment' | 'questions' | 'email' | 'notes' | 'activity'>('overview');
  
  // Accordion state for questions
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  
  // Recruiter notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Email form state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTrigger, setEmailTrigger] = useState<'shortlisted' | 'rejected' | 'interview'>('shortlisted');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  // Load candidate and related records
  const loadData = async () => {
    try {
      const candData = await db.getCandidate(candidateId);
      if (!candData) {
        showToast('Candidate not found', 'error');
        onClose();
        return;
      }
      setCandidate(candData);
      setRecipientEmail(candData.email || '');
      
      const evalData = await db.getEvaluation(candidateId);
      setEvaluation(evalData);
      
      const assessmentData = await db.getAssessment(candidateId);
      setAssessment(assessmentData);
 
      const interviewData = await db.getInterviewGuide(candidateId);
      setInterviewGuide(interviewData);

      const logs = await db.getEmailLogs(candidateId);
      setEmailLogs(logs);

      // Load activities specific to this candidate
      const allActivities = await db.getActivityLogs(100);
      setActivities(allActivities.filter(a => a.candidate_id === candidateId));

      // Load saved notes
      const savedNotes = localStorage.getItem(`resumeiq_notes_${candidateId}`) || '';
      setNotes(savedNotes);

      // Pre-fill email templates based on stage
      let currentTrigger: 'shortlisted' | 'rejected' | 'interview' = 'shortlisted';
      if (candData.stage === 'rejected') currentTrigger = 'rejected';
      if (candData.stage === 'interview') currentTrigger = 'interview';
      setEmailTrigger(currentTrigger);
      
      const settings = await db.getSettings();
      const defaultTemplate = settings.emailTemplates?.[currentTrigger] || '';
      setEmailBody(EmailService.compileTemplate(defaultTemplate, candData, jobTitle));
      setEmailSubject(
        currentTrigger === 'shortlisted' ? `Application Update: ${jobTitle}` :
        currentTrigger === 'rejected' ? `Your Application: ${jobTitle}` :
        `Interview Scheduled: ${jobTitle}`
      );
      
    } catch (err) {
      showToast('Error loading candidate details', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, [candidateId]);

  // Handle template change
  useEffect(() => {
    async function loadTemplate() {
      const activeCand = candidate;
      if (!activeCand) return;
      const settings = await db.getSettings();
      const defaultTemplate = settings.emailTemplates?.[emailTrigger] || '';
      setEmailBody(EmailService.compileTemplate(defaultTemplate, activeCand, jobTitle));
      setEmailSubject(
        emailTrigger === 'shortlisted' ? `Application Update: ${jobTitle}` :
        emailTrigger === 'rejected' ? `Your Application: ${jobTitle}` :
        `Interview Scheduled: ${jobTitle}`
      );
    }
    loadTemplate();
  }, [emailTrigger, candidate, jobTitle]);

  // Stage change action
  const handleStageChange = async (stage: ICandidate['stage']) => {
    if (!candidate) return;
    try {
      await db.updateCandidateStage(candidate.id, stage);
      showToast(`Candidate stage updated to ${stage.replace('_', ' ')}`, 'success');
      loadData();
      onStageUpdated();
    } catch (err) {
      showToast('Failed to update stage', 'error');
    }
  };

  // Note saving
  const handleSaveNotes = () => {
    setSavingNotes(true);
    localStorage.setItem(`resumeiq_notes_${candidateId}`, notes);
    setTimeout(() => {
      setSavingNotes(false);
      showToast('Notes saved successfully', 'success');
    }, 5000);
  };

  // Email sending
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    setSendingEmail(true);
    try {
      const res = await EmailService.sendEmail(
        candidate,
        jobTitle,
        emailTrigger,
        emailSubject,
        emailBody,
        recipientEmail
      );
      if (res.success) {
        showToast(res.message, 'success');
        loadData(); // reload email logs & activity
      } else {
        showToast(`Failed to send email: ${res.message}`, 'error');
      }
    } catch (err) {
      showToast('Error sending email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!candidate) {
    return null;
  }

  // Score badge helper
  const getScoreClass = (score: number) => {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="drawer-name">{candidate.name}</div>
              {evaluation && (
                <div className={`score-indicator ${getScoreClass(evaluation.overall_score)}`}>
                  {evaluation.overall_score}% Match
                </div>
              )}
            </div>
            <div className="drawer-subtitle">
              Rank #{candidate.rank_position} • Applied {new Date(candidate.created_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              className="input-field"
              style={{ padding: '0.4rem 2rem 0.4rem 0.6rem', fontSize: '0.8rem', height: 'auto' }}
              value={candidate.stage}
              onChange={(e) => handleStageChange(e.target.value as ICandidate['stage'])}
            >
              <option value="applied">Applied</option>
              <option value="ai_screened">AI Screened</option>
              <option value="under_review">Under Review</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>
            <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Tabs */}
        <div className="drawer-tabs">
          <div className={`drawer-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Overview
          </div>
          <div className={`drawer-tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
            AI Analysis
          </div>
          <div className={`drawer-tab ${activeTab === 'assessment' ? 'active' : ''}`} onClick={() => setActiveTab('assessment')}>
            Code Assessment {assessment && `(${assessment.score}%)`}
          </div>
          <div className={`drawer-tab ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveTab('questions')}>
            Interview Guide
          </div>
          <div className={`drawer-tab ${activeTab === 'email' ? 'active' : ''}`} onClick={() => setActiveTab('email')}>
            Email Automation
          </div>
          <div className={`drawer-tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>
            Notes
          </div>
          <div className={`drawer-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>
            History ({activities.length + emailLogs.length})
          </div>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Profile Card */}
              <div className="panel" style={{ margin: 0, padding: '1rem', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Email:</span>{' '}
                    <a href={`mailto:${candidate.email}`}>{candidate.email || 'N/A'}</a>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Phone:</span>{' '}
                    <span style={{ color: 'var(--text-primary)' }}>{candidate.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Work History */}
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Briefcase size={16} /> Work Experience
                </h4>
                {candidate.experience.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No experience listed.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {candidate.experience.map((exp, idx) => (
                      <div key={idx} style={{ paddingLeft: '0.75rem', borderLeft: '2px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{exp.role}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.duration}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', marginBottom: '0.4rem' }}>{exp.company}</div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{exp.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Education */}
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <GraduationCap size={16} /> Education
                </h4>
                {candidate.education.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No education details listed.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {candidate.education.map((edu, idx) => (
                      <div key={idx} style={{ fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{edu.degree} in {edu.field}</strong>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{edu.year}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{edu.institution}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Certifications */}
              {candidate.certifications && candidate.certifications.length > 0 && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Award size={16} /> Certifications
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {candidate.certifications.map((cert, idx) => (
                      <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {candidate.projects && candidate.projects.length > 0 && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <FolderGit size={16} /> Key Projects
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {candidate.projects.map((proj, idx) => (
                      <div key={idx} style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{proj.name}</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.1rem' }}>{proj.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: CODE ASSESSMENT */}
          {activeTab === 'assessment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {assessment ? (
                <>
                  {/* Assessment scorecard metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SCORE</span>
                      <strong className={getScoreClass(assessment.score)} style={{ fontSize: '1.25rem' }}>{assessment.score}%</strong>
                    </div>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TIME SPENT</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{assessment.time_taken_minutes}m</strong>
                    </div>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TEST RUNS</span>
                      <strong style={{ fontSize: '1rem', color: assessment.score >= 80 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                        {assessment.test_run_output}
                      </strong>
                    </div>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TAB SWITCHES</span>
                      <strong style={{ fontSize: '1.1rem', color: assessment.tab_switches_count > 5 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                        {assessment.tab_switches_count}
                      </strong>
                    </div>
                  </div>

                  {/* Cheating / Integrity Alert */}
                  {assessment.tab_switches_count > 5 ? (
                    <div style={{ 
                      padding: '0.75rem 1rem', 
                      borderRadius: 'var(--radius-md)', 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid var(--accent-red)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.8rem',
                      color: 'var(--accent-red)'
                    }}>
                      <AlertTriangle size={16} />
                      <div>
                        <strong>High Risk Cheating Indicator:</strong> Candidate switched tabs {assessment.tab_switches_count} times during the coding challenge. This may suggest external assistance or copying.
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '0.75rem 1rem', 
                      borderRadius: 'var(--radius-md)', 
                      backgroundColor: 'rgba(34, 197, 94, 0.05)', 
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.8rem',
                      color: 'var(--accent-green)'
                    }}>
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>Integrity Verification:</strong> Secure test run. Minimal tab switches detected ({assessment.tab_switches_count} times).
                      </div>
                    </div>
                  )}

                  {/* Submitted Code Viewer */}
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      <Terminal size={16} /> Submitted Candidate Solution ({assessment.language})
                    </h4>
                    <div style={{ position: 'relative' }}>
                      <pre style={{ 
                        margin: 0, 
                        padding: '1rem', 
                        backgroundColor: '#0a0b0d', 
                        borderRadius: 'var(--radius-lg)', 
                        border: '1px solid var(--border-color)',
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        fontSize: '0.8rem',
                        overflowX: 'auto',
                        color: '#d4d4d4',
                        lineHeight: 1.5,
                        maxHeight: '350px'
                      }}>
                        <code>{assessment.submitted_code}</code>
                      </pre>
                    </div>
                  </div>

                  {/* AI Code Review Details */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                      <Sparkles size={16} /> AI Assessment Review
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                      {/* Rating & Complexity */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code Quality Rating:</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '0.25rem' }}>
                            Grade {assessment.ai_code_review.quality_rating}
                          </div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Complexity Metrics (Big-O):</span>
                          <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.75rem' }}>
                            <div>Time Complexity: <strong style={{ color: 'var(--text-primary)' }}>{assessment.ai_code_review.complexity.time}</strong></div>
                            <div>Space Complexity: <strong style={{ color: 'var(--text-primary)' }}>{assessment.ai_code_review.complexity.space}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* Correctness Summary */}
                      <div>
                        <strong>Correctness Analysis:</strong>
                        <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {assessment.ai_code_review.correctness}
                        </p>
                      </div>

                      {/* Strengths & Improvements */}
                      <div className="grid-2">
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--accent-green)', textTransform: 'uppercase', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Code Strengths</span>
                          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: 0, fontSize: '0.8rem' }}>
                            {assessment.ai_code_review.strengths.map((str, idx) => (
                              <li key={idx}>{str}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--accent-yellow)', textTransform: 'uppercase', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Key Recommendations</span>
                          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: 0, fontSize: '0.8rem' }}>
                            {assessment.ai_code_review.improvements.map((imp, idx) => (
                              <li key={idx}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Refactored Suggestion */}
                      {assessment.ai_code_review.refactored_code && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>AI Suggested Refactored Version</span>
                          <pre style={{ 
                            margin: 0, 
                            padding: '1rem', 
                            backgroundColor: '#0a0b0d', 
                            borderRadius: 'var(--radius-lg)', 
                            border: '1px solid var(--border-color)',
                            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                            fontSize: '0.8rem',
                            overflowX: 'auto',
                            color: '#a9b7c6',
                            lineHeight: 1.5,
                            maxHeight: '300px'
                          }}>
                            <code>{assessment.ai_code_review.refactored_code}</code>
                          </pre>
                        </div>
                      )}

                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <Terminal size={32} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                  <p>No coding challenge submission has been recorded for this candidate.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Coding tests are generated matching candidate skills when you upload a resume to a job with an assigned test.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: AI ANALYSIS */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {evaluation ? (
                <>
                  {/* Scores Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OVERALL</span>
                      <strong className={getScoreClass(evaluation.overall_score)} style={{ fontSize: '1.25rem' }}>{evaluation.overall_score}%</strong>
                    </div>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SKILLS</span>
                      <strong className={getScoreClass(evaluation.skills_score)} style={{ fontSize: '1.25rem' }}>{evaluation.skills_score}%</strong>
                    </div>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EXPERIENCE</span>
                      <strong className={getScoreClass(evaluation.experience_score)} style={{ fontSize: '1.25rem' }}>{evaluation.experience_score}%</strong>
                    </div>
                    <div className="metric-card" style={{ padding: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EDUCATION</span>
                      <strong className={getScoreClass(evaluation.education_score)} style={{ fontSize: '1.25rem' }}>{evaluation.education_score}%</strong>
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      <Sparkles size={16} style={{ color: 'var(--accent-blue)' }} /> AI Summary
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {evaluation.candidate_summary}
                    </p>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid-2">
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-green)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Strengths</h4>
                      <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {evaluation.strengths.map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-yellow)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Areas of Concern</h4>
                      <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {evaluation.weaknesses.length === 0 ? (
                          <li style={{ listStyle: 'none', marginLeft: '-1.2rem' }}>No major weaknesses identified.</li>
                        ) : (
                          evaluation.weaknesses.map((weak, idx) => (
                            <li key={idx}>{weak}</li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Missing Skills & Hiring Risks */}
                  <div className="grid-2">
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-red)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Missing Skills</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {evaluation.missing_skills.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None. Perfect skill alignment.</span>
                        ) : (
                          evaluation.missing_skills.map((skill, idx) => (
                            <span key={idx} className="badge badge-danger" style={{ fontSize: '0.7rem' }}>{skill}</span>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hiring Risks</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {evaluation.hiring_risks.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>No high hiring risks identified.</span>
                        ) : (
                          evaluation.hiring_risks.map((risk, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-red)' }}>
                              <AlertTriangle size={12} /> {risk}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Requirements Checklist */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                      Explainable Match Checklist
                    </h4>
                    {/* Skills Checklist */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Required Skills</div>
                      {evaluation.scoring_details?.skills.map((skill, idx) => (
                        <div key={idx} className="checklist-item">
                          <CheckCircle2 
                            size={16} 
                            className="checklist-icon" 
                            style={{ color: skill.matched ? 'var(--accent-green)' : 'var(--text-muted)', flexShrink: 0 }} 
                          />
                          <div className="checklist-content">
                            <span className="checklist-name" style={{ color: skill.matched ? 'var(--text-primary)' : 'var(--text-muted)' }}>{skill.name}</span>
                            <span className="checklist-evidence">{skill.evidence || 'No evidence found in resume.'}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Experience Checklist */}
                    {evaluation.scoring_details?.experience && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Experience requirements</div>
                        {evaluation.scoring_details.experience.map((exp, idx) => (
                          <div key={idx} className="checklist-item">
                            <CheckCircle2 
                              size={16} 
                              className="checklist-icon" 
                              style={{ color: exp.matched ? 'var(--accent-green)' : 'var(--text-muted)', flexShrink: 0 }} 
                            />
                            <div className="checklist-content">
                              <span className="checklist-name">{exp.requirement}</span>
                              <span className="checklist-evidence">{exp.evidence}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Complete reasoning */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      AI Evaluation Report
                    </h4>
                    <div className="markdown-view panel" style={{ fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-tertiary)', margin: 0 }}>
                      {evaluation.reasoning}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <Sparkles size={32} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                  <p>AI evaluation details are not available yet for this candidate.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    To screen, drag and drop resumes in the Job candidate portal view.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: INTERVIEW GUIDE */}
          {activeTab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Custom Interview Questions</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  AI-generated questions based on resume gaps, job description requirements, and skill alignments.
                </p>
              </div>

              {interviewGuide ? (
                (['technical', 'behavioral', 'experience_validation', 'skill_verification'] as const).map((category) => {
                  const labelMap = {
                    technical: 'Technical Evaluation',
                    behavioral: 'Behavioral & Core Values',
                    experience_validation: 'Experience Validation',
                    skill_verification: 'Skill Verification'
                  };

                  const questions = interviewGuide.questions[category] || [];

                  return (
                    <div key={category} style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                        {labelMap[category]}
                      </h4>

                      {questions.map((q, idx) => {
                        const key = `${category}-${idx}`;
                        const isExpanded = expandedQuestion === key;

                        return (
                          <div key={idx} className="question-card">
                            <div 
                              className="question-card-header"
                              onClick={() => setExpandedQuestion(isExpanded ? null : key)}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <HelpCircle size={16} style={{ color: 'var(--text-muted)', marginTop: '0.1rem', flexShrink: 0 }} />
                                <span>{q.question}</span>
                              </div>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>

                            {isExpanded && (
                              <div className="question-card-body">
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Focus:</span> {q.focus}
                                </div>
                                {q.ideal_answer && (
                                  <div>
                                    <div className="question-card-answer-label">What to listen for (Ideal Response):</div>
                                    <p>{q.ideal_answer}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <HelpCircle size={32} style={{ marginBottom: '1rem' }} />
                  <p>No custom interview questions have been generated.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: EMAIL AUTOMATION */}
          {activeTab === 'email' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Candidate Communication</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Send automated updates using templates configured inSettings.
                </p>
              </div>

              <form onSubmit={handleSendEmail} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Email Trigger Event</label>
                  <select
                    className="input-field"
                    value={emailTrigger}
                    onChange={(e) => setEmailTrigger(e.target.value as any)}
                  >
                    <option value="shortlisted">Shortlist Notification</option>
                    <option value="rejected">Rejection Notification</option>
                    <option value="interview">Interview Scheduling</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Recipient Email (Customize to receive Resend Sandbox mail)</label>
                  <input
                    type="email"
                    className="input-field"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Body</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '150px' }}
                    required
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={sendingEmail}>
                    <Send size={14} />
                    {sendingEmail ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </form>

              {/* Email Sent History */}
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Email Delivery Log
                </h4>
                {emailLogs.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No emails sent yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {emailLogs.map((log) => (
                      <div key={log.id} className="email-log-item">
                        <div className="email-log-header">
                          <span className={`badge ${log.status === 'sent' ? 'badge-success' : 'badge-danger'}`}>
                            {log.status}
                          </span>
                          <span>{new Date(log.sent_at).toLocaleString()}</span>
                        </div>
                        <div className="email-log-subject">{log.subject}</div>
                        <div className="email-log-body">{log.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: NOTES */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ marginBottom: '0.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Internal Recruiter Notes</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Private evaluation notes visible only to talent team members.
                </p>
              </div>

              <div className="form-group">
                <textarea
                  className="input-field"
                  style={{ minHeight: '250px', lineHeight: 1.5 }}
                  placeholder="Start typing notes here (e.g. 'Highly responsive over phone...')"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSaveNotes} disabled={savingNotes}>
                  <Save size={14} />
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          )}

          {/* TAB: ACTIVITY */}
          {activeTab === 'activity' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Candidate Audit Timeline</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  A full log of screenings, stage modifications, and recruiter actions.
                </p>
              </div>

              {activities.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No activity records available.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '0.5rem' }}>
                  {activities.map((act) => (
                    <div key={act.id} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
                      <Clock size={14} style={{ color: 'var(--text-muted)', marginTop: '0.1rem', flexShrink: 0 }} />
                      <div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {act.action === 'resume_uploaded' && <span>Resume parsed and profile extracted.</span>}
                          {act.action === 'candidate_screened' && (
                            <span>
                              AI screening complete. Match score: <strong>{act.details.score}%</strong>.
                            </span>
                          )}
                          {act.action === 'candidate_shortlisted' && (
                            <span style={{ color: 'var(--accent-green)' }}>Candidate shortlisted.</span>
                          )}
                          {act.action === 'candidate_rejected' && (
                            <span style={{ color: 'var(--accent-red)' }}>Candidate rejected.</span>
                          )}
                          {act.action === 'stage_changed' && (
                            <span>
                              Moved from <em>{act.details.stageFrom}</em> to{' '}
                              <em>{act.details.stageTo}</em>.
                            </span>
                          )}
                          {act.action === 'email_sent' && (
                            <span>
                              Notification sent (Trigger: <code>{act.details.emailTrigger}</code>).
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(act.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
export default CandidateDrawer;
