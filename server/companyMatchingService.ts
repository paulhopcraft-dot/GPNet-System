import { storage } from './storage';
import { z } from 'zod';
import type { Organization, CompanyAlias } from '../shared/schema.js';

// Fuzzy matching algorithms
class FuzzyMatcher {
  /**
   * Calculate Levenshtein distance between two strings
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate similarity score (0-100) between two strings
   */
  static similarity(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (str1.length === 0 && str2.length === 0) return 100;
    if (str1.length === 0 || str2.length === 0) return 0;

    const maxLength = Math.max(str1.length, str2.length);
    const distance = this.levenshteinDistance(str1, str2);
    return Math.round(((maxLength - distance) / maxLength) * 100);
  }

  /**
   * Check for exact substring matches (case insensitive)
   */
  static containsSubstring(haystack: string, needle: string): boolean {
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }

  /**
   * Check for word-based matching
   */
  static wordSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 && words2.length === 0) return 100;
    if (words1.length === 0 || words2.length === 0) return 0;

    let matches = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 || this.similarity(word1, word2) > 80) {
          matches++;
          break;
        }
      }
    }

    return Math.round((matches / Math.max(words1.length, words2.length)) * 100);
  }
}

// Company name normalization utility  
export class CompanyNameNormalizer {
  private static readonly COMPANY_SUFFIXES = [
    'ltd', 'limited', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company',
    'pty', 'proprietary', 'llc', 'plc', 'group', 'holdings', 'enterprises',
    'services', 'solutions', 'consulting', 'contractors', 'construction'
  ];

  private static readonly COMMON_ABBREVIATIONS = {
    'and': '&',
    '&': 'and',
    'corporation': 'corp',
    'company': 'co',
    'limited': 'ltd',
    'incorporated': 'inc',
    'proprietary': 'pty',
    'services': 'svc',
    'construction': 'construc',
    'engineering': 'eng',
    'management': 'mgmt'
  };

  /**
   * Normalize company name for consistent matching
   */
  static normalize(companyName: string): string {
    let normalized = companyName.toLowerCase().trim();
    
    // Remove common punctuation and extra spaces
    normalized = normalized.replace(/[^\w\s&]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Remove common company suffixes
    const words = normalized.split(' ');
    const filteredWords = words.filter(word => 
      !this.COMPANY_SUFFIXES.includes(word.toLowerCase())
    );
    
    return filteredWords.join(' ').trim();
  }

  /**
   * Generate variations of a company name for broader matching
   */
  static generateVariations(companyName: string): string[] {
    const variations = new Set<string>();
    const normalized = this.normalize(companyName);
    
    variations.add(normalized);
    variations.add(companyName.toLowerCase().trim());
    
    // Add abbreviation variations
    for (const [full, abbr] of Object.entries(this.COMMON_ABBREVIATIONS)) {
      const withAbbr = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
      const withFull = normalized.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full);
      variations.add(withAbbr);
      variations.add(withFull);
    }

    return Array.from(variations).filter(v => v.length > 0);
  }
}

// Company matching result types
export interface CompanyMatch {
  organization: Organization;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'substring';
  matchedName: string;
  normalizedInput: string;
}

export interface CompanyMatchOptions {
  minConfidence?: number; // Minimum confidence score (default: 70)
  includeInactive?: boolean; // Include archived organizations (default: false)
  maxResults?: number; // Maximum number of results (default: 10)
}

// Input validation schemas
export const CompanyMatchRequestSchema = z.object({
  companyName: z.string().min(1).max(255),
  options: z.object({
    minConfidence: z.number().min(0).max(100).optional(),
    includeInactive: z.boolean().optional(),
    maxResults: z.number().min(1).max(50).optional()
  }).optional()
});

export const CreateAliasRequestSchema = z.object({
  organizationId: z.string(),
  aliasName: z.string().min(1).max(255),
  confidence: z.number().min(0).max(100).optional(),
  isPreferred: z.boolean().optional()
});

export type CompanyMatchRequest = z.infer<typeof CompanyMatchRequestSchema>;
export type CreateAliasRequest = z.infer<typeof CreateAliasRequestSchema>;

/**
 * Intelligent Company Matching Service
 * 
 * Handles fuzzy matching of company names using multiple algorithms:
 * - Exact matching with existing organizations
 * - Alias-based matching with confidence scores  
 * - Fuzzy string matching using Levenshtein distance
 * - Word-based similarity matching
 * - Substring containment checks
 */
