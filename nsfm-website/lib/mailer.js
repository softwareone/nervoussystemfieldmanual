const nodemailer = require('nodemailer');

const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

async function sendDownloadEmail({ email, name, downloadUrl, maxUses, expiryHours }) {
  if (!transporter) {
    throw new Error('SMTP is not configured — cannot send download email.');
  }

  const firstName = name ? escapeHtml(name.split(' ')[0]) : 'Operator';
  const safeUrl = escapeHtml(downloadUrl);
  const uses = maxUses || 3;
  const hours = expiryHours || 48;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin:0; padding:0; background:#0E0F10; font-family: Georgia, serif; }
  .wrapper { max-width:600px; margin:0 auto; background:#111210; }
  .header { background:#0E0F10; padding:32px 40px; border-bottom:2px solid #CC9029; }
  .header h1 { margin:0; font-family:Georgia,serif; font-size:13px; letter-spacing:0.2em; text-transform:uppercase; color:#CC9029; }
  .body { padding:40px; }
  .body p { color:#C8C4BC; font-size:16px; line-height:1.7; margin:0 0 20px; }
  .body strong { color:#F2EFE8; }
  .cta-block { margin:40px 0; text-align:center; }
  .cta-btn { display:inline-block; background:#CC9029; color:#0E0F10; text-decoration:none; font-family:Georgia,serif; font-size:14px; font-weight:bold; letter-spacing:0.15em; text-transform:uppercase; padding:16px 40px; }
  .meta { background:#0E0F10; border:1px solid #2A2B28; padding:20px; margin:32px 0; }
  .meta p { color:#8A8578; font-size:13px; margin:4px 0; }
  .crisis { background:#1A0A0A; border-left:3px solid #8B1A1A; padding:16px 20px; margin:32px 0; }
  .crisis p { color:#C8C4BC; font-size:13px; margin:4px 0; }
  .footer { padding:32px 40px; border-top:1px solid #2A2B28; }
  .footer p { color:#8A8578; font-size:12px; margin:4px 0; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>&#9733; Battlefield Essentials &#9733;</h1>
  </div>
  <div class="body">
    <p><strong>${firstName} &mdash;</strong></p>
    <p>Your manual is ready. Below is your personal download link.</p>
    <p>You have <strong>${uses} downloads</strong> and <strong>${hours} hours</strong> before the link expires. Download it now and save it somewhere you won't lose it &mdash; your phone, your laptop, a cloud folder.</p>

    <div class="cta-block">
      <a href="${safeUrl}" class="cta-btn">Download Your Manual</a>
    </div>

    <div class="meta">
      <p><strong style="color:#CC9029;">The Nervous System Field Manual</strong></p>
      <p>A Corpsman's Guide to the War Within</p>
      <p>Downloads remaining: ${uses} &nbsp;|&nbsp; Expires: ${hours} hours from now</p>
      <p>If the button doesn't work, copy this link: ${safeUrl}</p>
    </div>

    <p>Start with Pillar 1. Read the whole thing first. Then run the 90-Second Reset three times today and check the box.</p>
    <p>The kit will be here. You just have to be here first.</p>
    <p>Heads up. Shoulders back. One foot in front of the other.</p>
    <p><em>&mdash; Bobby</em><br>
    <span style="color:#8A8578;font-size:13px;">FMF Navy Corpsman (2002&ndash;2009) | OEF Veteran | Founder, Battlefield Essentials</span></p>

    <div class="crisis">
      <p><strong style="color:#CC9029;">&#9877; IMPORTANT</strong></p>
      <p>This manual is not crisis intervention. If you are in immediate danger, call the Veterans Crisis Line: dial 988 and press 1, or text 838255.</p>
    </div>
  </div>
  <div class="footer">
    <p>Battlefield Essentials &nbsp;|&nbsp; battlefieldessentials.com</p>
    <p>support@battlefieldessentials.com</p>
    <p>You purchased The Nervous System Field Manual. This is your order confirmation and delivery email.</p>
    <p>Forged by Discipline.</p>
  </div>
</div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Your Manual is Ready — Download Here',
    html
  });

  console.log(`✓ Download email sent to ${email}`);
}

module.exports = { sendDownloadEmail, isConfigured };
