import { Router, Request, Response } from 'express';
import { authService } from './authService.js';
import { storage } from './storage.js';
import { z } from 'zod';

const router = Router();

// Enhanced middleware for admin authentication with active status check
export const requireAdmin = async (req: Request, res: Response, next: any) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  // Check if admin is still active (not suspended)
  try {
    const adminUser = await storage.getAdminUser(req.session.user.id);
    if (!adminUser || adminUser.status !== 'active') {
      // Clear session for suspended admin
      req.session.destroy(() => {});
      return res.status(403).json({ error: 'Account suspended' });
    }
  } catch (error) {
    console.error('Admin status check error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
  
  next();
};

// Enhanced middleware for superuser authentication with active status check
export const requireSuperuser = async (req: Request, res: Response, next: any) => {
  if (!req.session.user || req.session.user.role !== 'admin' || !req.session.user.permissions?.includes('superuser')) {
    return res.status(403).json({ error: 'Superuser access required' });
  }
  
  // Check if superuser is still active (not suspended)
  try {
    const adminUser = await storage.getAdminUser(req.session.user.id);
    if (!adminUser || adminUser.status !== 'active') {
      // Clear session for suspended superuser
      req.session.destroy(() => {});
      return res.status(403).json({ error: 'Account suspended' });
    }
  } catch (error) {
    console.error('Superuser status check error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
  
  next();
};

// Zod schemas for admin endpoints
const updatePermissionsSchema = z.object({
  permissions: z.array(z.string())
});

// Admin routes for organizations
router.get('/organizations', requireAdmin, async (req: Request, res: Response) => {
  try {
    const organizations = await storage.getAllOrganizations();
    
    // Enhance with user/case counts
    const enhancedOrgs = await Promise.all(
      organizations.map(async (org) => {
        const users = await storage.getClientUsersByOrganization(org.id);
        const tickets = await storage.getAllTicketsForOrganization(org.id);
        
        return {
          ...org,
          userCount: users.length,
          caseCount: tickets.length
        };
      })
    );
    
    res.json(enhancedOrgs);
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/organizations/:id/archive', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const archivedBy = req.session.user!.id;
    
    const organization = await storage.archiveOrganization(id, archivedBy);
    
    // Log audit event
    await authService.logAuditEvent({
      eventType: 'ORGANIZATION_ARCHIVED',
      eventCategory: 'admin',
      actorId: req.session.user!.id,
      actorType: 'admin',
      actorEmail: req.session.user!.email,
      organizationId: id,
      targetType: 'organization',
      targetId: id,
      action: `Admin archived organization: ${organization.name}`,
      result: 'success',
      details: { 
        organizationName: organization.name,
        archivedBy: req.session.user!.email
      }
    });
    
    res.json(organization);
  } catch (error) {
    console.error('Archive organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin routes for client users
router.get('/client-users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllClientUsers();
    
    // Enhance with organization names
    const enhancedUsers = await Promise.all(
      users.map(async (user) => {
        const org = user.organizationId ? await storage.getOrganization(user.organizationId) : null;
        return {
          ...user,
          organizationName: org?.name || 'Unknown'
        };
      })
    );
    
    res.json(enhancedUsers);
  } catch (error) {
    console.error('Get client users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/client-users/:id/suspend', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await storage.getClientUser(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const newStatus = user.status !== 'active' ? 'active' : 'suspended';
    const updatedUser = await storage.updateClientUser(id, { status: newStatus });
    
    // Log audit event
    await authService.logAuditEvent({
      eventType: newStatus === 'active' ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
      eventCategory: 'admin',
      actorId: req.session.user!.id,
      actorType: 'admin',
      actorEmail: req.session.user!.email,
      organizationId: user.organizationId,
      targetType: 'user',
      targetId: id,
      action: `Admin ${newStatus === 'active' ? 'activated' : 'suspended'} user: ${user.email}`,
      result: 'success',
      details: { 
        userEmail: user.email,
        previousStatus: user.status,
        newStatus: newStatus
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Suspend/activate user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin routes for admin users
router.get('/admin-users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllAdminUsers();
    res.json(users);
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin-users/:id/suspend', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Prevent self-suspension
    if (id === req.session.user!.id) {
      return res.status(400).json({ error: 'Cannot suspend yourself' });
    }
    
    const user = await storage.getAdminUser(id);
    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    const newStatus = user.status !== 'active' ? 'active' : 'suspended';
    const updatedUser = await storage.updateAdminUser(id, { status: newStatus });
    
    // Log audit event
    await authService.logAuditEvent({
      eventType: newStatus === 'active' ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_SUSPENDED',
      eventCategory: 'admin',
      actorId: req.session.user!.id,
      actorType: 'admin',
      actorEmail: req.session.user!.email,
      targetType: 'admin_user',
      targetId: id,
      action: `Superuser ${newStatus === 'active' ? 'activated' : 'suspended'} admin user: ${user.email}`,
      result: 'success',
      details: { 
        adminEmail: user.email,
        previousStatus: user.status,
        newStatus: newStatus
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Suspend/activate admin user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin-users/:id/permissions', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissions } = updatePermissionsSchema.parse(req.body);
    
    const user = await storage.getAdminUser(id);
    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    const updatedUser = await storage.updateAdminUser(id, { permissions });
    
    // Log audit event
    await authService.logAuditEvent({
      eventType: 'ADMIN_PERMISSIONS_UPDATED',
      eventCategory: 'admin',
      actorId: req.session.user!.id,
      actorType: 'admin',
      actorEmail: req.session.user!.email,
      targetType: 'admin_user',
      targetId: id,
      action: `Superuser updated permissions for admin user: ${user.email}`,
      result: 'success',
      details: { 
        adminEmail: user.email,
        previousPermissions: user.permissions || [],
        newPermissions: permissions
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Update admin permissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin audit logs with tenant scoping
router.get('/audit-logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { organizationId, eventType, startDate, endDate } = req.query;
    const isAdmin = req.session.user!;
    const isSuperuser = isAdmin.permissions?.includes('superuser');
    
    const filters: any = {};
    
    // Enforce tenant scoping for non-superusers
    if (!isSuperuser) {
      // Non-superusers can only see audit logs for their impersonation target
      if (!isAdmin.impersonationTarget) {
        return res.status(403).json({ error: 'Must be impersonating an organization to view audit logs' });
      }
      
      // Force organizationId to match impersonation target, ignore client request
      filters.organizationId = isAdmin.impersonationTarget;
    } else {
      // Superusers can filter by any organization or see all
      if (organizationId) filters.organizationId = organizationId as string;
    }
    
    if (eventType) filters.eventType = eventType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const auditEvents = await storage.getAuditEvents(filters);
    
    // Enhance with organization names
    const enhancedEvents = await Promise.all(
      auditEvents.map(async (event) => {
        const org = event.organizationId ? await storage.getOrganization(event.organizationId) : null;
        return {
          ...event,
          organizationName: org?.name || null
        };
      })
    );
    
    res.json(enhancedEvents);
  } catch (error) {
    console.error('Get audit events error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// System statistics
router.get('/system-stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const organizations = await storage.getAllOrganizations();
    const clientUsers = await storage.getAllClientUsers();
    const adminUsers = await storage.getAllAdminUsers();
    const auditEvents = await storage.getAuditEvents();
    
    // Get total tickets across all organizations
    const allTickets = await storage.getAllTickets();
    
    // Calculate recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentLogins = auditEvents.filter(
      event => (event.eventType === 'CLIENT_LOGIN_SUCCESS' || event.eventType === 'ADMIN_LOGIN_SUCCESS') && new Date(event.timestamp) > yesterday
    ).length;
    
    const recentCases = allTickets.filter(
      ticket => ticket.createdAt && new Date(ticket.createdAt) > yesterday
    ).length;
    
    const recentRegistrations = auditEvents.filter(
      event => (event.eventType === 'CLIENT_USER_CREATED' || event.eventType === 'ADMIN_USER_CREATED') && new Date(event.timestamp) > yesterday
    ).length;
    
    const stats = {
      organizations: {
        total: organizations.length,
        active: organizations.filter(org => org.status === 'active' && !org.isArchived).length,
        inactive: organizations.filter(org => org.status === 'suspended' && !org.isArchived).length,
        archived: organizations.filter(org => org.isArchived).length
      },
      users: {
        clientUsers: clientUsers.length,
        adminUsers: adminUsers.length,
        activeUsers: clientUsers.filter(user => user.status === 'active').length + adminUsers.filter(user => user.status === 'active').length,
        totalLogins: clientUsers.reduce((sum, user) => sum + (user.loginCount || 0), 0) + 
                    adminUsers.reduce((sum, user) => sum + (user.loginCount || 0), 0)
      },
      cases: {
        total: allTickets.length,
        new: allTickets.filter(ticket => ticket.status === 'NEW').length,
        inProgress: allTickets.filter(ticket => ['ANALYSING', 'AWAITING_REVIEW'].includes(ticket.status)).length,
        completed: allTickets.filter(ticket => ticket.status === 'COMPLETE').length,
        red: 0, // TODO: Add ragScore filtering when analyses are linked
        amber: 0,
        green: 0
      },
      system: {
        auditEvents: auditEvents.length,
        uptime: process.uptime() > 3600 ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : `${Math.floor(process.uptime() / 60)}m`,
        version: process.env.npm_package_version || '1.0.0'
      },
      recentActivity: {
        logins: recentLogins,
        cases: recentCases,
        registrations: recentRegistrations
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;