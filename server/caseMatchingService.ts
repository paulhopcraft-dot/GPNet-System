import { ExternalEmail, Worker, Ticket, CaseProvider } from "@shared/schema";
import { IStorage } from "./storage";

export interface MatchCandidate {
  ticketId: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  confidenceScore: number;
  matchType: string;
  matchReasoning: string;
  matchDetails: {
    nameMatch?: number;
    emailMatch?: boolean;
    providerMatch?: string[];
    contextMatch?: number;
    timeProximity?: number;
  };
}

export interface MatchResult {
  bestMatch?: MatchCandidate;
  alternativeMatches: MatchCandidate[];
  totalCandidates: number;
  processingTime: number;
}

export interface MatchingOptions {
  minConfidenceThreshold: number;
  maxAlternatives: number;
  includeInactiveCases: boolean;
  timeWeightDecayDays: number;
}

export class CaseMatchingService {
  private defaultOptions: MatchingOptions = {
    minConfidenceThreshold: 60,
    maxAlternatives: 5,
    includeInactiveCases: false,
    timeWeightDecayDays: 90,
  };

  constructor(private storage: IStorage) {}

  /**
   * Find the best matching case for a parsed email
   */
  async findMatches(
    emailData: {
      extractedEntities: any;
      originalSender: string;
      originalSenderName?: string;
      body: string;
      subject: string;
    },
    organizationId: string,
    options: Partial<MatchingOptions> = {}
  ): Promise<MatchResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // Get all active tickets for the organization
      const tickets = await this.storage.getAllTicketsForOrganization(organizationId);
      const workers = await this.storage.getWorkersByOrg?.(organizationId) || [];
      
      // Create candidate matches
      const candidates: MatchCandidate[] = [];
      
      for (const ticket of tickets) {
        if (!opts.includeInactiveCases && ticket.status === 'CLOSED') {
          continue;
        }
        
        const worker = workers.find((w: any) => w.id === ticket.workerId);
        if (!worker) continue;
        
        const matchCandidate = await this.evaluateMatch(emailData, ticket, worker, opts);
        if (matchCandidate && matchCandidate.confidenceScore >= opts.minConfidenceThreshold) {
          candidates.push(matchCandidate);
        }
      }
      
      // Sort by confidence score
      candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
      
      const processingTime = Date.now() - startTime;
      
