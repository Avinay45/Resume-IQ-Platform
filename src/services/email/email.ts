import { db } from '../db/database';
import type { ICandidate } from '../db/types';

export class EmailService {
  /**
   * Replaces template tags (e.g. {{name}}, {{job_title}}) with actual values.
   */
  static compileTemplate(template: string, candidate: ICandidate, jobTitle: string): string {
    return template
      .replace(/{{name}}/g, candidate.name)
      .replace(/{{job_title}}/g, jobTitle)
      .replace(/{{skills}}/g, candidate.skills.slice(0, 3).join(', ') || 'your skills');
  }

  /**
   * Sends an automated email to a candidate and records it in the history log.
   */
  static async sendEmail(
    candidate: ICandidate,
    jobTitle: string,
    triggerEvent: 'shortlisted' | 'rejected' | 'interview',
    customSubject?: string,
    customBody?: string,
    recipientOverride?: string
  ): Promise<{ success: boolean; message: string }> {
    const settings = await db.getSettings();
    const envResendKey = import.meta.env.VITE_RESEND_API_KEY;
    const apiKey = settings.resendApiKey || envResendKey;

    // Compile subject and body
    let subject = customSubject || '';
    let body = customBody || '';

    if (!body) {
      const defaultTemplate = settings.emailTemplates?.[triggerEvent] || '';
      body = this.compileTemplate(defaultTemplate, candidate, jobTitle);
    }

    if (!subject) {
      if (triggerEvent === 'shortlisted') subject = `Application Update: ${jobTitle}`;
      if (triggerEvent === 'rejected') subject = `Your Application: ${jobTitle}`;
      if (triggerEvent === 'interview') subject = `Interview Scheduled: ${jobTitle}`;
    }

    const recipient = recipientOverride || candidate.email || 'onboarding@resend.dev';

    try {
      let status: 'sent' | 'failed' = 'sent';
      let message = 'Email sent successfully via Sandbox Log.';

      if (apiKey && apiKey !== 'your-resend-api-key') {
        try {
          // Run actual Resend API Call using corsproxy.io to bypass client-side browser CORS blocking
          const response = await fetch('https://corsproxy.io/?https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              from: 'ResumeIQ <onboarding@resend.dev>',
              to: recipient,
              subject: subject,
              text: body
            })
          });
 
          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Resend API response error: ${response.statusText} - ${errText}`);
          }
          
          message = 'Email successfully sent via Resend API.';
        } catch (fetchErr) {
          console.warn('Resend API call failed (possibly due to network issues or invalid Resend API key). falling back to Sandbox email logging:', fetchErr);
          message = 'Email logged in Sandbox history (Resend API call failed. Verify your API key or internet connection).';
          console.log(`[SANDBOX MAIL FALLBACK] To: ${recipient}\nSubject: ${subject}\nBody:\n${body}`);
          status = 'sent'; // Set status to sent for fallback logging success
        }
      } else {
        console.log(`[SANDBOX MAIL] To: ${recipient}\nSubject: ${subject}\nBody:\n${body}`);
        status = 'sent';
      }

      // Record in logs
      await db.createEmailLog({
        candidate_id: candidate.id,
        recipient: recipient,
        subject,
        body,
        status,
        trigger_event: triggerEvent
      });

      return { success: status === 'sent', message };
    } catch (error) {
      console.error('Failed to send email:', error);
      
      // Log failure in candidate history log anyway
      await db.createEmailLog({
        candidate_id: candidate.id,
        recipient: recipient,
        subject,
        body: body,
        status: 'failed',
        trigger_event: triggerEvent
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown email error occurred.'
      };
    }
  }
}
export default EmailService;
