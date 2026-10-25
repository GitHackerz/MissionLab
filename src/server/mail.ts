import 'server-only';

async function getTransport() {
  const nodemailer = await import('nodemailer');
  return nodemailer.default.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
  });
}

const FROM = process.env.MAIL_FROM ?? 'MissionLab <no-reply@missionlab.local>';
export const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#0e0b0c;font-family:Segoe UI,Arial,sans-serif;color:#fdfaf5">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#171213;border:1px solid #3a2a23;border-radius:16px;padding:32px">
      <tr><td style="font-size:18px;font-weight:700;color:#fe5319;letter-spacing:.04em">MissionLab</td></tr>
      <tr><td style="padding-top:16px;font-size:22px;font-weight:600">${title}</td></tr>
      <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#bcaca3">${body}</td></tr>
      <tr><td style="padding-top:24px"><a href="${cta.url}" style="display:inline-block;background:#fe5319;color:#1a0d08;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${cta.label}</a></td></tr>
      <tr><td style="padding-top:20px;font-size:12px;color:#8f817a">If the button doesn’t work, paste this link into your browser:<br>${cta.url}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const url = `${APP_URL}/verify-email/confirm?token=${encodeURIComponent(token)}`;
  const transport = await getTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: 'Confirm your MissionLab email',
    text: `Hi ${name},\n\nConfirm your email to activate your MissionLab account:\n${url}\n\nThis link expires in 24 hours.`,
    html: layout(
      `Hi ${escapeHtml(name)}, confirm your email`,
      'Fankouch is waiting at mission control. Confirm your email to activate your account. This link expires in 24 hours.',
      { label: 'Confirm email', url },
    ),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const transport = await getTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: 'Reset your MissionLab password',
    text: `Hi ${name},\n\nReset your password here:\n${url}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
    html: layout(
      'Reset your password',
      'Someone asked to reset the password for this account. If it was you, use the button below. The link expires in 1 hour. If it wasn’t you, ignore this email.',
      { label: 'Choose a new password', url },
    ),
  });
}