      return {
        bestMatch: candidates[0],
        alternativeMatches: candidates.slice(1, opts.maxAlternatives + 1),
        totalCandidates: candidates.length,
        processingTime,
      };
    } catch (error) {
      console.error("Case matching failed:", error);
      throw new Error(`Failed to match case: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Evaluate how well an email matches a specific case
   */
  private async evaluateMatch(
    emailData: {
      extractedEntities: any;
      originalSender: string;
      originalSenderName?: string;
      body: string;
      subject: string;
    },
    ticket: Ticket,
    worker: Worker,
    options: MatchingOptions
  ): Promise<MatchCandidate | null> {
    let totalScore = 0;
    let maxPossibleScore = 0;
    const matchDetails: MatchCandidate['matchDetails'] = {};
    const reasoning: string[] = [];
    let primaryMatchType = 'unknown';

    // 1. Worker Name Matching (30 points max)
    const nameScore = this.calculateNameMatch(emailData.extractedEntities.workerNames, worker);
    if (nameScore.score > 0) {
      totalScore += nameScore.score * 0.3;
      matchDetails.nameMatch = nameScore.score;
      reasoning.push(`Worker name match: ${nameScore.reasoning}`);
      if (nameScore.score > 70) primaryMatchType = 'worker_name';
    }
    maxPossibleScore += 30;

    // 2. Email Address Matching (25 points max)
    const emailMatch = this.calculateEmailMatch(emailData.originalSender, worker.email);
    if (emailMatch.match) {
      totalScore += 25;
      matchDetails.emailMatch = true;
      reasoning.push("Direct email match with worker");
      primaryMatchType = 'worker_email';
    }
    maxPossibleScore += 25;

    // 3. Provider Matching (20 points max)
    const providerScore = await this.calculateProviderMatch(
      emailData.extractedEntities.providerNames,
      emailData.originalSender,
      ticket.id
    );
    if (providerScore.score > 0) {
      totalScore += providerScore.score * 0.2;
      matchDetails.providerMatch = providerScore.matchedProviders;
      reasoning.push(`Provider match: ${providerScore.reasoning}`);
      if (primaryMatchType === 'unknown') primaryMatchType = 'treating_provider';
    }
    maxPossibleScore += 20;

    // 4. Context and Content Matching (15 points max)
    const contextScore = this.calculateContextMatch(emailData, worker, ticket);
    if (contextScore.score > 0) {
      totalScore += contextScore.score * 0.15;
      matchDetails.contextMatch = contextScore.score;
      reasoning.push(`Context match: ${contextScore.reasoning}`);
      if (primaryMatchType === 'unknown') primaryMatchType = 'manager_context';
    }
    maxPossibleScore += 15;

    // 5. Time Proximity Bonus (10 points max)
    const timeScore = this.calculateTimeProximity(ticket.createdAt || new Date(), options.timeWeightDecayDays);
    if (timeScore.score > 0) {
      totalScore += timeScore.score * 0.1;
      matchDetails.timeProximity = timeScore.score;
      reasoning.push(`Recent case activity: ${timeScore.reasoning}`);
    }
    maxPossibleScore += 10;

    // Calculate final confidence score (0-100)
    const confidenceScore = Math.round((totalScore / maxPossibleScore) * 100);

    if (confidenceScore < 10) {
      return null; // No meaningful match
    }

    return {
      ticketId: ticket.id,
      workerId: worker.id,
      workerName: `${worker.firstName} ${worker.lastName}`,
      workerEmail: worker.email,
      confidenceScore,
      matchType: primaryMatchType,
      matchReasoning: reasoning.join('; '),
      matchDetails,
    };
  }

  /**
   * Calculate name matching score using fuzzy matching
   */
  private calculateNameMatch(
    extractedNames: string[],
    worker: Worker
  ): { score: number; reasoning: string } {
    const workerFullName = `${worker.firstName} ${worker.lastName}`.toLowerCase();
    const workerFirstName = worker.firstName.toLowerCase();
    const workerLastName = worker.lastName.toLowerCase();

    let bestScore = 0;
    let bestMatch = '';

    for (const extractedName of extractedNames) {
      const name = extractedName.toLowerCase();
      
      // Exact full name match
      if (name === workerFullName) {
        return { score: 100, reasoning: `Exact full name match: ${extractedName}` };
      }
      
      // First name + last name match
      if (name.includes(workerFirstName) && name.includes(workerLastName)) {
        const score = 95;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = extractedName;
        }
      }
      
      // Last name only match
      if (name.includes(workerLastName) && workerLastName.length > 3) {
        const score = 70;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = extractedName;
        }
      }
      
      // First name only match (weaker)
      if (name.includes(workerFirstName) && workerFirstName.length > 3) {
        const score = 40;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = extractedName;
        }
      }
      
      // Fuzzy matching for typos
      const fuzzyScore = this.calculateFuzzyMatch(name, workerFullName);
      if (fuzzyScore > 70 && fuzzyScore > bestScore) {
        bestScore = fuzzyScore;
        bestMatch = extractedName;
      }
    }

    return {
      score: bestScore,
      reasoning: bestScore > 0 ? `Matched '${bestMatch}' to worker` : 'No name match found'
    };
  }

  /**
   * Check for direct email address match
   */
  private calculateEmailMatch(
    senderEmail: string,
    workerEmail: string
  ): { match: boolean; reasoning: string } {
    const senderLower = senderEmail.toLowerCase();
    const workerLower = workerEmail.toLowerCase();
    
    if (senderLower === workerLower) {
      return { match: true, reasoning: 'Exact email match' };
    }
    
    // Check if worker email is contained in sender (for cases like "John Doe <john@company.com>")
    if (senderLower.includes(workerLower)) {
      return { match: true, reasoning: 'Worker email found in sender' };
    }
    
    return { match: false, reasoning: 'No email match' };
  }

  /**
   * Calculate provider matching score
   */
  private async calculateProviderMatch(
    extractedProviders: string[],
    senderEmail: string,
    ticketId: string
  ): Promise<{ score: number; reasoning: string; matchedProviders: string[] }> {
    try {
      // Get providers associated with this case - placeholder for now
      const caseProviders: any[] = []; // TODO: Implement getCaseProviders in storage
      
      const matchedProviders: string[] = [];
      let totalScore = 0;
      
      // Check if sender email matches any known provider
      for (const provider of caseProviders) {
        if (provider.email.toLowerCase() === senderEmail.toLowerCase()) {
          matchedProviders.push(provider.name);
          totalScore = 100; // Direct provider email match
          break;
        }
      }
      
      // Check if extracted provider names match known providers
      if (totalScore === 0) {
        for (const extractedProvider of extractedProviders) {
          for (const provider of caseProviders) {
            const similarity = this.calculateFuzzyMatch(
              extractedProvider.toLowerCase(),
              provider.name.toLowerCase()
            );
            
            if (similarity > 70) {
              matchedProviders.push(provider.name);
              totalScore = Math.max(totalScore, similarity);
            }
          }
        }
      }
      
      return {
        score: totalScore,
        reasoning: matchedProviders.length > 0 
          ? `Matched providers: ${matchedProviders.join(', ')}`
          : 'No provider match found',
        matchedProviders,
      };
    } catch (error) {
      console.error("Provider matching failed:", error);
      return { score: 0, reasoning: 'Provider matching error', matchedProviders: [] };
    }
  }

  /**
   * Calculate context and content matching
   */
  private calculateContextMatch(
    emailData: { extractedEntities: any; body: string; subject: string },
    worker: Worker,
    ticket: Ticket
  ): { score: number; reasoning: string } {
    let score = 0;
    const reasons: string[] = [];
    
    const emailText = `${emailData.subject} ${emailData.body}`.toLowerCase();
    
    // Check for injury/condition mentions
    const injuryDescription = (ticket as any).injuryDescription;
    if (injuryDescription) {
      const injuryKeywords = injuryDescription.toLowerCase().split(' ');
      let injuryMatches = 0;
      
      for (const keyword of injuryKeywords) {
        if (keyword.length > 3 && emailText.includes(keyword)) {
          injuryMatches++;
        }
      }
      
      if (injuryMatches > 0) {
        const injuryScore = Math.min(40, injuryMatches * 10);
        score += injuryScore;
        reasons.push(`Injury context match (${injuryMatches} keywords)`);
      }
    }
    
    // Check for claim/case number references
    const extractedClaimNumbers = emailData.extractedEntities.claimNumbers || [];
    const claimNumber = (ticket as any).claimNumber;
    if (extractedClaimNumbers.length > 0 && claimNumber) {
      for (const claimNum of extractedClaimNumbers) {
        if (claimNumber.includes(claimNum) || claimNum.includes(claimNumber)) {
          score += 30;
          reasons.push(`Claim number reference match`);
          break;
        }
      }
    }
    
    // Check for workplace/employer context
    const employerName = (ticket as any).employerName;
    if (employerName && emailText.includes(employerName.toLowerCase())) {
      score += 20;
      reasons.push('Employer name mentioned');
    }
    
    // Medical terms relevance
    const medicalTerms = emailData.extractedEntities.medicalTerms || [];
    if (medicalTerms.length > 0) {
      score += Math.min(10, medicalTerms.length * 2);
      reasons.push(`${medicalTerms.length} medical terms found`);
    }
    
    return {
      score: Math.min(100, score),
      reasoning: reasons.length > 0 ? reasons.join('; ') : 'No context match'
    };
  }

  /**
   * Calculate time proximity bonus for recent cases
   */
  private calculateTimeProximity(
    caseCreatedAt: Date,
    decayDays: number
  ): { score: number; reasoning: string } {
    const now = new Date();
    const caseDate = new Date(caseCreatedAt);
    const daysDiff = Math.floor((now.getTime() - caseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) {
      return { score: 0, reasoning: 'Future case date' };
    }
    
    if (daysDiff > decayDays) {
      return { score: 0, reasoning: `Case too old (${daysDiff} days)` };
    }
    
    // Linear decay from 100 to 0 over decayDays
    const score = Math.round(100 * (1 - daysDiff / decayDays));
    
    return {
      score,
      reasoning: `Case created ${daysDiff} days ago`
    };
  }

  /**
   * Calculate fuzzy string matching using simple Levenshtein-like algorithm
   */
  private calculateFuzzyMatch(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 0;
    
    const editDistance = this.calculateEditDistance(longer, shorter);
    return Math.round(((longer.length - editDistance) / longer.length) * 100);
  }

  /**
   * Calculate edit distance between two strings
   */
  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get match type description for UI display
   */
  getMatchTypeDescription(matchType: string): string {
    const descriptions: Record<string, string> = {
      'worker_email': 'Direct email match with worker',
      'worker_name': 'Worker name found in email content',
      'treating_provider': 'Email from known treating provider',
      'manager_context': 'Contextual match based on case details',
      'unknown': 'Multiple factors contributed to match'
    };
    
    return descriptions[matchType] || 'Unknown match type';
  }

  /**
   * Get confidence level description
   */
  getConfidenceDescription(score: number): string {
    if (score >= 90) return 'Very High';
    if (score >= 75) return 'High';
    if (score >= 60) return 'Medium';
    if (score >= 40) return 'Low';
    return 'Very Low';
  }
}

// Export factory function instead of direct instantiation
export const createCaseMatchingService = (storage: IStorage) => new CaseMatchingService(storage);