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

    // Create permissions
    const permissionCodes = [
      { code: 'admin.full', name: 'Full Admin Access', description: 'Complete system access' },
      { code: 'employees.read', name: 'View Employees', description: 'Can view employees' },
      { code: 'employees.write', name: 'Manage Employees', description: 'Can create/edit employees' },
      { code: 'punches.read', name: 'View Punches', description: 'Can view punch records' },
      { code: 'punches.write', name: 'Manage Punches', description: 'Can adjust punches' },
      { code: 'timesheets.read', name: 'View Timesheets', description: 'Can view timesheets' },
      { code: 'timesheets.write', name: 'Manage Timesheets', description: 'Can process timesheets' },
      { code: 'devices.read', name: 'View Devices', description: 'Can view devices' },
      { code: 'devices.write', name: 'Manage Devices', description: 'Can configure devices' },
      { code: 'reports.read', name: 'View Reports', description: 'Can generate reports' },
      { code: 'audit.read', name: 'View Audit Log', description: 'Can view audit trail' },
    ];

    const permissions = [];
    for (const p of permissionCodes) {
      const perm = await this.prisma.permission.create({ data: p });
      permissions.push(perm);
    }

    // Create admin role
    const adminRole = await this.prisma.role.create({
      data: {
        name: 'admin',
        description: 'System Administrator - full access',
      },
    });

    // Create manager role
    const managerRole = await this.prisma.role.create({
      data: {
        name: 'manager',
        description: 'Branch Manager - can manage employees and timesheets',
      },
    });

    // Create viewer role
    const viewerRole = await this.prisma.role.create({
      data: {
        name: 'viewer',
        description: 'Read-only access to reports and timesheets',
      },
    });

    // Assign all permissions to admin
    for (const perm of permissions) {
      await this.prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Assign limited permissions to manager
    const managerPerms = permissions.filter(p =>
      ['employees.read', 'employees.write', 'punches.read', 'punches.write',
       'timesheets.read', 'timesheets.write', 'reports.read'].includes(p.code)
    );
    for (const perm of managerPerms) {
      await this.prisma.rolePermission.create({
        data: {
          roleId: managerRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Assign read permissions to viewer
    const viewerPerms = permissions.filter(p =>
      ['punches.read', 'timesheets.read', 'reports.read'].includes(p.code)
    );
    for (const perm of viewerPerms) {
      await this.prisma.rolePermission.create({
        data: {
          roleId: viewerRole.id,
          permissionId: perm.id,
        },
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
      message: 'Database seeded successfully',
      roles: [
        { id: adminRole.id, name: 'admin' },
        { id: managerRole.id, name: 'manager' },
        { id: viewerRole.id, name: 'viewer' },
      ],
      permissions: permissions.length,
      user: {
        email: adminUser.email,
        name: adminUser.name,
        role: 'admin',
        password: 'Admin@2026',
      },
    };
  }
}
