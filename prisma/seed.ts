import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Delete existing data
  await prisma.auditLog.deleteMany({});
  await prisma.calculationIssue.deleteMany({});
  await prisma.calculationRun.deleteMany({});
  await prisma.punchAdjustment.deleteMany({});
  await prisma.timeBalance.deleteMany({});
  await prisma.timesheetDay.deleteMany({});
  await prisma.timesheet.deleteMany({});
  await prisma.normalizedPunch.deleteMany({});
  await prisma.rawPunchEvent.deleteMany({});
  await prisma.deviceSyncLog.deleteMany({});
  await prisma.scheduleEntry.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.workSchedule.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.systemUser.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.company.deleteMany({});

  // Create permissions
  const permissions = await Promise.all([
    prisma.permission.create({
      data: {
        code: "users.view",
        description: "View system users",
      },
    }),
    prisma.permission.create({
      data: {
        code: "users.create",
        description: "Create system users",
      },
    }),
    prisma.permission.create({
      data: {
        code: "users.edit",
        description: "Edit system users",
      },
    }),
    prisma.permission.create({
      data: {
        code: "users.delete",
        description: "Delete system users",
      },
    }),
    prisma.permission.create({
      data: {
        code: "employees.view",
        description: "View employees",
      },
    }),
    prisma.permission.create({
      data: {
        code: "employees.create",
        description: "Create employees",
      },
    }),
    prisma.permission.create({
      data: {
        code: "employees.edit",
        description: "Edit employees",
      },
    }),
    prisma.permission.create({
      data: {
        code: "employees.delete",
        description: "Delete employees",
      },
    }),
    prisma.permission.create({
      data: {
        code: "punches.view",
        description: "View punch records",
      },
    }),
    prisma.permission.create({
      data: {
        code: "punches.adjust",
        description: "Adjust punch records",
      },
    }),
    prisma.permission.create({
      data: {
        code: "timesheets.view",
        description: "View timesheets",
      },
    }),
    prisma.permission.create({
      data: {
        code: "timesheets.approve",
        description: "Approve timesheets",
      },
    }),
    prisma.permission.create({
      data: {
        code: "devices.manage",
        description: "Manage devices",
      },
    }),
    prisma.permission.create({
      data: {
        code: "reports.view",
        description: "View reports",
      },
    }),
    prisma.permission.create({
      data: {
        code: "admin.all",
        description: "Full system access",
      },
    }),
  ]);

  // Create roles
  const adminRole = await prisma.role.create({
    data: {
      name: "Administrator",
      description: "Full system access",
      rolePermissions: {
        create: permissions.map((p) => ({
          permissionId: p.id,
        })),
      },
    },
    include: {
      rolePermissions: true,
    },
  });

  const managerRole = await prisma.role.create({
    data: {
      name: "Manager",
      description: "Branch management and reporting",
      rolePermissions: {
        create: [
          { permissionId: permissions.find((p) => p.code === "employees.view")!.id },
          { permissionId: permissions.find((p) => p.code === "employees.create")!.id },
          { permissionId: permissions.find((p) => p.code === "employees.edit")!.id },
          { permissionId: permissions.find((p) => p.code === "punches.view")!.id },
          { permissionId: permissions.find((p) => p.code === "punches.adjust")!.id },
          { permissionId: permissions.find((p) => p.code === "timesheets.view")!.id },
          { permissionId: permissions.find((p) => p.code === "timesheets.approve")!.id },
          { permissionId: permissions.find((p) => p.code === "reports.view")!.id },
        ],
      },
    },
  });

  const viewerRole = await prisma.role.create({
    data: {
      name: "Viewer",
      description: "Read-only access",
      rolePermissions: {
        create: [
          { permissionId: permissions.find((p) => p.code === "employees.view")!.id },
          { permissionId: permissions.find((p) => p.code === "punches.view")!.id },
          { permissionId: permissions.find((p) => p.code === "timesheets.view")!.id },
          { permissionId: permissions.find((p) => p.code === "reports.view")!.id },
        ],
      },
    },
  });

  // Create company
  const company = await prisma.company.create({
    data: {
      name: "Tech Solutions LTDA",
      cnpj: "12.345.678/0001-90",
      address: "Rua das Flores, 100, São Paulo, SP",
      phone: "(11) 98765-4321",
      email: "contato@techsolutions.com.br",
    },
  });

  // Create branches
  const branch1 = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: "Sede São Paulo",
      code: "SP-001",
      address: "Avenida Paulista, 1000, São Paulo, SP",
      phone: "(11) 3000-0001",
      timezone: "America/Sao_Paulo",
      toleranceMinutes: 5,
    },
  });

  const branch2 = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: "Filial Rio de Janeiro",
      code: "RJ-001",
      address: "Avenida Copacabana, 500, Rio de Janeiro, RJ",
      phone: "(21) 3000-0002",
      timezone: "America/Sao_Paulo",
      toleranceMinutes: 5,
    },
  });

  // Create admin user
  const adminUser = await prisma.systemUser.create({
    data: {
      email: "admin@techsolutions.com.br",
      passwordHash: await bcrypt.hash("Admin@123456", 10),
      name: "Administrator",
      roleId: adminRole.id,
      branchId: branch1.id,
      isActive: true,
    },
  });

  // Create manager user
  const managerUser = await prisma.systemUser.create({
    data: {
      email: "manager@techsolutions.com.br",
      passwordHash: await bcrypt.hash("Manager@123456", 10),
      name: "Branch Manager",
      roleId: managerRole.id,
      branchId: branch1.id,
      isActive: true,
    },
  });

  // Create work schedule
  const schedule = await prisma.workSchedule.create({
    data: {
      branchId: branch1.id,
      name: "Segunda a Sexta 8h",
      type: "FIXED",
      weeklyHours: 40,
      description: "Jornada de trabalho de segunda a sexta, 08h diárias",
      scheduleEntries: {
        create: [
          {
            dayOfWeek: 1,
            startTime: "08:00",
            endTime: "17:00",
            breakStartTime: "12:00",
            breakEndTime: "13:00",
            breakMinutes: 60,
            isWorkDay: true,
          },
          {
            dayOfWeek: 2,
            startTime: "08:00",
            endTime: "17:00",
            breakStartTime: "12:00",
            breakEndTime: "13:00",
            breakMinutes: 60,
            isWorkDay: true,
          },
          {
            dayOfWeek: 3,
            startTime: "08:00",
            endTime: "17:00",
            breakStartTime: "12:00",
            breakEndTime: "13:00",
            breakMinutes: 60,
            isWorkDay: true,
          },
          {
            dayOfWeek: 4,
            startTime: "08:00",
            endTime: "17:00",
            breakStartTime: "12:00",
            breakEndTime: "13:00",
            breakMinutes: 60,
            isWorkDay: true,
          },
          {
            dayOfWeek: 5,
            startTime: "08:00",
            endTime: "17:00",
            breakStartTime: "12:00",
            breakEndTime: "13:00",
            breakMinutes: 60,
            isWorkDay: true,
          },
          {
            dayOfWeek: 6,
            startTime: "00:00",
            endTime: "00:00",
            isWorkDay: false,
          },
          {
            dayOfWeek: 0,
            startTime: "00:00",
            endTime: "00:00",
            isWorkDay: false,
          },
        ],
      },
    },
  });

  // Create device
  const device = await prisma.device.create({
    data: {
      branchId: branch1.id,
      name: "Relogio Digital Entrada",
      model: "Control iD 7",
      serialNumber: "SN-2024-001",
      ipAddress: "192.168.1.100",
      port: 8080,
      login: "admin",
      encryptedPassword: "encrypted_password_here",
      isActive: true,
    },
  });

  // Create employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        branchId: branch1.id,
        name: "João da Silva",
        cpf: "12345678901",
        pis: "123456789",
        registration: "001",
        email: "joao.silva@techsolutions.com.br",
        phone: "(11) 98765-1234",
        position: "Desenvolvedor",
        department: "Tecnologia",
        scheduleId: schedule.id,
        admissionDate: new Date("2022-01-15"),
        isActive: true,
        deviceUserId: "device_001",
      },
    }),
    prisma.employee.create({
      data: {
        branchId: branch1.id,
        name: "Maria dos Santos",
        cpf: "98765432101",
        pis: "987654321",
        registration: "002",
        email: "maria.santos@techsolutions.com.br",
        phone: "(11) 98765-5678",
        position: "Analista de Sistemas",
        department: "Tecnologia",
        scheduleId: schedule.id,
        admissionDate: new Date("2021-06-20"),
        isActive: true,
        deviceUserId: "device_002",
      },
    }),
    prisma.employee.create({
      data: {
        branchId: branch1.id,
        name: "Pedro Oliveira",
        cpf: "55555555555",
        pis: "555555555",
        registration: "003",
        email: "pedro.oliveira@techsolutions.com.br",
        phone: "(11) 98765-9012",
        position: "Designer",
        department: "Design",
        scheduleId: schedule.id,
        admissionDate: new Date("2023-03-10"),
        isActive: true,
        deviceUserId: "device_003",
      },
    }),
  ]);

  // Create holiday
  await prisma.holiday.create({
    data: {
      branchId: branch1.id,
      date: new Date("2024-09-07"),
      name: "Independência do Brasil",
      type: "NATIONAL",
    },
  });

  console.log("Seed completed successfully!");
  console.log(`
Database seeded with:
- 1 Company: ${company.name}
- 2 Branches: ${branch1.name}, ${branch2.name}
- 3 Roles: Administrator, Manager, Viewer
- 3 System Users (1 admin, 1 manager, 1 viewer)
- 1 Work Schedule with 7 entries
- 1 Device
- 3 Employees
- 1 Holiday

Test Credentials:
- Admin: admin@techsolutions.com.br / Admin@123456
- Manager: manager@techsolutions.com.br / Manager@123456
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
