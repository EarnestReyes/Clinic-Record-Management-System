const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function welcomeEmailTemplate(user, loginUrl, setupLink) {
  const role = user.role === 'Clinic Staff' ? 'Medical Personnel' : user.role;
  const greeting = `Dear ${user.name},`;
  const introduction = 'Welcome to the Careline team. Your account has been created to help you securely coordinate care and support our clinic\'s patients.';
  const instructions = setupLink ? 'Please set up your password to activate access to your workspace. This link expires in 15 minutes and can be used only once. If it expires or fails, contact your administrator for a new invitation.' : 'Use the credentials provided securely by your administrator to sign in to your workspace.';
  const text = `Careline\nCLINIC RECORD MANAGEMENT SYSTEM\n\nWelcome to Careline!\n\n${greeting}\n\n${introduction}\n\nStaff email: ${user.email}${role ? `\nAssigned role: ${role}` : ''}\n\n${instructions}\n\n${setupLink ? `Set Up Your Password:\n${setupLink}\n\n` : ''}Login: ${loginUrl}\nChange your password later through Account Settings → Change Password.\n\nWarm regards,\nThe Careline Team\n\nSecurity notice: Never share your credentials or password setup link. If you were not expecting this invitation, contact your clinic administrator.\n\nCareline Family Health Clinic`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to Careline</title></head>
<body style="margin:0;padding:0;background-color:#f3f7fc;color:#25364a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f7fc" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dce6f2;border-radius:16px;border-spacing:0;">
<tr><td bgcolor="#eaf3ff" style="padding:28px 24px;background-color:#eaf3ff;border-radius:16px 16px 0 0;">
<p style="margin:0;color:#174478;font-size:30px;line-height:38px;font-weight:bold;letter-spacing:-1px;">Careline<span style="color:#2563eb;">.</span></p>
<p style="margin:6px 0 0;color:#506b89;font-size:11px;line-height:18px;font-weight:bold;letter-spacing:1.4px;">CLINIC RECORD MANAGEMENT SYSTEM</p></td></tr>
<tr><td style="padding:30px 24px 24px;font-size:16px;line-height:26px;">
<h1 style="margin:0 0 24px;color:#173b64;font-size:27px;line-height:34px;font-weight:bold;">Welcome to Careline!</h1>
<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 22px;">${escapeHtml(introduction)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7faff" style="width:100%;background-color:#f7faff;border:1px solid #e4edf8;border-radius:10px;"><tr><td style="padding:16px;font-size:14px;line-height:24px;word-break:break-word;">
<span style="color:#64748b;">Staff email</span><br><strong style="font-weight:bold;">${escapeHtml(user.email)}</strong>${role ? `<br><span style="color:#64748b;">Assigned role</span><br><strong style="font-weight:bold;">${escapeHtml(role)}</strong>` : ''}
</td></tr></table>
<p style="margin:22px 0 20px;">${setupLink ? 'Please set up your password to activate access to your workspace.' : escapeHtml(instructions)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td align="center" bgcolor="#2563eb" style="background-color:#2563eb;border:1px solid #2563eb;border-radius:8px;mso-padding-alt:14px 24px;">
<a href="${escapeHtml(setupLink || loginUrl)}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:16px;line-height:22px;font-weight:bold;text-decoration:none;border-radius:8px;">${setupLink ? 'Set Up Your Password' : 'Sign In to Careline'}</a>
</td></tr></table>
${setupLink ? '<p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:21px;">This link expires in <strong>15 minutes</strong> and can be used <strong>only once</strong>. If it expires or fails, contact your administrator for a new invitation.</p>' : ''}
<p style="margin:24px 0;color:#64748b;font-size:13px;line-height:21px;">After setup, <a href="${escapeHtml(loginUrl)}" style="color:#1d4ed8;text-decoration:underline;">sign in to Careline</a>. You can change your password later through Account Settings &rarr; Change Password.</p>
<p style="margin:0;">Warm regards,<br><strong style="color:#173b64;">The Careline Team</strong></p>
</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e8eef5;color:#64748b;font-size:12px;line-height:20px;">
<p style="margin:0;"><strong>Security notice:</strong> Never share your credentials or password setup link. If you were not expecting this invitation, contact your clinic administrator.</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="margin:16px 0 0;color:#7c8da1;font-size:11px;line-height:18px;">Careline Family Health Clinic</p>
</td></tr></table></body></html>`;
  return { to: user.email, subject: 'Welcome to Careline', text, html };
}
