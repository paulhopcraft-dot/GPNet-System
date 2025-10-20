// ========================================
// Invite Service - Secure User Registration
// File: server/inviteService.ts
// ========================================

import crypto from 'crypto';
import { storage } from './storage';
import type { UserInvite, InsertUserInvite } from '@db/schema';

/**
 * InviteService - Manages secure user invitation system
 * 
 * Users can ONLY register with valid invite tokens.
 * Tokens expire after 7 days and are one-time use.
 */
export class InviteService {

  /**
   * Create a new user invite
   */
  async createInvite(data: {
    email: string;
    organizationId: string;
    role: string;
    createdBy: string;
    expiresInDays?: number;
  }): Promise<UserInvite> {
    // Generate cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));

    // Create invite record
    const invite = await storage.createUserInvite({
      email: data.email.toLowerCase().trim(),
      organizationId: data.organizationId,
      role: data.role,
      token,
      createdBy: data.createdBy,
      expiresAt,
      status: 'pending',
    });

    // Log registration URL for testing
    console.log(`✅ Invite created for ${data.email}`);
    console.log(`📧 Registration URL: ${process.env.FRONTEND_URL}/register?token=${token}`);

    return invite;
  }

  /**
   * Validate an invite token
   */
  async validateInvite(token: string): Promise<{
    valid: boolean;
    error?: string;
    invite?: UserInvite;
  }> {
    if (!token) {
      return { valid: false, error: 'Invite token is required' };
    }

    const invite = await storage.getUserInviteByToken(token);

    if (!invite) {
      return { valid: false, error: 'Invalid or unknown invite token' };
    }

    if (invite.status === 'used') {
      return { valid: false, error: 'This invite has already been used' };
    }

    if (invite.status === 'cancelled') {
      return { valid: false, error: 'This invite has been cancelled' };
    }

    if (invite.status === 'expired') {
      return { valid: false, error: 'This invite has expired' };
    }

    // Check expiration
    if (new Date() > new Date(invite.expiresAt)) {
      await storage.updateUserInvite(invite.id, { status: 'expired' });
      return { valid: false, error: 'This invite has expired' };
    }

    return { valid: true, invite };
  }

  /**
   * Mark invite as used after successful registration
   */
  async useInvite(token: string): Promise<boolean> {
    const invite = await storage.getUserInviteByToken(token);
    if (!invite) return false;

    await storage.updateUserInvite(invite.id, {
      status: 'used',
      usedAt: new Date(),
    });

    return true;
  }

  /**
   * Cancel a pending invite
   */
  async cancelInvite(inviteId: string): Promise<boolean> {
    try {
      await storage.updateUserInvite(inviteId, { status: 'cancelled' });
      return true;
    } catch (error) {
      console.error('Cancel invite error:', error);
      return false;
    }
  }

  /**
   * Get all pending invites for an organization
   */
  async getOrganizationInvites(organizationId: string): Promise<UserInvite[]> {
    return storage.getUserInvitesByOrg(organizationId);
  }

  /**
   * Resend an invite (generates new token with extended expiration)
   */
  async resendInvite(inviteId: string, expiresInDays: number = 7): Promise<UserInvite> {
    const oldInvite = await storage.getUserInvite(inviteId);
    if (!oldInvite) {
      throw new Error('Invite not found');
    }

    // Cancel old invite
    await storage.updateUserInvite(inviteId, { status: 'cancelled' });

    // Create new invite with same details
    return this.createInvite({
      email: oldInvite.email,
      organizationId: oldInvite.organizationId,
      role: oldInvite.role,
      createdBy: oldInvite.createdBy,
      expiresInDays,
    });
  }
}

// Export singleton instance
export const inviteService = new InviteService();