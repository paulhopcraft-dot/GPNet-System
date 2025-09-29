import bcrypt from 'bcrypt';
import { storage } from './storage.js';
import { 
  ClientUser, 
  AdminUser, 
  InsertClientUser, 
  InsertAdminUser,
  InsertAuditEvent 
} from '../shared/schema.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'client' | 'admin' | 'super_user';
  userType?: string;
  organizationId?: string;
  permissions?: any[];
  isImpersonating?: boolean;
  impersonationTarget?: string;
}

export class AuthService {
  private readonly saltRounds = 12;

  // Password utilities
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Client authentication
  async authenticateClient(email: string, password: string, organizationId?: string): Promise<ClientUser | null> {
    try {
      const user = await storage.getClientUserByEmail(email, organizationId);
      
      if (!user || user.isArchived) {
        await this.safeLogAudit({
          eventType: 'CLIENT_LOGIN_FAILED',
          eventCategory: 'auth',
          actorId: 'anonymous',
          actorType: 'client_user',
          actorEmail: email,
          organizationId: organizationId || null,
          action: 'Login attempt failed',
          result: 'failed',
          details: { reason: 'user_not_found_or_archived', email }
        });
        return null;
      }

      // Guard against null passwordHash
      if (!user.passwordHash) {
        await this.safeLogAudit({
          eventType: 'CLIENT_LOGIN_FAILED',
          eventCategory: 'auth',
          actorId: user.id,
          actorType: 'client_user',
          actorEmail: user.email,
          organizationId: user.organizationId,
          action: 'Login failed - no password hash',
          result: 'failed',
          details: { email: user.email, reason: 'missing_password_hash' }
        });
        return null;
      }

      const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
      
      if (!isPasswordValid) {
        await this.safeLogAudit({
          eventType: 'CLIENT_LOGIN_FAILED',
          eventCategory: 'auth',
          actorId: user.id,
          actorType: 'client_user',
          actorEmail: user.email,
          organizationId: user.organizationId,
          action: 'Login failed - invalid password',
          result: 'failed',
          details: { email: user.email }
        });
        return null;
      }

      // Update last login
      const updatedUser = await storage.updateClientUserLastLogin(user.id);
      
      await this.safeLogAudit({
        eventType: 'CLIENT_LOGIN_SUCCESS',
        eventCategory: 'auth',
        actorId: user.id,
        actorType: 'client_user',
        actorEmail: user.email,
        organizationId: user.organizationId,
        action: 'Client login successful',
        result: 'success',
        details: { email: user.email, loginCount: updatedUser.loginCount }
      });

      return updatedUser;
    } catch (error) {
      console.error('Client authentication error:', error);
      return null;
    }
  }

  // Admin authentication
  async authenticateAdmin(email: string, password: string): Promise<AdminUser | null> {
    try {
      // Normalize email for consistent lookup
      const normalizedEmail = email.trim().toLowerCase();
      const user = await storage.getAdminUserByEmail(normalizedEmail);
      
      if (!user || user.isArchived) {
        await this.safeLogAudit({
          eventType: 'ADMIN_LOGIN_FAILED',
          eventCategory: 'auth',
          actorId: 'anonymous',
          actorType: 'admin',
          actorEmail: email,
          organizationId: null,
          action: 'Admin login attempt failed',
          result: 'failed',
          details: { reason: 'admin_not_found_or_archived', email }
        });
        return null;
      }

      // Guard against null passwordHash
      if (!user.passwordHash) {
        await this.safeLogAudit({
          eventType: 'ADMIN_LOGIN_FAILED',
          eventCategory: 'auth',
          actorId: user.id,
          actorType: 'admin',
          actorEmail: user.email,
          organizationId: null,
          action: 'Admin login failed - no password hash',
          result: 'failed',
          details: { email: user.email, reason: 'missing_password_hash' }
        });
        return null;
      }

      const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
      
      if (!isPasswordValid) {
        await this.safeLogAudit({
          eventType: 'ADMIN_LOGIN_FAILED',
          eventCategory: 'auth',
          actorId: user.id,
          actorType: 'admin',
          actorEmail: user.email,
          organizationId: null,
          action: 'Admin login failed - invalid password',
          result: 'failed',
          details: { email: user.email }
        });
        return null;
      }

      // Update last login
      const updatedUser = await storage.updateAdminUserLastLogin(user.id);
      
      await this.safeLogAudit({
        eventType: 'ADMIN_LOGIN_SUCCESS',
        eventCategory: 'auth',
        actorId: user.id,
        actorType: 'admin',
        actorEmail: user.email,
        organizationId: null,
        action: 'Admin login successful',
        result: 'success',
        details: { 
          email: user.email, 
          loginCount: updatedUser.loginCount,
          isSuperuser: (updatedUser as any).isSuperuser
        }
      });

      return updatedUser;
    } catch (error) {
      console.error('Admin authentication error:', error);
      return null;
    }
  }

