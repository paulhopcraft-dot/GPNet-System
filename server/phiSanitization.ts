/**
 * PHI (Protected Health Information) Sanitization Utility
 * 
 * This module provides deterministic and verifiable redaction of sensitive
 * health information before sending data to external AI services.
 */

export interface SanitizationResult {
  sanitizedText: string;
  redactionCount: number;
  redactionTypes: string[];
}

export interface SanitizationConfig {
  preserveWordStructure: boolean;
  redactionMarker: string;
  enableLogging: boolean;
}

const DEFAULT_CONFIG: SanitizationConfig = {
  preserveWordStructure: true,
  redactionMarker: '[REDACTED]',
  enableLogging: false,
};

/**
 * Comprehensive PHI redaction patterns with confidence levels
 */
const PHI_PATTERNS = [
  // High confidence patterns
  {
    name: 'australian_phone',
    pattern: /(?:\+?61|0)[2-9]\d{8}|\(\d{2}\)\s?\d{4}\s?\d{4}/g,
    confidence: 'high',
    description: 'Australian phone numbers'
  },
  {
    name: 'email_address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 'high',
    description: 'Email addresses'
  },
  {
    name: 'medicare_number',
    pattern: /\b\d{4}\s?\d{5}\s?\d{1}\b/g,
    confidence: 'high',
    description: 'Medicare numbers (10 digits)'
  },
  {
    name: 'date_of_birth',
    pattern: /\b(?:0?[1-9]|[12]\d|3[01])[\/\-.](?:0?[1-9]|1[0-2])[\/\-.]\d{4}\b/g,
    confidence: 'high',
    description: 'Date patterns (potentially DOB)'
  },
  
  // Medium confidence patterns
  {
    name: 'australian_address',
    pattern: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Crescent|Cres|Circuit|Cct)\b[,\s]*(?:[A-Z]{2,3}\s+\d{4})?\b/gi,
    confidence: 'medium',
    description: 'Australian street addresses'
  },
  {
    name: 'postcode',
    pattern: /\b[A-Z]{2,3}\s+\d{4}\b/g,
    confidence: 'medium',
    description: 'Australian postcodes'
  },
  {
    name: 'abn_acn',
    pattern: /\b(?:ABN|ACN)[\s:]*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/gi,
    confidence: 'medium',
    description: 'ABN/ACN numbers'
  },
  {
    name: 'license_number',
    pattern: /\b(?:License|Licence)[\s#:]*[A-Z0-9]{6,12}\b/gi,
    confidence: 'medium',
    description: 'License numbers'
  },
  
  // Low confidence patterns (be more conservative)
  {
    name: 'potential_id_number',
    pattern: /\b[A-Z]{2,3}\d{6,9}\b/g,
    confidence: 'low',
    description: 'Potential ID numbers'
  },
  {
    name: 'claim_reference',
    pattern: /\b(?:Claim|Ref|Reference)[\s#:]*[A-Z0-9]{6,15}\b/gi,
    confidence: 'low',
    description: 'Claim reference numbers'
  },
];

/**
 * Medical-specific patterns that should be preserved but flagged
 */
const MEDICAL_PRESERVE_PATTERNS = [
  {
    name: 'medical_condition',
    pattern: /\b(?:diabetes|hypertension|depression|anxiety|cancer|arthritis|asthma|migraine|back pain|neck pain|shoulder injury)\b/gi,
    preserve: true,
    description: 'Common medical conditions (preserved)'
  },
  {
    name: 'body_part',
    pattern: /\b(?:head|neck|shoulder|arm|wrist|hand|finger|back|chest|hip|leg|knee|ankle|foot|toe)\b/gi,
    preserve: true,
    description: 'Body parts (preserved)'
  },
];

export class PHISanitizer {
  private config: SanitizationConfig;
  private redactionStats: Map<string, number> = new Map();

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Sanitize text by redacting PHI while preserving medical context
   */
  sanitizeText(text: string): SanitizationResult {
    if (!text || typeof text !== 'string') {
      return {
        sanitizedText: text || '',
        redactionCount: 0,
        redactionTypes: [],
      };
    }

    let sanitizedText = text;
    let totalRedactions = 0;
    const redactionTypes: string[] = [];

    // Apply PHI redaction patterns
    for (const pattern of PHI_PATTERNS) {
      const matches = text.match(pattern.pattern);
      if (matches && matches.length > 0) {
        const redactionCount = matches.length;
        totalRedactions += redactionCount;
        redactionTypes.push(pattern.name);
        
        // Track statistics
        this.redactionStats.set(pattern.name, 
          (this.redactionStats.get(pattern.name) || 0) + redactionCount
        );

        // Apply redaction
        if (this.config.preserveWordStructure) {
          sanitizedText = sanitizedText.replace(pattern.pattern, (match) => {
            return this.createStructuredRedaction(match, pattern.name);
          });
        } else {
          sanitizedText = sanitizedText.replace(pattern.pattern, this.config.redactionMarker);
        }

        if (this.config.enableLogging) {
          console.log(`PHI Sanitizer: Redacted ${redactionCount} instances of ${pattern.name}`);
        }
      }
    }

    return {
      sanitizedText,
      redactionCount: totalRedactions,
      redactionTypes,
    };
  }

  /**
   * Create structured redaction that preserves text length and structure
   */
  private createStructuredRedaction(originalText: string, patternType: string): string {
    const length = originalText.length;
    
    // For very short text, use simple marker
    if (length <= 6) {
      return this.config.redactionMarker;
    }
    
    // For longer text, preserve structure
    const typeMap: Record<string, string> = {
      'australian_phone': '[PHONE]',
      'email_address': '[EMAIL]',
      'medicare_number': '[MEDICARE]',
      'date_of_birth': '[DATE]',
      'australian_address': '[ADDRESS]',
      'postcode': '[POSTCODE]',
      'abn_acn': '[ABN/ACN]',
      'license_number': '[LICENSE]',
      'potential_id_number': '[ID]',
      'claim_reference': '[CLAIM_REF]',
    };
    
    return typeMap[patternType] || this.config.redactionMarker;
  }

  /**
   * Sanitize email object with detailed tracking
   */
  sanitizeEmailContent(email: {
    subject: string;
    body: string;
    originalSender?: string;
    originalSenderName?: string;
  }): {
    sanitizedEmail: typeof email;
    sanitizationReport: {
      totalRedactions: number;
      redactionsByField: Record<string, SanitizationResult>;
      riskLevel: 'low' | 'medium' | 'high';
    };
  } {
    const redactionsByField: Record<string, SanitizationResult> = {};
    let totalRedactions = 0;

    // Sanitize each field
    const sanitizedEmail = { ...email };
    
    if (email.subject) {
      redactionsByField.subject = this.sanitizeText(email.subject);
      sanitizedEmail.subject = redactionsByField.subject.sanitizedText;
      totalRedactions += redactionsByField.subject.redactionCount;
    }
    
    if (email.body) {
      redactionsByField.body = this.sanitizeText(email.body);
      sanitizedEmail.body = redactionsByField.body.sanitizedText;
      totalRedactions += redactionsByField.body.redactionCount;
    }
    
    if (email.originalSender) {
      redactionsByField.originalSender = this.sanitizeText(email.originalSender);
      sanitizedEmail.originalSender = redactionsByField.originalSender.sanitizedText;
      totalRedactions += redactionsByField.originalSender.redactionCount;
    }
    
    if (email.originalSenderName) {
      redactionsByField.originalSenderName = this.sanitizeText(email.originalSenderName);
      sanitizedEmail.originalSenderName = redactionsByField.originalSenderName.sanitizedText;
      totalRedactions += redactionsByField.originalSenderName.redactionCount;
    }

    // Determine risk level based on redaction count and types
    const allRedactionTypes = Object.values(redactionsByField)
      .flatMap(result => result.redactionTypes);
    
    const highRiskTypes = ['medicare_number', 'date_of_birth', 'australian_address'];
    const hasHighRiskData = allRedactionTypes.some(type => highRiskTypes.includes(type));
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (hasHighRiskData || totalRedactions > 10) {
      riskLevel = 'high';
    } else if (totalRedactions > 5) {
      riskLevel = 'medium';
    }

    return {
      sanitizedEmail,
      sanitizationReport: {
        totalRedactions,
        redactionsByField,
        riskLevel,
      },
    };
  }

  /**
   * Get redaction statistics for monitoring
   */
  getRedactionStats(): Record<string, number> {
    return Object.fromEntries(this.redactionStats);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.redactionStats.clear();
  }

  /**
   * Validate that sanitization is working correctly
   */
  static validateSanitization(): boolean {
    const testCases = [
      {
        input: "Call me at 0412 345 678 or email john.doe@example.com",
        expectedRedactions: 2,
        description: "Phone and email redaction"
      },
      {
        input: "Medicare number: 1234 56789 0, DOB: 15/03/1985",
        expectedRedactions: 2,
        description: "Medicare and DOB redaction"
      },
      {
        input: "Lives at 123 Collins Street, Melbourne VIC 3000",
        expectedRedactions: 2,
        description: "Address and postcode redaction"
      },
    ];

    const sanitizer = new PHISanitizer({ enableLogging: false });
    
    for (const testCase of testCases) {
      const result = sanitizer.sanitizeText(testCase.input);
      
      if (result.redactionCount < testCase.expectedRedactions) {
        console.error(`PHI Sanitization test failed: ${testCase.description}`);
        console.error(`Expected at least ${testCase.expectedRedactions} redactions, got ${result.redactionCount}`);
        return false;
      }
      
      // Ensure no PHI remains in output
      const patterns = [
        /0\d{9}/, // Phone numbers
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
        /\d{4}\s?\d{5}\s?\d{1}/, // Medicare
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(result.sanitizedText)) {
          console.error(`PHI Sanitization test failed: Pattern still found in sanitized text`);
          console.error(`Input: ${testCase.input}`);
          console.error(`Output: ${result.sanitizedText}`);
          return false;
        }
      }
    }
    
    console.log("PHI Sanitization validation passed");
    return true;
  }
}

// Export singleton for convenience
export const phiSanitizer = new PHISanitizer({
  preserveWordStructure: true,
  redactionMarker: '[REDACTED]',
  enableLogging: process.env.NODE_ENV === 'development',
});