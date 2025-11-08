import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

// Email types (simplified - no attachments stored in Firestore)
export interface EmailAttachment {
  fileName: string
  fileSize: number
  fileType: string
  fileUrl: string
}

export interface Email {
  id?: string
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  reply_to?: string
  subject: string
  body: string
  attachments?: EmailAttachment[]
  templateId?: string
  reportId?: string
  status: "draft" | "sending" | "sent" | "failed"
  userId: string
  company_id?: string
  created?: Timestamp
  sent?: Timestamp
  error?: string
}

export interface EmailTemplate {
  id?: string
  name: string
  subject: string
  body: string
  userId: string
  company_id?: string
  template_type?: string
  deleted?: boolean
  created?: Timestamp
}

class EmailService {
  private emailsCollection = "emails"
  private templatesCollection = "email_templates"

  // Email CRUD operations
  async createEmail(emailData: Omit<Email, "id" | "created">): Promise<string> {
    try {
      // Clean undefined values
      const cleanEmailData = Object.fromEntries(Object.entries(emailData).filter(([_, value]) => value !== undefined))

      const docRef = await addDoc(collection(db, this.emailsCollection), {
        ...cleanEmailData,
        created: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      console.error("Error creating email:", error)
      throw new Error("Failed to create email")
    }
  }

  async getEmailById(emailId: string): Promise<Email | null> {
    try {
      const emailDoc = await getDoc(doc(db, this.emailsCollection, emailId))
      if (emailDoc.exists()) {
        return { id: emailDoc.id, ...emailDoc.data() } as Email
      }
      return null
    } catch (error) {
      console.error("Error getting email:", error)
      throw new Error("Failed to get email")
    }
  }

  async getEmails(userId?: string): Promise<Email[]> {
    try {
      let q = query(collection(db, this.emailsCollection), orderBy("created", "desc"))

      if (userId) {
        q = query(collection(db, this.emailsCollection), where("userId", "==", userId), orderBy("created", "desc"))
      }

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Email[]
    } catch (error) {
      console.error("Error getting emails:", error)
      throw new Error("Failed to get emails")
    }
  }

  async getEmailsByFilters(companyId: string, reportId?: string, emailType?: string): Promise<Email[]> {
    try {
      let q = query(collection(db, this.emailsCollection), where("company_id", "==", companyId), where("status", "==", "sent"), orderBy("created", "desc"))

      if (reportId) {
        q = query(collection(db, this.emailsCollection), where("company_id", "==", companyId), where("reportId", "==", reportId), where("status", "==", "sent"), orderBy("created", "desc"))
      }

      const querySnapshot = await getDocs(q)
      let emails = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Email[]

      // Filter by emailType if provided (e.g., based on template or other fields)
      if (emailType) {
        emails = emails.filter(email => email.templateId?.includes(emailType) || email.reportId)
      }

      return emails
    } catch (error) {
      console.error("Error getting emails by filters:", error)
      throw new Error("Failed to get emails")
    }
  }

  async updateEmail(emailId: string, updates: Partial<Email>): Promise<void> {
    try {
      // Clean undefined values
      const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, value]) => value !== undefined))

