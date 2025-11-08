import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const {
      recipientEmail,
      recipientName,
      subject,
      message,
      invitationCode,
      registrationUrl,
      senderName,
      companyName,
      role,
      expiresAt,
    } = await request.json()

    // Validate required fields
    if (!recipientEmail || !invitationCode || !registrationUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to Join ${companyName || "Our Organization"}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e1e5e9;
              border-top: none;
            }
            .code-box {
              background: #f8f9fa;
              border: 2px dashed #dee2e6;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
            }
            .code {
              font-family: 'Courier New', monospace;
              font-size: 24px;
              font-weight: bold;
              color: #495057;
              letter-spacing: 2px;
            }
            .button {
              display: inline-block;
              background: #007bff;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              margin: 20px 0;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin: 20px 0;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-weight: 600;
              color: #6c757d;
              font-size: 14px;
              margin-bottom: 4px;
            }
            .info-value {
              color: #495057;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px 30px;
              border: 1px solid #e1e5e9;
              border-top: none;
              border-radius: 0 0 8px 8px;
              text-align: center;
              color: #6c757d;
              font-size: 14px;
            }
            .role-badge {
              display: inline-block;
              background: #e9ecef;
              color: #495057;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 You're Invited!</h1>
            <p>Join ${companyName || "our organization"} and start collaborating</p>
          </div>
          
          <div class="content">
            <p>Hello ${recipientName || "there"},</p>
            
            <p>${message}</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; font-weight: 600;">Your invitation code:</p>
              <div class="code">${invitationCode}</div>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #6c757d;">
                Copy this code and use it during registration
              </p>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Assigned Role</span>
                <span class="info-value">
                  <span class="role-badge">${role}</span>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Valid Until</span>
                <span class="info-value">${expiresAt}</span>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${registrationUrl}" class="button">
                Register Your Account
              </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>📋 Registration Instructions:</strong><br>
                1. Click the button above or visit: <code>${registrationUrl}</code><br>
                2. Fill out the registration form<br>
                3. Your invitation code will be automatically applied<br>
                4. Complete your profile setup
              </p>
            </div>
            
            <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
            
            <p>
              Best regards,<br>
              <strong>${senderName}</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>This invitation was sent by ${senderName} from ${companyName || "OH Plus"}.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `

    // Create plain text version
    const textContent = `
You're invited to join ${companyName || "our organization"}!

Hello ${recipientName || "there"},

${message}

Your invitation code: ${invitationCode}

Role: ${role}
Valid until: ${expiresAt}

To register your account, visit: ${registrationUrl}

Registration Instructions:
1. Visit the registration link above
2. Fill out the registration form
3. Your invitation code will be automatically applied
4. Complete your profile setup

If you have any questions or need assistance, please don't hesitate to reach out.

Best regards,
${senderName}

---
This invitation was sent by ${senderName} from ${companyName || "OH Plus"}.
If you didn't expect this invitation, you can safely ignore this email.
    `

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: `${senderName} <noreply@ohplus.ph>`,
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
      text: textContent,
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
    })
  } catch (error) {
    console.error("Email sending error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
