import OpenAI from "openai";
import type { OcrFieldExtraction } from "@shared/schema";

// Create OpenAI client for text extraction using the same key discovery logic
function createOpenAIClient(): OpenAI | null {
  const possibleKeys = [
    process.env.OPENAI_API_KEY,
    process.env.GPNET_OPENAI,
    process.env.MICHELLE_OPENAI_KEY,
    process.env.GPT_API_KEY,
    process.env.AI_API_KEY,
    process.env.OPENAI_KEY, 
    process.env.REPLIT_OPENAI_API_KEY
  ].filter(Boolean);

  for (const key of possibleKeys) {
    if (key && key.startsWith('sk-') && !key.includes('youtube') && !key.includes('https://')) {
      return new OpenAI({ apiKey: key });
    }
  }

  console.warn('⚠️ OCRService: No valid OpenAI key found - OCR will be disabled');
  return null;
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = createOpenAIClient();

export interface DocumentClassificationResult {
  kind: "medical_certificate" | "diagnosis_report" | "fit_note" | "specialist_letter" | "radiology_report" | "other";
  confidence: number;
  reasoning: string;
}

export interface OcrResult {
  extractedFields: OcrFieldExtraction;
  classification: DocumentClassificationResult;
  processingTime: number;
  success: boolean;
  error?: string;
}

export class OcrService {
  private static readonly MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
  private static readonly SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'application/pdf'];

  /**
   * Extract medical data from document image using OpenAI Vision
   */
  async extractMedicalData(
    documentBuffer: Buffer,
    contentType: string,
    filename: string
  ): Promise<OcrResult> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!this.isValidDocumentFormat(contentType)) {
        throw new Error(`Unsupported file format: ${contentType}`);
      }

      if (documentBuffer.length > OcrService.MAX_IMAGE_SIZE) {
        throw new Error(`File too large: ${documentBuffer.length} bytes. Maximum: ${OcrService.MAX_IMAGE_SIZE} bytes`);
      }

      // Handle PDF conversion to image
      let imageBuffer: Buffer;
      let imageContentType: string;
      
      if (contentType === 'application/pdf') {
        const converted = await this.convertPdfToImage(documentBuffer);
        imageBuffer = converted.buffer;
        imageContentType = converted.contentType;
      } else {
        imageBuffer = documentBuffer;
        imageContentType = contentType;
      }

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');

      // Perform document classification, field extraction, and text extraction in parallel
      const [classification, extraction, fullText] = await Promise.all([
        this.classifyDocument(base64Image, filename, imageContentType),
        this.extractFields(base64Image, imageContentType),
        this.extractFullText(base64Image, imageContentType)
      ]);

      // Add the extracted text to the extraction result
      extraction.extractedText = fullText;

      const processingTime = Date.now() - startTime;

      return {
        extractedFields: extraction,
        classification,
        processingTime,
        success: true
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('OCR processing failed:', error);
      
      return {
        extractedFields: { confidence: 0 },
        classification: { kind: "other", confidence: 0, reasoning: "Processing failed" },
        processingTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert PDF to high-quality image for OCR processing
   */
  private async convertPdfToImage(pdfBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      console.log('Starting PDF to image conversion for OCR processing');
      
      // Import required modules
      const fs = await import('fs/promises');
      const path = await import('path');
      const crypto = await import('crypto');
      
      // Generate unique temporary file names
      const tempId = crypto.randomUUID();
      const tempPdfPath = path.join('/tmp', `input_${tempId}.pdf`);
      const outputPrefix = `output_${tempId}`;
      
      try {
        // Write PDF buffer to temporary file (pdf-poppler requires file path)
        await fs.writeFile(tempPdfPath, pdfBuffer);
        
        // Use direct shell command with installed poppler utilities
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);
        
        // Convert PDF to image using pdftoppm command
        console.log(`Converting PDF using pdftoppm command: ${tempPdfPath}`);
        const command = `pdftoppm -png -f 1 -l 1 -r 300 "${tempPdfPath}" "${tempPdfPath.replace('.pdf', '')}"`;
        
        await execPromise(command);
        
        // pdftoppm outputs as: filename-1.png
        const imagePath = `${tempPdfPath.replace('.pdf', '')}-1.png`;
        
        // Verify the converted image file exists
        try {
          await fs.access(imagePath);
        } catch (error) {
          throw new Error('PDF conversion did not produce expected output file');
        }
        const imageBuffer = await fs.readFile(imagePath);
        
        // Post-conversion size guard (high DPI PNG can be very large)
        if (imageBuffer.length > OcrService.MAX_IMAGE_SIZE) {
          throw new Error(`Converted image too large: ${imageBuffer.length} bytes. Maximum: ${OcrService.MAX_IMAGE_SIZE} bytes`);
        }
        
        console.log(`PDF successfully converted to PNG image: ${imageBuffer.length} bytes`);
        
        return {
          buffer: imageBuffer,
          contentType: 'image/png'
        };
        
      } finally {
        // Clean up temporary files regardless of success/failure
        try {
          await fs.unlink(tempPdfPath);
          // Clean up the image file generated by pdftoppm
          const generatedImagePath = `${tempPdfPath.replace('.pdf', '')}-1.png`;
          await fs.unlink(generatedImagePath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary files:', cleanupError);
        }
      }
      
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      
      // Check if error is due to missing poppler utilities
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('poppler') || errorMessage.includes('pdftoppm')) {
        console.warn('Poppler utilities not available. Install poppler-utils for PDF conversion support.');
      }
      
      // Fallback to direct PDF processing with OpenAI Vision
      console.warn('Falling back to direct PDF processing - OCR accuracy may be reduced');
      
      return {
        buffer: pdfBuffer,
        contentType: 'application/pdf'
      };
    }
  }

  /**
   * Classify document type using OpenAI Vision
   */
  private async classifyDocument(base64Image: string, filename: string, contentType: string): Promise<DocumentClassificationResult> {
    const prompt = `Analyze this medical document image and classify it. 

    Look for these document types:
    - medical_certificate: Work capacity certificates, fitness for work certificates
    - diagnosis_report: Medical diagnosis reports, assessment summaries
    - fit_note: Sick notes, fitness notes, return to work notes
    - specialist_letter: Letters from specialists (cardiologist, orthopedist, etc.)
    - radiology_report: X-ray, MRI, CT scan reports
    - other: Any other medical document

    Consider the document layout, headers, common phrases, and medical terminology.
    Filename: ${filename}

    Respond with JSON in this format:
    {
      "kind": "document_type",
      "confidence": 85,
      "reasoning": "Brief explanation of classification decision"
    }`;

    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${contentType};base64,${base64Image}` }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      kind: result.kind || "other",
      confidence: Math.max(0, Math.min(100, result.confidence || 0)),
      reasoning: result.reasoning || "Classification completed"
    };
  }

  /**
   * Extract full text content from document using OpenAI Vision
   */
  private async extractFullText(base64Image: string, contentType: string): Promise<string> {
    const prompt = `Extract ALL text content from this medical document image. 

    Instructions:
    - Read and transcribe every word, number, and text element visible in the document
    - Maintain the logical reading order (top to bottom, left to right)
    - Preserve line breaks and paragraph structure where meaningful
    - Include headers, body text, signatures, dates, and any other text
    - Do not interpret or summarize - provide complete literal transcription
    - If text is unclear or partially obscured, make your best attempt
    - Return only the extracted text, no additional formatting or commentary

    Focus on accuracy and completeness of the text extraction.`;

    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${contentType};base64,${base64Image}` }
            }
          ]
        }
      ],
      max_completion_tokens: 3000
    });

    const extractedText = response.choices[0].message.content || '';
    
    // Clean and normalize the extracted text
    return this.cleanExtractedText(extractedText);
  }

  /**
   * Extract medical fields from document using OpenAI Vision
   */
  private async extractFields(base64Image: string, contentType: string): Promise<OcrFieldExtraction> {
    const prompt = `Extract medical information from this document image. Focus on work capacity and medical certificate data.

    Extract these fields if present (return null/empty for missing fields):

    Core Fields:
    - patientName: Full name of the patient/worker
    - doctorName: Name of the treating doctor/physician
    - providerNo: Medical provider number if shown
    - clinicName: Name of medical practice/clinic
    - clinicPhone: Contact phone number
    - issueDate: Date certificate was issued (YYYY-MM-DD format)
    - diagnosis: Medical diagnosis or condition description
    - restrictions: Work restrictions or limitations described
    - fitStatus: Choose one: "fit_unrestricted", "fit_with_restrictions", or "unfit"
    - validFrom: Certificate valid from date (YYYY-MM-DD format)
    - validTo: Certificate valid until date (YYYY-MM-DD format)
    - reviewOn: Next review date if specified (YYYY-MM-DD format)
    - capacityNotes: Details about work capacity (lifting limits, hours, duties)
    - signatory: Name/title of person who signed
    - signaturePresent: true if signature is visible

    Additional Fields (for specialist reports):
    - icdCodes: Array of ICD-10 codes if present
    - investigations: Tests, scans, or examinations mentioned
    - treatmentPlan: Prescribed treatment or management plan
    - followUpInterval: When to follow up (e.g., "2 weeks", "3 months")
    - redFlags: Warning signs or urgent symptoms to watch for

    Confidence Scoring:
    - confidence: Overall confidence score 0-100 for the extraction
    - fieldConfidences: Individual confidence scores for each extracted field

    Fit Status Logic:
    - "unfit" if document says unfit for work, not fit for duties, unable to work
    - "fit_with_restrictions" if mentions modified duties, restrictions, limitations
    - "fit_unrestricted" if cleared for full/normal duties without restrictions

    Date Handling:
    - Convert relative dates like "1 week from issue" to actual dates
    - Use YYYY-MM-DD format consistently
    - If only partial dates given, use best interpretation

    Respond with JSON in the exact format shown below:
    {
      "patientName": "John Smith",
      "doctorName": "Dr. Sarah Johnson",
      "providerNo": "123456",
      "clinicName": "City Medical Centre",
      "clinicPhone": "03 9876 5432",
      "issueDate": "2024-01-15",
      "diagnosis": "Lower back strain",
      "restrictions": "No lifting over 15kg, no prolonged standing",
      "fitStatus": "fit_with_restrictions",
      "validFrom": "2024-01-15",
      "validTo": "2024-02-15",
      "reviewOn": "2024-02-15",
      "capacityNotes": "Light duties only, 6 hour days maximum",
      "signatory": "Dr. Sarah Johnson - General Practitioner",
      "signaturePresent": true,
      "icdCodes": ["M54.5"],
      "investigations": "X-ray lumbar spine",
      "treatmentPlan": "Physiotherapy, anti-inflammatory medication",
      "followUpInterval": "4 weeks",
      "redFlags": "Severe pain or numbness in legs",
      "confidence": 85,
      "fieldConfidences": {
        "patientName": 95,
        "doctorName": 90,
        "diagnosis": 85,
        "fitStatus": 90
      }
    }`;

    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${contentType};base64,${base64Image}` }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Normalize and validate the result
    return this.normalizeExtractedFields(result);
  }

  /**
   * Normalize and validate extracted field data
   */
  private normalizeExtractedFields(rawData: any): OcrFieldExtraction {
    const normalized: OcrFieldExtraction = {
      confidence: Math.max(0, Math.min(100, rawData.confidence || 0))
    };

    // Normalize text fields
    const textFields = [
      'patientName', 'doctorName', 'providerNo', 'clinicName', 'clinicPhone',
      'diagnosis', 'restrictions', 'capacityNotes', 'signatory',
      'investigations', 'treatmentPlan', 'followUpInterval', 'redFlags'
    ];

    textFields.forEach(field => {
      if (rawData[field] && typeof rawData[field] === 'string') {
        (normalized as any)[field] = this.cleanTextValue(rawData[field]);
      }
    });

    // Normalize date fields
    const dateFields = ['issueDate', 'validFrom', 'validTo', 'reviewOn'];
    dateFields.forEach(field => {
      if (rawData[field]) {
        (normalized as any)[field] = this.normalizeDateValue(rawData[field]);
      }
    });

    // Normalize fit status
    if (rawData.fitStatus) {
      const fitStatus = rawData.fitStatus.toLowerCase();
      if (['fit_unrestricted', 'fit_with_restrictions', 'unfit'].includes(fitStatus)) {
        normalized.fitStatus = fitStatus as any;
      }
    }

    // Handle boolean fields
    if (typeof rawData.signaturePresent === 'boolean') {
      normalized.signaturePresent = rawData.signaturePresent;
    }

    // Handle arrays
    if (Array.isArray(rawData.icdCodes)) {
      normalized.icdCodes = rawData.icdCodes.filter((code: any) => typeof code === 'string');
    }

    // Handle field confidences
    if (rawData.fieldConfidences && typeof rawData.fieldConfidences === 'object') {
      normalized.fieldConfidences = {};
      Object.keys(rawData.fieldConfidences).forEach(field => {
        const confidence = rawData.fieldConfidences[field];
        if (typeof confidence === 'number') {
          normalized.fieldConfidences![field] = Math.max(0, Math.min(100, confidence));
        }
      });
    }

    return normalized;
  }

  /**
   * Clean and normalize text values
   */
  private cleanTextValue(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\x20-\x7E\u00A0-\u024F]/g, '') // Remove special characters but keep accented letters
      .substring(0, 1000); // Limit length
  }

  /**
   * Clean and normalize extracted text content
   */
  private cleanExtractedText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive blank lines
      .substring(0, 10000); // Limit length for embedding
  }

  /**
   * Normalize date values to YYYY-MM-DD format
   */
  private normalizeDateValue(dateValue: string): string {
    // Try to parse various date formats
    const cleanDate = dateValue.trim().replace(/[^\d\-\/\.]/g, '');
    
    try {
      const date = new Date(cleanDate);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('Failed to parse date:', dateValue);
    }

    return dateValue; // Return original if parsing fails
  }

  /**
   * Check if the file format is supported for OCR
   */
  private isValidDocumentFormat(contentType: string): boolean {
    return OcrService.SUPPORTED_FORMATS.includes(contentType.toLowerCase());
  }

  /**
   * Get service status and capabilities
   */
  static getServiceInfo() {
    return {
      serviceName: 'OpenAI Vision OCR Service',
      supportedFormats: OcrService.SUPPORTED_FORMATS,
      maxFileSize: OcrService.MAX_IMAGE_SIZE,
      capabilities: [
        'Medical certificate field extraction',
        'Document type classification', 
        'Fit status determination',
        'Date normalization',
        'Confidence scoring'
      ],
      isAvailable: !!process.env.OPENAI_API_KEY
    };
  }
}

// Export singleton instance
export const ocrService = new OcrService();