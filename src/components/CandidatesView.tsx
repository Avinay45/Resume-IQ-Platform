import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db/database';
import { AIService } from '../services/ai/ai';
import { extractTextFromPDF } from '../utils/pdfParser';
import { extractTextFromDocx } from '../utils/docxParser';
import type { ICandidate, IJob } from '../services/db/types';
import { useToast } from '../context/ToastContext';
import { CandidateDrawer } from './CandidateDrawer';
import { Upload } from 'lucide-react';

interface CandidatesViewProps {
  jobId: string;
}

interface UploadProgress {
  fileName: string;
  status: 'reading' | 'extracting' | 'evaluating' | 'generating' | 'grading' | 'success' | 'failed';
  percent: number;
  error?: string;
}

export const CandidatesView: React.FC<CandidatesViewProps> = ({ jobId }) => {
  const { showToast } = useToast();
  const [job, setJob] = useState<IJob | null>(null);
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [evalsMap, setEvalsMap] = useState<Record<string, number>>({});
  const [assessmentsMap, setAssessmentsMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pipelineStages: ICandidate['stage'][] = [
    'applied',
    'ai_screened',
    'under_review',
    'shortlisted',
    'interview',
    'offer',
    'hired',
    'rejected'
  ];

  const stageLabels: Record<ICandidate['stage'], string> = {
    applied: 'Applied',
    ai_screened: 'AI Screened',
    under_review: 'Under Review',
    shortlisted: 'Shortlisted',
    interview: 'Interview',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected'
  };

  const loadData = async () => {
    try {
      const jobData = await db.getJob(jobId);
      setJob(jobData);

      const candList = await db.getCandidates(jobId);
      setCandidates(candList);

      // Load evaluations and assessments for matching score badges
      const evalsObj: Record<string, number> = {};
      const assessObj: Record<string, number> = {};
      for (const cand of candList) {
        const ev = await db.getEvaluation(cand.id);
        if (ev) {
          evalsObj[cand.id] = ev.overall_score;
        }
        const ass = await db.getAssessment(cand.id);
        if (ass) {
          assessObj[cand.id] = ass.score;
        }
      }
      setEvalsMap(evalsObj);
      setAssessmentsMap(assessObj);
    } catch (err) {
      showToast('Error loading candidates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [jobId]);

  // Drag-and-drop file ingestion
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  // Process Files Ingestion Engine
  const processFiles = async (files: File[]) => {
    if (!job) return;

    // Filter valid files (PDF / DOCX)
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isValid = ext === 'pdf' || ext === 'docx';
      if (!isValid) {
        showToast(`Skipped ${file.name}: Only PDF/DOCX supported.`, 'warning');
      }
      return isValid;
    });

    if (validFiles.length === 0) return;

    // Initialize progress indicators
    const newUploads = validFiles.map(f => ({
      fileName: f.name,
      status: 'reading' as const,
      percent: 10
    }));
    setUploads(prev => [...prev, ...newUploads]);

    for (const file of validFiles) {
      const updateProgress = (status: UploadProgress['status'], percent: number, error?: string) => {
        setUploads(prev =>
          prev.map(u => (u.fileName === file.name ? { ...u, status, percent, error } : u))
        );
      };

      try {
        // Step 1: Read and parse resume text client-side
        updateProgress('reading', 25);
        let resumeText = '';
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'pdf') {
          resumeText = await extractTextFromPDF(file);
        } else if (ext === 'docx') {
          resumeText = await extractTextFromDocx(file);
        }

        // Step 2: Extract candidate profile data from text
        updateProgress('extracting', 50);
        const parsedProfile = await AIService.extractResumeData(resumeText);

        // Step 3: Insert Candidate in database
        const createdCand = await db.createCandidate({
          job_id: jobId,
          name: parsedProfile.name || file.name.split('.')[0],
          email: parsedProfile.email || '',
          phone: parsedProfile.phone || '',
          skills: parsedProfile.skills || [],
          experience: parsedProfile.experience || [],
          education: parsedProfile.education || [],
          certifications: parsedProfile.certifications || [],
          projects: parsedProfile.projects || [],
          resume_text: resumeText,
          stage: 'applied'
        });

        // Step 4: Run AI matching evaluation
        updateProgress('evaluating', 75);
        const evalResults = await AIService.evaluateCandidate(
          resumeText,
          job.title,
          job.description,
          job.requirements
        );
        await db.createEvaluation({
          candidate_id: createdCand.id,
          overall_score: evalResults.overall_score,
          skills_score: evalResults.skills_score,
          experience_score: evalResults.experience_score,
          education_score: evalResults.education_score,
          recommendation: evalResults.recommendation,
          reasoning: evalResults.reasoning,
          candidate_summary: evalResults.candidate_summary,
          strengths: evalResults.strengths,
          weaknesses: evalResults.weaknesses,
          missing_skills: evalResults.missing_skills,
          hiring_risks: evalResults.hiring_risks,
          growth_potential: evalResults.growth_potential,
          scoring_details: evalResults.scoring_details
        });

        // Step 5: Generate custom interview questions
        updateProgress('generating', 85);
        const questionsResults = await AIService.generateInterviewGuide(
          resumeText,
          job.title,
          job.description
        );
        await db.createInterviewGuide({
          candidate_id: createdCand.id,
          questions: questionsResults.questions
        });

        // Step 6: Generate Coding Assessment Submission if job has a test
        if (job.assessment_test) {
          updateProgress('grading', 95);
          const assessmentResults = await AIService.generateCodingSubmission(
            createdCand.name,
            resumeText,
            job.assessment_test,
            job.assessment_test.toLowerCase().includes('react') ? 'typescript' : 'javascript'
          );
          await db.createAssessment({
            candidate_id: createdCand.id,
            job_id: job.id,
            test_name: assessmentResults.test_name,
            language: assessmentResults.language,
            score: assessmentResults.score,
            time_taken_minutes: assessmentResults.time_taken_minutes,
            tab_switches_count: assessmentResults.tab_switches_count,
            submitted_code: assessmentResults.submitted_code,
            test_run_output: assessmentResults.test_run_output,
            ai_code_review: assessmentResults.ai_code_review
          });
        }

        // Done
        updateProgress('success', 100);
        showToast(`Successfully screened ${createdCand.name}!`, 'success');
        loadData(); // reload Kanban board
      } catch (err: any) {
        console.error(`Error processing resume ${file.name}:`, err);
        updateProgress('failed', 100, err?.message || 'Processing failed');
        showToast(`Failed to parse ${file.name}: ${err?.message}`, 'error');
      }
    }
  };

  // Kanban HTML5 drag and drop actions
  const handleDragStartCard = (e: React.DragEvent, candidateId: string) => {
    e.dataTransfer.setData('text/plain', candidateId);
  };

  const handleDropOnColumn = async (e: React.DragEvent, targetStage: ICandidate['stage']) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('text/plain');
    if (!candidateId) return;

    try {
      await db.updateCandidateStage(candidateId, targetStage);
      showToast(`Candidate moved to ${stageLabels[targetStage]}`, 'success');
      loadData();
    } catch (err) {
      showToast('Failed to move candidate', 'error');
    }
  };

  const getScoreBadgeClass = (score: number | undefined) => {
    if (score === undefined) return '';
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading candidates pipeline...</p>
      </div>
    );
  }

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem' }}>
      
      {/* Top Details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{job?.title}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {job?.department} • {job?.location} • {job?.employment_type} • {candidates.length} candidates
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Upload Resumes
        </button>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload Progress Status Feed */}
      {uploads.length > 0 && (
        <div className="panel" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Resume Screening Queue</span>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={() => setUploads([])}
            >
              Clear Feed
            </button>
          </div>
          <div className="upload-progress-list" style={{ margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
            {uploads.map((upload, idx) => (
              <div key={idx} className="progress-item" style={{ padding: '0.5rem 0.75rem' }}>
                <div className="progress-item-header" style={{ fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                    {upload.fileName}
                  </span>
                  <span style={{ 
                    color: upload.status === 'success' ? 'var(--accent-green)' : 
                           upload.status === 'failed' ? 'var(--accent-red)' : 'var(--text-secondary)' 
                  }}>
                    {upload.status === 'reading' && 'Reading resume file...'}
                    {upload.status === 'extracting' && 'Extracting details...'}
                    {upload.status === 'evaluating' && 'Running AI match evaluation...'}
                    {upload.status === 'generating' && 'Formulating interview guide...'}
                    {upload.status === 'grading' && 'Simulating coding test & AI grading...'}
                    {upload.status === 'success' && 'Screening Complete'}
                    {upload.status === 'failed' && `Error: ${upload.error}`}
                  </span>
                </div>
                {upload.status !== 'success' && upload.status !== 'failed' && (
                  <div className="progress-bar-container" style={{ height: '3px' }}>
                    <div className="progress-bar-fill" style={{ width: `${upload.percent}%` }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag & Drop uploader landing */}
      {candidates.length === 0 && uploads.length === 0 ? (
        <div 
          className="upload-zone"
          style={{ flex: 1, justifyContent: 'center', borderColor: isDraggingOver ? 'var(--accent-blue)' : 'var(--border-color)' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="upload-icon" size={48} />
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Upload Candidate Resumes</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Drag and drop PDF or DOCX files here, or click to browse.
            </p>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            ResumeIQ automatically reads credentials, runs scores, logs history, and generates guides.
          </span>
        </div>
      ) : (
        /* Visual Kanban Pipeline Board */
        <div className="pipeline-container"
          onDragOver={(e) => e.preventDefault()}
          style={{
            background: isDraggingOver ? 'rgba(59, 130, 246, 0.02)' : 'none'
          }}
        >
          {pipelineStages.map((stage) => {
            const stageCandidates = candidates.filter(c => c.stage === stage);
            
            return (
              <div 
                key={stage} 
                className="pipeline-column"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnColumn(e, stage)}
              >
                <div className="pipeline-column-header">
                  <span>{stageLabels[stage]}</span>
                  <span className="pipeline-column-count">{stageCandidates.length}</span>
                </div>

                <div className="pipeline-cards-area">
                  {stageCandidates.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drag here</span>
                    </div>
                  ) : (
                    stageCandidates.map((cand) => {
                      const score = evalsMap[cand.id];
                      return (
                        <div 
                          key={cand.id} 
                          className="candidate-card"
                          draggable
                          onDragStart={(e) => handleDragStartCard(e, cand.id)}
                          onClick={() => setSelectedCandidateId(cand.id)}
                        >
                          <div className="candidate-card-header">
                            <span className="candidate-card-name">{cand.name}</span>
                            <div style={{ display: 'flex', gap: '0.2rem' }}>
                              {score !== undefined && (
                                <span className={`score-indicator ${getScoreBadgeClass(score)}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.25rem' }} title="Resume Match Score">
                                  CV: {score}%
                                </span>
                              )}
                              {assessmentsMap[cand.id] !== undefined && (
                                <span className={`score-indicator ${getScoreBadgeClass(assessmentsMap[cand.id])}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.25rem' }} title="Coding Score">
                                  Code: {assessmentsMap[cand.id]}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="candidate-card-meta">
                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cand.skills.slice(0, 3).join(' • ') || 'No skills parsed'}
                            </span>
                            <span style={{ fontSize: '0.7rem' }}>
                              Rank #{cand.rank_position}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Drawer slide-over */}
      {selectedCandidateId && (
        <CandidateDrawer
          candidateId={selectedCandidateId}
          jobTitle={job?.title || ''}
          onClose={() => setSelectedCandidateId(null)}
          onStageUpdated={loadData}
        />
      )}
    </div>
  );
};
export default CandidatesView;