  // User registration
  async registerClient(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    role?: string;
  }): Promise<ClientUser | null> {
    try {
      // Check if user already exists
      const existingUser = await storage.getClientUserByEmail(userData.email, userData.organizationId);
      if (existingUser) {
        return null;
      }

      const hashedPassword = await this.hashPassword(userData.password);
      
      const newUser: InsertClientUser = {
        email: userData.email,
        passwordHash: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        organizationId: userData.organizationId,
        role: userData.role || 'user',
        status: 'active',
        loginCount: 0
      };

      const user = await storage.createClientUser(newUser);
      
      await this.safeLogAudit({
        eventType: 'CLIENT_USER_CREATED',
        eventCategory: 'admin',
        actorId: user.id,
        actorType: 'client_user',
        actorEmail: user.email,
        organizationId: user.organizationId,
        action: 'New client user registered',
        result: 'success',
        details: { email: user.email, role: user.role }
      });

      return user;
    } catch (error) {
      console.error('Client registration error:', error);
      return null;
    }
  }

  async registerAdmin(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    isSuperuser?: boolean;
    permissions?: any[];
  }, createdBy: string): Promise<AdminUser | null> {
    try {
      // Normalize email for consistent storage and lookup
      const normalizedEmail = userData.email.trim().toLowerCase();
      // Check if admin already exists
      const existingAdmin = await storage.getAdminUserByEmail(normalizedEmail);
      if (existingAdmin) {
        return null;
      }

      const hashedPassword = await this.hashPassword(userData.password);
      
      const newAdmin: InsertAdminUser = {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        permissions: userData.permissions || [],
        status: 'active',
        loginCount: 0
      };

      const admin = await storage.createAdminUser(newAdmin);
      
      await this.safeLogAudit({
        eventType: 'ADMIN_USER_CREATED',
        eventCategory: 'admin',
        actorId: createdBy,
        actorType: 'admin',
        organizationId: null,
        action: 'New admin user created',
        result: 'success',
        details: { 
          email: admin.email, 
          isSuperuser: (admin as any).isSuperuser,
          permissions: admin.permissions,
          createdBy 
        }
      });

      return admin;
    } catch (error) {
      console.error('Admin registration error:', error);
      return null;
    }
  }

  // Session conversion
  userToAuthenticatedUser(user: ClientUser | AdminUser, role: 'client' | 'admin'): AuthenticatedUser {
    const baseUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role
    };

    if (role === 'client') {
      const clientUser = user as ClientUser;
      baseUser.organizationId = clientUser.organizationId;
    } else {
      const adminUser = user as AdminUser;
      baseUser.userType = 'admin'; // CRITICAL: This is what the case route checks for
      baseUser.permissions = adminUser.permissions as any[] || [];
      
      // If admin has superuser permissions, set role to super_user for backward compatibility
      if (Array.isArray(adminUser.permissions) && adminUser.permissions.includes('superuser')) {
        baseUser.role = 'super_user';
      }
      
      baseUser.isImpersonating = !!adminUser.currentImpersonationTarget;
      baseUser.impersonationTarget = adminUser.currentImpersonationTarget || undefined;
    }

    return baseUser;
  }

  // Admin impersonation
  async startImpersonation(adminId: string, targetOrgId: string): Promise<AdminUser | null> {
    try {
      const admin = await storage.getAdminUser(adminId);
      if (!admin || !admin.permissions?.includes('superuser')) {
        return null;
      }

      // Verify target organization exists
      const targetOrg = await storage.getOrganization(targetOrgId);
      if (!targetOrg) {
        return null;
      }

      const updatedAdmin = await storage.setAdminImpersonation(adminId, targetOrgId);
      
      await this.safeLogAudit({
        eventType: 'ADMIN_IMPERSONATION_STARTED',
        eventCategory: 'admin',
        actorId: adminId,
        actorType: 'admin',
        actorEmail: admin.email,
        organizationId: targetOrgId,
        targetType: 'organization',
        targetId: targetOrgId,
        action: `Admin started impersonating organization: ${targetOrg.name}`,
        result: 'success',
        details: { 
          adminEmail: admin.email,
          targetOrgId,
          targetOrgName: targetOrg.name
        }
      });

      return updatedAdmin;
    } catch (error) {
      console.error('Impersonation start error:', error);
      return null;
    }
  }

  async stopImpersonation(adminId: string): Promise<AdminUser | null> {
    try {
      const admin = await storage.getAdminUser(adminId);
      if (!admin) {
        return null;
      }

      const targetOrgId = admin.currentImpersonationTarget;
      const updatedAdmin = await storage.setAdminImpersonation(adminId, null);
      
      await this.safeLogAudit({
        eventType: 'ADMIN_IMPERSONATION_STOPPED',
        eventCategory: 'admin',
        actorId: adminId,
        actorType: 'admin',
        actorEmail: admin.email,
        organizationId: targetOrgId || null,
        action: 'Admin stopped impersonating organization',
        result: 'success',
        details: { 
          adminEmail: admin.email,
          previousTarget: targetOrgId
        }
      });

      return updatedAdmin;
    } catch (error) {
      console.error('Impersonation stop error:', error);
      return null;
    }
  }

  // Audit logging - safe wrapper to prevent auth failures
  private async safeLogAudit(event: Omit<InsertAuditEvent, 'id'>): Promise<void> {
    try {
      await this.logAuditEvent(event);
    } catch (error) {
      console.warn('Audit log failed (non-blocking):', error);
    }
  }

  // Audit logging
  async logAuditEvent(event: Omit<InsertAuditEvent, 'id'>): Promise<void> {
    try {
      await storage.createAuditEvent(event);
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  // Password reset (for future implementation)
  async initiatePasswordReset(email: string, isAdmin: boolean = false): Promise<boolean> {
    // TODO: Implement password reset functionality
    // This would generate a secure token and send reset email
    return false;
  }

  // Account management
  async changePassword(userId: string, currentPassword: string, newPassword: string, isAdmin: boolean = false): Promise<boolean> {
    try {
      const user = isAdmin 
        ? await storage.getAdminUser(userId)
        : await storage.getClientUser(userId);

      if (!user) {
        return false;
      }

      // Guard against null passwordHash
      if (!user.passwordHash) {
        return false;
      }

      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return false;
      }

      const hashedNewPassword = await this.hashPassword(newPassword);
      
      if (isAdmin) {
        await storage.updateAdminUser(userId, { passwordHash: hashedNewPassword });
      } else {
        await storage.updateClientUser(userId, { passwordHash: hashedNewPassword });
      }

      await this.safeLogAudit({
        eventType: 'PASSWORD_CHANGED',
        eventCategory: 'auth',
        actorId: userId,
        actorType: isAdmin ? 'admin' : 'client_user',
        actorEmail: user.email,
        organizationId: isAdmin ? null : (user as ClientUser).organizationId,
        action: `Password changed for ${isAdmin ? 'admin' : 'client'}: ${user.email}`,
        result: 'success',
        details: { email: user.email, userType: isAdmin ? 'admin' : 'client' }
      });

      return true;
    } catch (error) {
      console.error('Password change error:', error);
      return false;
    }
  }
}

export const authService = new AuthService();