export class CompanyMatchingService {
  
  /**
   * Find matching companies for a given company name
   */
  async findMatches(request: CompanyMatchRequest): Promise<CompanyMatch[]> {
    const { companyName, options = {} } = request;
    const {
      minConfidence = 70,
      includeInactive = false,
      maxResults = 10
    } = options;

    console.log('Finding company matches for:', { companyName, options });

    const normalizedInput = CompanyNameNormalizer.normalize(companyName);
    const variations = CompanyNameNormalizer.generateVariations(companyName);
    
    console.log('Generated variations:', variations);

    const matches: CompanyMatch[] = [];

    try {
      // Step 1: Get all organizations and aliases
      const organizations = await storage.getAllOrganizations();
      const aliases = await storage.getAllCompanyAliases();

      // Filter organizations if needed
      const activeOrganizations = includeInactive 
        ? organizations 
        : organizations.filter(org => !org.isArchived);

      // Step 2: Exact matches with organization names
      for (const org of activeOrganizations) {
        const normalizedOrgName = CompanyNameNormalizer.normalize(org.name);
        
        if (normalizedInput === normalizedOrgName) {
          matches.push({
            organization: org,
            confidence: 100,
            matchType: 'exact',
            matchedName: org.name,
            normalizedInput
          });
          continue; // Skip fuzzy matching for exact matches
        }
      }

      // Step 3: Alias-based matches
      for (const alias of aliases) {
        const org = activeOrganizations.find(o => o.id === alias.companyId);
        if (!org) continue;

        // Check if we already have an exact match for this org
        if (matches.some(m => m.organization.id === org.id && m.matchType === 'exact')) {
          continue;
        }

        const normalizedAlias = CompanyNameNormalizer.normalize(alias.aliasName);
        
        if (variations.some(v => CompanyNameNormalizer.normalize(v) === normalizedAlias)) {
          matches.push({
            organization: org,
            confidence: alias.confidence || 95,
            matchType: 'alias',
            matchedName: alias.aliasName,
            normalizedInput
          });
        }
      }

      // Step 4: Fuzzy matching for organizations without exact/alias matches
      for (const org of activeOrganizations) {
        // Skip if we already have a match for this org
        if (matches.some(m => m.organization.id === org.id)) continue;

        const orgName = org.name;
        const normalizedOrgName = CompanyNameNormalizer.normalize(orgName);

        // Try different matching algorithms
        let bestConfidence = 0;
        let matchType: 'fuzzy' | 'substring' = 'fuzzy';

        // Algorithm 1: Direct string similarity
        const directSimilarity = FuzzyMatcher.similarity(normalizedInput, normalizedOrgName);
        if (directSimilarity > bestConfidence) {
          bestConfidence = directSimilarity;
        }

        // Algorithm 2: Word-based similarity
        const wordSimilarity = FuzzyMatcher.wordSimilarity(normalizedInput, normalizedOrgName);
        if (wordSimilarity > bestConfidence) {
          bestConfidence = wordSimilarity;
        }

        // Algorithm 3: Substring matching
        if (FuzzyMatcher.containsSubstring(normalizedOrgName, normalizedInput) ||
            FuzzyMatcher.containsSubstring(normalizedInput, normalizedOrgName)) {
          const substringScore = Math.min(100, Math.max(
            Math.round((normalizedInput.length / normalizedOrgName.length) * 100),
            Math.round((normalizedOrgName.length / normalizedInput.length) * 100)
          ));
          if (substringScore > bestConfidence) {
            bestConfidence = substringScore;
            matchType = 'substring';
          }
        }

        // Algorithm 4: Try against variations
        for (const variation of variations) {
          const normalizedVariation = CompanyNameNormalizer.normalize(variation);
          const varSimilarity = Math.max(
            FuzzyMatcher.similarity(normalizedVariation, normalizedOrgName),
            FuzzyMatcher.wordSimilarity(normalizedVariation, normalizedOrgName)
          );
          if (varSimilarity > bestConfidence) {
            bestConfidence = varSimilarity;
          }
        }

        // Ensure confidence is always capped at 100
        const cappedConfidence = Math.min(100, bestConfidence);
        
        if (cappedConfidence >= minConfidence) {
          matches.push({
            organization: org,
            confidence: cappedConfidence,
            matchType,
            matchedName: orgName,
            normalizedInput
          });
        }
      }

      // Step 5: Sort by confidence and limit results
      const sortedMatches = matches
        .sort((a, b) => {
          if (b.confidence !== a.confidence) return b.confidence - a.confidence;
          // Prefer exact matches, then aliases, then others
          const typeOrder = { exact: 0, alias: 1, substring: 2, fuzzy: 3 };
          return typeOrder[a.matchType] - typeOrder[b.matchType];
        })
        .slice(0, maxResults);

      console.log(`Found ${sortedMatches.length} matches with confidence >= ${minConfidence}%`);
      
      return sortedMatches;
      
    } catch (error) {
      console.error('Error finding company matches:', error);
      throw new Error('Failed to find company matches');
    }
  }

