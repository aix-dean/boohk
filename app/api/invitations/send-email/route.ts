import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

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
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Invitation to Join ${companyName || "Boohk"}</title>
        </head>
        <body style="margin: 0; padding: 40px 20px; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif; font-size: 16px; line-height: 1.5; color: #202124;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
              <td style="padding: 48px 24px 0;">
                <h1 style="font-size: 32px; font-weight: 400; margin: 0 0 8px 0; color: #202124; line-height: 1.2;">You've been invited</h1>
                <p style="font-size: 18px; margin: 0 0 32px 0; color: #5f6368;">Join <strong>${companyName || "Boohk"}</strong> as <strong>${role}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 24px 32px;">
                <p style="font-size: 16px; margin: 0 0 24px 0; color: #202124;">Hi ${recipientName || "there"},</p>
                <p style="font-size: 16px; margin: 0 0 40px 0; color: #202124;">${message}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 24px 40px; text-align: center;">
                              <a href="${registrationUrl}" style="display: inline-block; background-color: #4285f4; color: #ffffff !important; padding: 14px 28px; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 4px; line-height: 1.2;">Register now</a>

                <p style="font-size: 14px; margin: 0 0 32px 0; color: #5f6368; padding-top: 10px;">Valid until ${expiresAt}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 24px 48px; text-align: center; font-size: 14px; color: #5f6368; border-top: 1px solid #dadce0;">
                <p style="margin: 16px 0 0 0;">Best,<br><strong>${senderName}</strong></p>
                <p style="margin: 24px 0 0 0;">Sent from ${companyName || "Boohk"}.<br>If you didn't expect this invitation, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    // Create plain text version
    const textContent = `
You're invited to join ${companyName || "our organization"}!

Hello ${recipientName || "there"},

${message}

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
This invitation was sent by ${senderName} from ${companyName || "Boohk"}.
If you didn't expect this invitation, you can safely ignore this email.
    `

    // Initialize Resend only when needed and API key is available
    console.log("=== INVITATIONS SEND EMAIL DEBUG ===");
    console.log("RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);
    console.log("RESEND_API_KEY length:", process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.length : 0);
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("=== END DEBUG ===");
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error("RESEND_API_KEY environment variable is not set")
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }

    const resend = new Resend(apiKey)

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