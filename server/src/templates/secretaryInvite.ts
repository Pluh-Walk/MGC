/**
 * HTML email template for secretary invitations.
 */
export const secretaryInviteEmail = (attorneyName: string, inviteLink: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #1a365d; margin: 0; font-size: 24px; }
    .content { color: #333; line-height: 1.6; }
    .button { display: inline-block; background: #2b6cb0; color: #fff; text-decoration: none;
              padding: 12px 30px; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MGC Law System</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Attorney <strong>${attorneyName}</strong> has invited you to join the MGC Law System as their secretary.</p>
      <p>As a secretary, you will be able to:</p>
      <ul>
        <li>View and update assigned case information</li>
        <li>Manage hearings and schedules</li>
        <li>Upload legal documents</li>
        <li>Communicate with clients on behalf of your attorney</li>
      </ul>
      <p>Click the button below to create your account. This invitation expires in 48 hours.</p>
      <p style="text-align: center;">
        <a href="${inviteLink}" class="button">Accept Invitation</a>
      </p>
      <p style="font-size: 13px; color: #666;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${inviteLink}
      </p>
    </div>
    <div class="footer">
      <p>This email was sent by MGC Law System. If you did not expect this invitation, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
`
