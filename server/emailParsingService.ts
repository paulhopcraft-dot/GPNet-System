import { InsertExternalEmail, InsertEmailAttachment } from "@shared/schema";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs/promises";

export interface ParsedEmail {
  // Basic email data
  messageId: string;
  subject: string;
  body: string;
  htmlBody?: string;
  
  // Original sender info (before forwarding)
  originalSender: string;
  originalSenderName?: string;
  originalRecipient?: string;
  originalSubject?: string;
  originalDate?: Date;
  
  // Forwarding info
  forwardedBy: string;
  forwardedAt: Date;
  
  // Attachments
  attachments: ParsedAttachment[];
  
  // Extracted entities
  extractedEntities: {
    workerNames: string[];
    providerNames: string[];
    medicalTerms: string[];
    dates: string[];
    phoneNumbers: string[];
    emails: string[];
    claimNumbers: string[];
    injuries: string[];
  };
  
  // Thread context
  threadHistory?: any[];
}

export interface ParsedAttachment {
  originalFilename: string;
  filename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  content?: Buffer;
}

export interface RawEmailData {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  date: Date;
  attachments?: RawAttachment[];
  headers?: Record<string, string>;
}

export interface RawAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export class EmailParsingService {
  private attachmentPath = "attachments/emails";
  
  constructor() {
    this.ensureAttachmentDirectory();
  }
  
