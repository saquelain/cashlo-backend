import nodemailer from 'nodemailer';
import { config } from '../config/environment.js';

// Plain Gmail SMTP for now — no domain verification needed, but capped at
// ~500 emails/day and the "from" address is locked to the authenticated
// Gmail account (can't send as noreply@cashlo.com until a real domain-based
// provider like ZeptoMail is set up later).
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  family: 4, // force IPv4 — Render's network has broken/partial IPv6 routing to Gmail
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export const sendOtpEmail = async ({ to, name, otp }) => {
  try {
    await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.user}>`,
      to,
      subject: 'Your Cashlo Distributor OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Verify your email</h2>
          <p>Use the OTP below to verify your email and continue reserving your Cashlo distributor pincode:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
          <p>This OTP is valid for 5 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    const error = new Error('Failed to send OTP email');
    error.statusCode = 502;
    error.details = err.message;
    throw error;
  }
};