  /**
   * Get the best match for a company name (convenience method)
   */
  async getBestMatch(companyName: string, minConfidence: number = 80): Promise<CompanyMatch | null> {
    const matches = await this.findMatches({
      companyName,
      options: { minConfidence, maxResults: 1 }
    });

    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Create a new company alias for improved matching
   */
  async createAlias(request: CreateAliasRequest): Promise<CompanyAlias> {
    const { organizationId, aliasName, confidence = 90, isPreferred = false } = request;

    console.log('Creating company alias:', { organizationId, aliasName, confidence });

    const normalizedName = CompanyNameNormalizer.normalize(aliasName);

    try {
      const alias = await storage.createCompanyAlias({
        companyId: organizationId,
        aliasName,
        normalizedName,
        confidence,
        isPreferred
      });

      console.log('Created alias:', alias.id);
      return alias;
      
    } catch (error) {
      console.error('Failed to create company alias:', error);
      throw new Error('Failed to create company alias');
    }
  }

  /**
   * Auto-match a company name and return organization ID
   * If no good match is found, returns null
   */
  async autoMatch(companyName: string, minConfidence: number = 85): Promise<string | null> {
    try {
      const bestMatch = await this.getBestMatch(companyName, minConfidence);
      
      if (bestMatch) {
        console.log(`Auto-matched "${companyName}" to "${bestMatch.organization.name}" (${bestMatch.confidence}%)`);
        return bestMatch.organization.id;
      }

      console.log(`No auto-match found for "${companyName}" with confidence >= ${minConfidence}%`);
      return null;
      
    } catch (error) {
      console.error('Error in auto-match:', error);
      return null;
    }
  }

  /**
   * Suggest creating an alias when a manual match is made
   */
  async suggestAlias(companyName: string, organizationId: string): Promise<void> {
    try {
      // Check if alias already exists
      const normalizedName = CompanyNameNormalizer.normalize(companyName);
      const existingAliases = await storage.getCompanyAliasesForOrganization(organizationId);
      
      const aliasExists = existingAliases.some((alias: CompanyAlias) => 
        CompanyNameNormalizer.normalize(alias.aliasName) === normalizedName
      );

      if (!aliasExists) {
        await this.createAlias({
          organizationId,
          aliasName: companyName,
          confidence: 95, // High confidence for manually created aliases
          isPreferred: false
        });
        
        console.log(`Auto-created alias "${companyName}" for organization ${organizationId}`);
      }
      
    } catch (error) {
      console.error('Failed to suggest alias:', error);
      // Don't throw - this is a helper function
    }
  }

  /**
   * Get statistics about company matching performance
   */
  async getMatchingStats(): Promise<{
    totalOrganizations: number;
    totalAliases: number;
    averageAliasesPerOrg: number;
    confidenceDistribution: Record<string, number>;
  }> {
    try {
      const [organizations, aliases] = await Promise.all([
        storage.getAllOrganizations(),
        storage.getAllCompanyAliases()
      ]);

      const confidenceDistribution = aliases.reduce((dist: Record<string, number>, alias: CompanyAlias) => {
        const bucket = Math.floor((alias.confidence || 0) / 10) * 10;
        const key = `${bucket}-${bucket + 9}`;
        dist[key] = (dist[key] || 0) + 1;
        return dist;
      }, {} as Record<string, number>);

      return {
        totalOrganizations: organizations.length,
        totalAliases: aliases.length,
        averageAliasesPerOrg: aliases.length / Math.max(organizations.length, 1),
        confidenceDistribution
      };
      
    } catch (error) {
      console.error('Failed to get matching stats:', error);
      throw new Error('Failed to get matching statistics');
    }
  }
}

// Export singleton instance
export const companyMatchingService = new CompanyMatchingService();