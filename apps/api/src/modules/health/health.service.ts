import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async seedInitialData() {
    try {
      // Check if already seeded
      const existingRoles = await this.prisma.role.count();
      if (existingRoles > 0) {
        const existingUsers = await this.prisma.systemUser.findMany({
          select: { email: true, name: true, role: { select: { name: true } } },
        });
        return {
          message: 'Database already seeded',
          roles: existingRoles,
          users: existingUsers,
        };
      }

      // Create permissions (schema: id, code, description)
      const permissionCodes = [
        { code: 'admin.full', description: 'Complete system access' },
        { code: 'employees.read', description: 'Can view employees' },
        { code: 'employees.write', description: 'Can create/edit employees' },
        { code: 'punches.read', description: 'Can view punch records' },
        { code: 'punches.write', description: 'Can adjust punches' },
        { code: 'timesheets.read', description: 'Can view timesheets' },
        { code: 'timesheets.write', description: 'Can process timesheets' },
        { code: 'devices.read', description: 'Can view devices' },
        { code: 'devices.write', description: 'Can configure devices' },
        { code: 'reports.read', description: 'Can generate reports' },
        { code: 'audit.read', description: 'Can view audit trail' },
      ];

      const permissions = [];
      for (const p of permissionCodes) {
        const perm = await this.prisma.permission.create({ data: p });
        permissions.push(perm);
      }

      // Create roles
      const adminRole = await this.prisma.role.create({
        data: { name: 'admin', description: 'System Administrator' },
      });

      const managerRole = await this.prisma.role.create({
        data: { name: 'manager', description: 'Branch Manager' },
      });

      const viewerRole = await this.prisma.role.create({
        data: { name: 'viewer', description: 'Read-only access' },
      });

      // Assign all permissions to admin
      for (const perm of permissions) {
        await this.prisma.rolePermission.create({
          data: { roleId: adminRole.id, permissionId: perm.id },
        });
      }

      // Assign limited permissions to manager
      const managerPermCodes = ['employees.read', 'employees.write', 'punches.read', 'punches.write', 'timesheets.read', 'timesheets.write', 'reports.read'];
      for (const perm of permissions.filter(p => managerPermCodes.includes(p.code))) {
        await this.prisma.rolePermission.create({
          data: { roleId: managerRole.id, permissionId: perm.id },
        });
      }

      // Assign read permissions to viewer
      const viewerPermCodes = ['punches.read', 'timesheets.read', 'reports.read'];
      for (const perm of permissions.filter(p => viewerPermCodes.includes(p.code))) {
        await this.prisma.rolePermission.create({
          data: { roleId: viewerRole.id, permissionId: perm.id },
        });
      }

      // Create admin user
      const hashedPassword = await bcrypt.hash('Admin@2026', 10);
      const adminUser = await this.prisma.systemUser.create({
        data: {
          email: 'admin@pontoonline.com',
          name: 'João Carlos',
          passwordHash: hashedPassword,
          roleId: adminRole.id,
          isActive: true,
        },
      });

      return {
        message: 'Seed completed successfully!',
        roles: { admin: adminRole.id, manager: managerRole.id, viewer: viewerRole.id },
        permissions: permissions.length,
        user: { email: adminUser.email, name: adminUser.name, role: 'admin' },
        login: { email: 'admin@pontoonline.com', password: 'Admin@2026' },
      };
    } catch (error) {
      return {
        message: 'Seed failed',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      };
    }
  }
}
