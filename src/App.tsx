import React, { useState, useEffect } from 'react';
import { db } from './services/db/database';
import type { IJob } from './services/db/types';
import { ToastProvider } from './context/ToastContext';
import { DashboardView } from './components/DashboardView';
import { JobsView } from './components/JobsView';
import { CandidatesView } from './components/CandidatesView';
import { SettingsView } from './components/SettingsView';
import { 
  LayoutDashboard, Briefcase, Users, Settings, 
  Sparkles, Cpu 
} from 'lucide-react';

type ActiveView = 'dashboard' | 'jobs' | 'candidates' | 'settings';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<ActiveView>('dashboard');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [activeJobs, setActiveJobs] = useState<IJob[]>([]);

  // Load jobs list
  const loadJobsList = async () => {
    try {
      const list = await db.getJobs();
      const activeList = list.filter(j => j.status === 'active');
      setActiveJobs(activeList);
      
      // Auto-select first job if none selected
      if (activeList.length > 0 && !selectedJobId) {
        setSelectedJobId(activeList[0].id);
      }
    } catch (err) {
      console.error('Error loading jobs database:', err);
    }
  };

  useEffect(() => {
    loadJobsList();
  }, [currentView]);

  const handleNavigate = (view: ActiveView, jobId?: string) => {
    if (jobId) {
      setSelectedJobId(jobId);
    }
    setCurrentView(view);
  };

  const isSupabase = db.isSupabaseConfigured();

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Sparkles size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>Resume</span>IQ
        </div>
        
        <nav className="sidebar-nav">
          <div 
            className={`sidebar-link ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </div>
          
          <div 
            className={`sidebar-link ${currentView === 'jobs' ? 'active' : ''}`}
            onClick={() => handleNavigate('jobs')}
          >
            <Briefcase size={18} />
            Jobs
          </div>
          
          <div 
            className={`sidebar-link ${currentView === 'candidates' ? 'active' : ''}`}
            onClick={() => handleNavigate('candidates')}
          >
            <Users size={18} />
            Candidates Pipeline
          </div>
          
          <div 
            className={`sidebar-link ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavigate('settings')}
          >
            <Settings size={18} />
            Settings
          </div>
        </nav>

        {/* Database Status indicator */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isSupabase ? 'var(--accent-green)' : 'var(--accent-yellow)' 
            }}></div>
            <span>{isSupabase ? 'Supabase Connected' : 'Offline Local Sandbox'}</span>
          </div>
          <span style={{ opacity: 0.5 }}>Version 1.0.0</span>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        {/* Top Header toolbar */}
        <header className="header-bar">
          <div className="header-title">
            {currentView === 'dashboard' && 'Dashboard'}
            {currentView === 'jobs' && 'Role Openings'}
            {currentView === 'candidates' && 'Pipeline Review'}
            {currentView === 'settings' && 'Platform Settings'}
          </div>

          <div className="header-actions">
            {/* If in candidates view, show job selector dropdown */}
            {currentView === 'candidates' && activeJobs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Inspection Role:</span>
                <select
                  className="input-field"
                  style={{ 
                    padding: '0.3rem 2rem 0.3rem 0.6rem', 
                    fontSize: '0.8rem', 
                    width: '240px',
                    height: 'auto',
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)'
                  }}
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  {activeJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.3rem 0.6rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <Cpu size={14} style={{ color: 'var(--accent-blue)' }} />
              <span>AI Analyst Live</span>
            </div>
          </div>
        </header>

        {/* Dynamic View Injection */}
        {currentView === 'dashboard' && (
          <DashboardView onNavigate={handleNavigate} />
        )}
        
        {currentView === 'jobs' && (
          <JobsView onSelectJob={(jobId) => handleNavigate('candidates', jobId)} />
        )}
        
        {currentView === 'candidates' && (
          activeJobs.length === 0 ? (
            <div className="page-body" style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Briefcase size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
              <h3>No Active Job Openings Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', maxWidth: '350px' }}>
                Create a job listing first under the Jobs tab to screen candidates.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '1rem' }}
                onClick={() => handleNavigate('jobs')}
              >
                Go to Jobs view
              </button>
            </div>
          ) : (
            <CandidatesView jobId={selectedJobId} />
          )
        )}
        
        {currentView === 'settings' && (
          <SettingsView />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};
export default App;
