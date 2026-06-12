import React, { useState, useEffect } from 'react';
import { db } from '../services/db/database';
import type { ISettings } from '../services/db/types';
import { useToast } from '../context/ToastContext';
import { Save, Key, Mail, RefreshCw } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ISettings>({
    geminiApiKey: '',
    openrouterApiKey: '',
    useOpenRouter: false,
    resendApiKey: '',
    emailTemplates: {
      shortlisted: '',
      rejected: '',
      interview: ''
    }
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await db.getSettings();
        setSettings({
          geminiApiKey: data.geminiApiKey || '',
          openrouterApiKey: data.openrouterApiKey || '',
          useOpenRouter: data.useOpenRouter || false,
          resendApiKey: data.resendApiKey || '',
          emailTemplates: {
            shortlisted: data.emailTemplates?.shortlisted || '',
            rejected: data.emailTemplates?.rejected || '',
            interview: data.emailTemplates?.interview || ''
          }
        });
      } catch (error) {
        showToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [showToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await db.saveSettings(settings);
      showToast('Settings saved successfully', 'success');
    } catch (error) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (stage: 'shortlisted' | 'rejected' | 'interview', value: string) => {
    setSettings(prev => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates!,
        [stage]: value
      }
    }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <RefreshCw className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const isSupabase = db.isSupabaseConfigured();

  return (
    <div className="page-body" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Platform Settings</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Configure artificial intelligence models, communication services, and standard templates.
        </p>
      </div>

      {!isSupabase && (
        <div className="sandbox-banner">
          <span>⚠️</span>
          <div>
            <strong>Offline Sandbox Mode:</strong> Settings are persisted to browser LocalStorage. 
            Configure Supabase in <code>.env</code> file for server-side persistence.
          </div>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Section 1: AI Provider Config */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={18} style={{ color: 'var(--accent-blue)' }} />
              <h3 className="panel-title">AI Engine Settings</h3>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Default API Provider</label>
              <select
                className="input-field"
                value={settings.useOpenRouter ? 'openrouter' : 'gemini'}
                onChange={(e) => setSettings(prev => ({ ...prev, useOpenRouter: e.target.value === 'openrouter' }))}
              >
                <option value="gemini">Google Gemini (Recommended)</option>
                <option value="openrouter">OpenRouter (Kimi, etc.)</option>
              </select>
            </div>

            {!settings.useOpenRouter ? (
              <div className="form-group">
                <label className="form-label">Google Gemini API Key</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter Gemini API Key (e.g. AIzaSy...)"
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Default model is <code>gemini-1.5-flash</code>. Runs client-side or fallback regex mock if empty.
                </span>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">OpenRouter API Key</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter OpenRouter API Key (sk-or-...)"
                  value={settings.openrouterApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, openrouterApiKey: e.target.value }))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Connects to OpenRouter. Defaults to <code>google/gemini-2.5-flash</code>.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Resend Email Settings */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} style={{ color: 'var(--accent-blue)' }} />
              <h3 className="panel-title">Email Delivery Config</h3>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Resend API Key</label>
            <input
              type="password"
              className="input-field"
              placeholder="re_..."
              value={settings.resendApiKey}
              onChange={(e) => setSettings(prev => ({ ...prev, resendApiKey: e.target.value }))}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Provide a Resend credentials key. If empty, emails will log to the database and developer console.
            </span>
          </div>
        </div>

        {/* Section 3: Customizable templates */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
            <h3 className="panel-title">Automated Email Templates</h3>
          </div>
          
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
            Available placeholders: <code>{"{{name}}"}</code> (Candidate name), <code>{"{{job_title}}"}</code> (Job title), <code>{"{{skills}}"}</code> (First 3 skills from candidate resume).
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Candidate Shortlisted Template</label>
              <textarea
                className="input-field"
                value={settings.emailTemplates?.shortlisted}
                onChange={(e) => handleTemplateChange('shortlisted', e.target.value)}
                placeholder="Hi {{name}}, we were highly impressed by..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Interview Invitation Template</label>
              <textarea
                className="input-field"
                value={settings.emailTemplates?.interview}
                onChange={(e) => handleTemplateChange('interview', e.target.value)}
                placeholder="Hi {{name}}, let's schedule an interview..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Candidate Rejected Template</label>
              <textarea
                className="input-field"
                value={settings.emailTemplates?.rejected}
                onChange={(e) => handleTemplateChange('rejected', e.target.value)}
                placeholder="Hi {{name}}, thank you for applying to the {{job_title}} role..."
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '3rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
export default SettingsView;
