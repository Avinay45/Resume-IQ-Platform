import React, { useState, useEffect } from 'react';
import { db } from '../services/db/database';
import { AIService } from '../services/ai/ai';
import type { IJob } from '../services/db/types';
import { useToast } from '../context/ToastContext';
import { Briefcase, MapPin, Building, Plus, FileText, BrainCircuit, X } from 'lucide-react';

interface JobsViewProps {
  onSelectJob: (jobId: string) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({ onSelectJob }) => {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<IJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<IJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingJob, setSavingJob] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [seniority, setSeniority] = useState('Senior');
  const [description, setDescription] = useState('');
  const [assessmentTest, setAssessmentTest] = useState('React Stateful Counter');

  const loadJobs = async () => {
    try {
      const jobList = await db.getJobs();
      setJobs(jobList);
      if (jobList.length > 0 && !selectedJob) {
        setSelectedJob(jobList[0]);
      }
    } catch (err) {
      showToast('Error loading jobs list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingJob(true);
    showToast('Extracting job filters with AI...', 'info');
    
    try {
      // Step 1: Run AI requirements extraction
      const extractedRequirements = await AIService.extractJobRequirements(title, description);

      // Step 2: Save Job record in database
      const newJob = await db.createJob({
        title,
        department,
        location,
        employment_type: employmentType,
        seniority,
        description,
        requirements: extractedRequirements,
        status: 'active',
        assessment_test: assessmentTest || undefined
      });

      showToast('Job listing and AI filters created!', 'success');
      setIsModalOpen(false);
      
      // Reset form
      setTitle('');
      setDepartment('');
      setLocation('');
      setEmploymentType('Full-time');
      setSeniority('Senior');
      setDescription('');
      setAssessmentTest('React Stateful Counter');
      
      setSelectedJob(newJob);
      loadJobs();
    } catch (err) {
      showToast('Failed to create job requirements', 'error');
    } finally {
      setSavingJob(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading jobs list...</p>
      </div>
    );
  }

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Jobs Management</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Create jobs and review extracted AI screening requirement criteria.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={14} /> Create Job
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        {/* Jobs List Panel */}
        <div className="panel" style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'auto', marginBottom: 0 }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
            Active Roles ({jobs.length})
          </h3>
          
          {jobs.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <Briefcase size={28} style={{ marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.8rem' }}>No active jobs found.</p>
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '0.75rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setIsModalOpen(true)}
              >
                Create First Job
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {jobs.map((job) => (
                <div 
                  key={job.id} 
                  onClick={() => setSelectedJob(job)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: selectedJob?.id === job.id ? 'var(--accent-blue)' : 'var(--border-color)',
                    backgroundColor: selectedJob?.id === job.id ? 'var(--accent-blue-alpha)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {job.title}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                    {job.department} • {job.location}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Job Details Panel */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', marginBottom: 0 }}>
          {selectedJob ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
              
              {/* Header Details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{selectedJob.title}</h2>
                  <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Building size={14} /> {selectedJob.department}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> {selectedJob.location}</span>
                  </div>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => onSelectJob(selectedJob.id)}
                >
                  Screen Candidates &rarr;
                </button>
              </div>

              {/* Side-by-side details splits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', flex: 1 }}>
                
                {/* Description Column */}
                <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                    <FileText size={14} /> Job Description
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {selectedJob.description}
                  </div>
                </div>

                {/* AI Extracted Filters Column */}
                <div style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1rem', overflowY: 'auto' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>
                    <BrainCircuit size={16} /> AI Extracted Filters
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
                    {/* Experience Requirement */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Experience Requirements</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{selectedJob.requirements.experience_years}+ Years</div>
                    </div>

                    {/* Education Requirement */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Education Level</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{selectedJob.requirements.education || 'Not Specified'}</div>
                    </div>

                    {/* Coding Assessment */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Coding Assessment</div>
                      <div style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>
                        {selectedJob.assessment_test || 'No assessment assigned'}
                      </div>
                    </div>

                    {/* Required Skills */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Required Core Skills</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {selectedJob.requirements.required_skills.map((s, idx) => (
                          <span key={idx} className="badge badge-info">{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* Preferred Skills */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Preferred Skills</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {selectedJob.requirements.preferred_skills.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None listed</span>
                        ) : (
                          selectedJob.requirements.preferred_skills.map((s, idx) => (
                            <span key={idx} className="badge badge-success">{s}</span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Keywords */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Extracted Keywords</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {selectedJob.requirements.keywords?.map((k, idx) => (
                          <span key={idx} className="badge badge-secondary" style={{ textTransform: 'none' }}>{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a job to view its details or create a new listing.
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal dialog */}
      {isModalOpen && (
        <div className="drawer-backdrop" style={{ justifyContent: 'center', alignItems: 'center' }} onClick={() => !savingJob && setIsModalOpen(false)}>
          <div className="panel" style={{ width: '600px', maxWidth: '90%', margin: 0, overflowY: 'auto', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Create New Job Listing</h3>
              <button className="btn btn-secondary" style={{ padding: '0.3rem' }} disabled={savingJob} onClick={() => setIsModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="e.g. Senior Software Engineer"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={savingJob}
                />
              </div>

              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="e.g. Engineering"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    disabled={savingJob}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="e.g. San Francisco, CA (Hybrid)"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    disabled={savingJob}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select
                    className="input-field"
                    value={employmentType}
                    onChange={e => setEmploymentType(e.target.value)}
                    disabled={savingJob}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Seniority</label>
                  <select
                    className="input-field"
                    value={seniority}
                    onChange={e => setSeniority(e.target.value)}
                    disabled={savingJob}
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Coding Assessment Test</label>
                <select
                  className="input-field"
                  value={assessmentTest}
                  onChange={e => setAssessmentTest(e.target.value)}
                  disabled={savingJob}
                >
                  <option value="">No assessment assigned</option>
                  <option value="React Stateful Counter">React Stateful Counter (React/TypeScript)</option>
                  <option value="SQL Customer Aggregation">SQL Customer Aggregation (SQL/Postgres)</option>
                  <option value="REST API Endpoint">REST API Endpoint (Node/Express/JS)</option>
                  <option value="Algorithm: Binary Tree Inversion">Algorithm: Binary Tree Inversion (Python)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Job Description & Requirements</label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '180px' }}
                  required
                  placeholder="Paste complete description details. AI will extract requirement constraints and skills filters."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={savingJob}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" disabled={savingJob} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingJob}>
                  {savingJob ? 'Running AI Parser...' : 'Save Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default JobsView;
