import "server-only";

import nodemailer from 'nodemailer';
import { env } from './env';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

// Create reusable SMTP transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false
  }
});

// Verify transporter configuration on startup (Skip during build to avoid noise)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  transporter.verify(function (error, success) {
    if (error) {
      console.error('SMTP Connection Error:', error);
    }
  });
}

/**
 * Send an email using the configured SMTP server
 */
export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: from || `"Tusker Management" <${env.SMTP_FROM}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    });

    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      data: info,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

export default transporter;