  private async ensureAttachmentDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.attachmentPath, { recursive: true });
    } catch (error) {
      console.error("Failed to create attachment directory:", error);
    }
  }
  
  /**
   * Parse a raw email into structured data for case matching
   */
  async parseEmail(rawEmail: RawEmailData, organizationId: string): Promise<ParsedEmail> {
    try {
      // Determine if this is a forwarded email
      const forwardContext = this.extractForwardContext(rawEmail);
      
      // Extract entities from email content
      const extractedEntities = this.extractEntities(rawEmail.body, rawEmail.subject);
      
      // Process attachments
      const attachments = await this.processAttachments(rawEmail.attachments || []);
      
      // Detect thread history
      const threadHistory = this.extractThreadHistory(rawEmail.body, rawEmail.htmlBody);
      
      const parsedEmail: ParsedEmail = {
        messageId: rawEmail.messageId,
        subject: rawEmail.subject,
        body: rawEmail.body,
        htmlBody: rawEmail.htmlBody,
        
        originalSender: forwardContext.originalSender || rawEmail.from,
        originalSenderName: forwardContext.originalSenderName,
        originalRecipient: forwardContext.originalRecipient,
        originalSubject: forwardContext.originalSubject || rawEmail.subject,
        originalDate: forwardContext.originalDate || rawEmail.date,
        
        forwardedBy: forwardContext.forwardedBy || rawEmail.from,
        forwardedAt: rawEmail.date,
        
        attachments,
        extractedEntities,
        threadHistory,
      };
      
      return parsedEmail;
    } catch (error) {
      console.error("Email parsing failed:", error);
      throw new Error(`Failed to parse email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract forwarding context from email headers and body
   */
  private extractForwardContext(rawEmail: RawEmailData): {
    originalSender?: string;
    originalSenderName?: string;
    originalRecipient?: string;
    originalSubject?: string;
    originalDate?: Date;
    forwardedBy?: string;
  } {
    const body = rawEmail.body;
    const subject = rawEmail.subject;
    
    // Check if subject indicates forwarding
    const isFwd = /^(fw|fwd|forward):/i.test(subject) || /forwarded message/i.test(body);
    
    if (!isFwd) {
      return {
        forwardedBy: rawEmail.from,
      };
    }
    
    // Extract original message info from forwarded email patterns
    const forwardPatterns = [
      // Outlook format
      /from:\s*([^\r\n]+)[\r\n][\s\S]*?sent:\s*([^\r\n]+)[\r\n][\s\S]*?to:\s*([^\r\n]+)[\r\n][\s\S]*?subject:\s*([^\r\n]+)/i,
      // Gmail format
      /---------- forwarded message ----------[\s\S]*?from:\s*([^\r\n]+)[\s\S]*?date:\s*([^\r\n]+)[\s\S]*?subject:\s*([^\r\n]+)[\s\S]*?to:\s*([^\r\n]+)/i,
      // Apple Mail format
      /begin forwarded message:[\s\S]*?from:\s*([^\r\n]+)[\s\S]*?subject:\s*([^\r\n]+)[\s\S]*?date:\s*([^\r\n]+)[\s\S]*?to:\s*([^\r\n]+)/i,
    ];
    
    for (const pattern of forwardPatterns) {
      const match = body.match(pattern);
      if (match) {
        return {
          originalSender: this.extractEmail(match[1]),
          originalSenderName: this.extractName(match[1]),
          originalDate: this.parseDate(match[2]),
          originalRecipient: this.extractEmail(match[3]),
          originalSubject: match[4]?.trim(),
          forwardedBy: rawEmail.from,
        };
      }
    }
    
    // Fallback: try to extract from subject
    const subjectMatch = subject.match(/^(fw|fwd|forward):\s*(.+)/i);
    return {
      originalSubject: subjectMatch?.[2]?.trim() || subject,
      forwardedBy: rawEmail.from,
    };
  }
  
  /**
   * Extract relevant entities from email text
   */
  private extractEntities(body: string, subject: string): ParsedEmail['extractedEntities'] {
    const text = `${subject} ${body}`.toLowerCase();
    
    return {
      workerNames: this.extractWorkerNames(text),
      providerNames: this.extractProviderNames(text),
      medicalTerms: this.extractMedicalTerms(text),
      dates: this.extractDates(text),
      phoneNumbers: this.extractPhoneNumbers(text),
      emails: this.extractEmails(text),
      claimNumbers: this.extractClaimNumbers(text),
      injuries: this.extractInjuries(text),
    };
  }
  
  /**
   * Extract worker names using common patterns
   */
  private extractWorkerNames(text: string): string[] {
    const names: string[] = [];
    
    // Common patterns for worker names
    const patterns = [
      /(?:worker|employee|staff|patient|client):\s*([a-z]+\s+[a-z]+)/g,
      /(?:name|employee):\s*([a-z]+(?:\s+[a-z]+)+)/g,
      /mr\.?\s+([a-z]+\s+[a-z]+)/g,
      /ms\.?\s+([a-z]+\s+[a-z]+)/g,
      /mrs\.?\s+([a-z]+\s+[a-z]+)/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 3) {
          names.push(this.capitalize(match[1].trim()));
        }
      }
    }
    
    return Array.from(new Set(names));
  }
  
  /**
   * Extract medical provider names
   */
  private extractProviderNames(text: string): string[] {
    const providers: string[] = [];
    
    const patterns = [
      /(?:dr\.?|doctor|physician)\s+([a-z]+(?:\s+[a-z]+)*)/g,
      /(?:physiotherapist|psychologist|specialist):\s*([a-z]+\s+[a-z]+)/g,
      /(?:clinic|medical centre|hospital):\s*([a-z\s&]+)/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 2) {
          providers.push(this.capitalize(match[1].trim()));
        }
      }
    }
    
    return Array.from(new Set(providers));
  }
  
  /**
   * Extract medical terms and conditions
   */
  private extractMedicalTerms(text: string): string[] {
    const medicalTerms = [
      'back pain', 'neck pain', 'shoulder injury', 'knee injury', 'ankle injury',
      'fracture', 'sprain', 'strain', 'concussion', 'whiplash', 'hernia',
      'carpal tunnel', 'repetitive strain', 'stress', 'anxiety', 'depression',
      'surgery', 'physiotherapy', 'rehabilitation', 'mri', 'x-ray', 'ct scan',
      'medical certificate', 'fitness for work', 'return to work', 'light duties',
      'work capacity', 'restrictions', 'lifting', 'bending', 'sitting', 'standing'
    ];
    
    return medicalTerms.filter(term => text.includes(term));
  }
  
  /**
   * Extract dates from text
   */
  private extractDates(text: string): string[] {
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/g,
      /\d{1,2}-\d{1,2}-\d{4}/g,
      /\d{4}-\d{1,2}-\d{1,2}/g,
      /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}/g,
    ];
    
    const dates: string[] = [];
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    }
    
    return [...new Set(dates)];
  }
  
  /**
   * Extract phone numbers
   */
  private extractPhoneNumbers(text: string): string[] {
    const phonePattern = /(?:\+?61|0)[2-9]\d{8}|\(\d{2}\)\s?\d{4}\s?\d{4}/g;
    return text.match(phonePattern) || [];
  }
  
  /**
   * Extract email addresses
   */
  private extractEmails(text: string): string[] {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(emailPattern) || [];
  }
  
  /**
   * Extract claim or reference numbers
   */
  private extractClaimNumbers(text: string): string[] {
    const patterns = [
      /claim\s*#?\s*(\w+)/g,
      /reference\s*#?\s*(\w+)/g,
      /case\s*#?\s*(\w+)/g,
      /wc\s*#?\s*(\w+)/g,
    ];
    
    const numbers: string[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          numbers.push(match[1]);
        }
      }
    }
    
    return Array.from(new Set(numbers));
  }
  
  /**
   * Extract injury types and body parts
   */
  private extractInjuries(text: string): string[] {
    const injuryTerms = [
      'back', 'neck', 'shoulder', 'arm', 'wrist', 'hand', 'finger',
      'chest', 'ribs', 'hip', 'leg', 'knee', 'ankle', 'foot', 'toe',
      'head', 'face', 'eye', 'ear', 'nose', 'jaw',
      'psychological', 'mental', 'stress', 'anxiety', 'depression'
    ];
    
    return injuryTerms.filter(term => text.includes(term));
  }
  
  /**
   * Process email attachments
   */
  private async processAttachments(rawAttachments: RawAttachment[]): Promise<ParsedAttachment[]> {
    const processedAttachments: ParsedAttachment[] = [];
    
    for (const attachment of rawAttachments) {
      try {
        const filename = `${nanoid()}_${this.sanitizeFilename(attachment.filename)}`;
        const filePath = path.join(this.attachmentPath, filename);
        
        // Save attachment to filesystem
        await fs.writeFile(filePath, attachment.content);
        
        processedAttachments.push({
          originalFilename: attachment.filename,
          filename,
          filePath,
          fileSize: attachment.content.length,
          mimeType: attachment.contentType,
          content: attachment.content,
        });
      } catch (error) {
        console.error(`Failed to process attachment ${attachment.filename}:`, error);
      }
    }
    
    return processedAttachments;
  }
  
  /**
   * Extract thread/conversation history from email body
   */
  private extractThreadHistory(body: string, htmlBody?: string): any[] {
    // Look for quoted text patterns
    const threadMarkers = [
      /^>.*/gm, // Quoted lines starting with >
      /^On .* wrote:$/gm, // Outlook/Gmail thread markers
      /^From:[\s\S]*?Subject:[\s\S]*?\n\n/gm, // Full header quotes
    ];
    
    const threads: any[] = [];
    
    // Extract quoted sections
    for (const marker of threadMarkers) {
      const matches = body.match(marker);
      if (matches) {
        threads.push(...matches.map(match => ({
          content: match.trim(),
          type: 'quoted_text'
        })));
      }
    }
    
    return threads;
  }
  
  /**
   * Convert parsed email to database insert format
   */
  convertToInsertFormat(
    parsedEmail: ParsedEmail, 
    organizationId: string,
    ticketId?: string
  ): InsertExternalEmail {
    return {
      ticketId,
      organizationId,
      messageId: parsedEmail.messageId,
      forwardedBy: parsedEmail.forwardedBy,
      originalSender: parsedEmail.originalSender,
      originalSenderName: parsedEmail.originalSenderName,
      originalRecipient: parsedEmail.originalRecipient,
      originalSubject: parsedEmail.originalSubject,
      originalDate: parsedEmail.originalDate,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      htmlBody: parsedEmail.htmlBody,
      threadHistory: parsedEmail.threadHistory,
      extractedEntities: parsedEmail.extractedEntities,
      processingStatus: "pending",
    };
  }
  
  /**
   * Convert parsed attachments to database insert format
   */
  convertAttachmentsToInsertFormat(
    attachments: ParsedAttachment[],
    externalEmailId: string,
    ticketId?: string
  ): InsertEmailAttachment[] {
    return attachments.map(attachment => ({
      externalEmailId,
      ticketId,
      filename: attachment.filename,
      originalFilename: attachment.originalFilename,
      filePath: attachment.filePath,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      isProcessed: false,
    }));
  }
  
  // Utility methods
  private extractEmail(text: string): string {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return emailMatch?.[1] || text.trim();
  }
  
  private extractName(text: string): string | undefined {
    // Extract name from "Name <email>" format
    const nameMatch = text.match(/^([^<]+)\s*</);
    return nameMatch?.[1]?.trim();
  }
  
  private parseDate(dateStr: string): Date | undefined {
    try {
      return new Date(dateStr.trim());
    } catch {
      return undefined;
    }
  }
  
  private capitalize(text: string): string {
    return text.replace(/\b\w/g, char => char.toUpperCase());
  }
  
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
}

export const emailParsingService = new EmailParsingService();