      await updateDoc(doc(db, this.emailsCollection, emailId), cleanUpdates)
    } catch (error) {
      console.error("Error updating email:", error)
      throw new Error("Failed to update email")
    }
  }

  async deleteEmail(emailId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.emailsCollection, emailId))
    } catch (error) {
      console.error("Error deleting email:", error)
      throw new Error("Failed to delete email")
    }
  }

  // Template CRUD operations
  async createEmailTemplate(templateData: Omit<EmailTemplate, "id" | "created">): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.templatesCollection), {
        ...templateData,
        created: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      console.error("Error creating email template:", error)
      throw new Error("Failed to create email template")
    }
  }

  async getEmailTemplates(companyId: string, templateType?: string): Promise<EmailTemplate[]> {
    try {
      let q = query(
        collection(db, this.templatesCollection),
        where("company_id", "==", companyId),
        where("deleted", "==", false),
        orderBy("created", "desc"),
      )

      if (templateType) {
        q = query(
          collection(db, this.templatesCollection),
          where("company_id", "==", companyId),
          where("template_type", "==", templateType),
          where("deleted", "==", false),
          orderBy("created", "desc"),
        )
      }

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as EmailTemplate[]
    } catch (error) {
      console.error("Error getting email templates:", error)
      throw new Error("Failed to get email templates")
    }
  }

  async updateEmailTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    try {
      await updateDoc(doc(db, this.templatesCollection, templateId), updates)

      // Return the updated template
      const updatedDoc = await getDoc(doc(db, this.templatesCollection, templateId))
      if (updatedDoc.exists()) {
        return { id: updatedDoc.id, ...updatedDoc.data() } as EmailTemplate
      }
      throw new Error("Template not found after update")
    } catch (error) {
      console.error("Error updating email template:", error)
      throw new Error("Failed to update email template")
    }
  }

  async deleteEmailTemplate(templateId: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.templatesCollection, templateId), { deleted: true })
    } catch (error) {
      console.error("Error deleting email template:", error)
      throw new Error("Failed to delete email template")
    }
  }

  async softDeleteEmailTemplate(templateId: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.templatesCollection, templateId), { deleted: true })
    } catch (error) {
      console.error("Error soft deleting email template:", error)
      throw new Error("Failed to soft delete email template")
    }
  }

  async createDefaultTemplates(companyId: string, templateType: string = "quotation"): Promise<void> {
    const defaultTemplates = [
      {
        name: templateType === "report" ? "Report Template 1" : "Cost Estimate Template 1",
        subject: templateType === "report" ? "Report: {title} - {companyName}" : "Cost Estimate: {title} - Boohk",
        body: templateType === "report" ?
          `Hi {clientName},

I hope you're doing well!

Please find attached the report for your project. The report includes the site details and project status based on our recent work.

If you have any questions or would like to discuss the findings, feel free to reach out to us. I'll be happy to assist you further.

Best regards,
{userName}
Sales Executive
{companyName}
{userContact}
{userEmail}` :
          `Hi {clientName},

I hope you're doing well!

Please find attached the quotation for your upcoming billboard campaign. The proposal includes the site location, duration, and pricing details based on our recent discussion.

If you have any questions or would like to explore other options, feel free to reach out. I'll be happy to assist you further. Looking forward to your feedback!

Best regards,
{userName}
Sales Executive
{companyName}
{userContact}
{userEmail}`,
        userId: "", // Will be set when called
        company_id: companyId,
        template_type: templateType,
        deleted: false,
      },
      {
        name: templateType === "report" ? "Report Template 2" : "Cost Estimate Template 2",
        subject: templateType === "report" ? "Follow-up: Report for {title}" : "Your Advertising Campaign Quote - {title}",
        body: templateType === "report" ?
          `Dear {clientName},

I wanted to follow up on the report we sent for {title}.

I hope you've had a chance to review the attached report. We're very interested in your feedback and are available to discuss the findings in detail.

If you have any questions about our assessment, recommendations, or next steps, I'd be happy to schedule a call to discuss them in detail.

We're also available to provide additional support or clarification as needed.

Please let me know your thoughts or if you need any additional information.

Best regards,
{userName}
Sales Executive
{companyName}
{userContact}
{userEmail}` :
          `Dear {clientName},

Thank you for your interest in our advertising services. We are pleased to provide you with a detailed cost estimate for your campaign.

Please review the attached quotation and let us know if you have any questions or require any modifications.

We look forward to working with you!

Best regards,
{userName}
{companyName}`,
        userId: "", // Will be set when called
        company_id: companyId,
        template_type: templateType,
        deleted: false,
      },
    ]

    try {
      for (const template of defaultTemplates) {
        await this.createEmailTemplate(template)
      }
    } catch (error) {
      console.error("Error creating default templates:", error)
      throw new Error("Failed to create default templates")
    }
  }
}

export const emailService = new EmailService()
