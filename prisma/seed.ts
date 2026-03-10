import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Ponto Online v2 Multi-Tenant Seed...\n");

  // ============================================================
  // CLEAN UP (reverse dependency order)
  // ============================================================
  await prisma.afdExport.deleteMany({});
  await prisma.punchReceipt.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.calculationIssue.deleteMany({});
  await prisma.calculationRun.deleteMany({});
  await prisma.overtimeAdjustment.deleteMany({});
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

  // ============================================================
  // PLANS
  // ============================================================
  console.log("📦 Creating subscription plans...");

  const starterPlan = await prisma.plan.create({
    data: {
      name: "Starter",
      description: "Ideal para pequenas empresas com até 20 colaboradores",
      maxEmployees: 20,
      maxBranches: 1,
      maxDevices: 2,
      maxUsers: 3,
      features: { aiAssistant: false, apiAccess: false, customReports: false },
      priceMonthly: 9900, // R$ 99,00
      priceYearly: 99900, // R$ 999,00
      trialDays: 14,
    },
  });

  const professionalPlan = await prisma.plan.create({
    data: {
      name: "Professional",
      description: "Para empresas em crescimento com até 50 colaboradores",
      maxEmployees: 50,
      maxBranches: 3,
      maxDevices: 5,
      maxUsers: 10,
      features: { aiAssistant: true, apiAccess: false, customReports: true },
      priceMonthly: 19900, // R$ 199,00
      priceYearly: 199900, // R$ 1.999,00
      trialDays: 14,
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: "Enterprise",
      description: "Para grandes empresas sem limite de colaboradores",
      maxEmployees: 9999,
      maxBranches: 99,
      maxDevices: 99,
      maxUsers: 99,
      features: { aiAssistant: true, apiAccess: true, customReports: true },
      priceMonthly: 49900, // R$ 499,00
      priceYearly: 499900, // R$ 4.999,00
      trialDays: 30,
    },
  });

  // ============================================================
  // PERMISSIONS (organized by module)
  // ============================================================
  console.log("🔑 Creating permissions...");

  const permData = [
    // Admin
    { code: "admin.all", description: "Acesso total ao sistema", module: "admin" },
    { code: "admin.companies", description: "Gerenciar empresas (Super Admin)", module: "admin" },
    { code: "admin.billing", description: "Gerenciar assinaturas e cobranças", module: "admin" },
    { code: "admin.support_access", description: "Acesso suporte a dados de clientes", module: "admin" },
    // Users
    { code: "users.view", description: "Visualizar usuários do sistema", module: "users" },
    { code: "users.create", description: "Criar usuários do sistema", module: "users" },
    { code: "users.edit", description: "Editar usuários do sistema", module: "users" },
    { code: "users.delete", description: "Excluir usuários do sistema", module: "users" },
    // Employees
    { code: "employees.view", description: "Visualizar colaboradores", module: "employees" },
    { code: "employees.create", description: "Cadastrar colaboradores", module: "employees" },
    { code: "employees.edit", description: "Editar colaboradores", module: "employees" },
    { code: "employees.delete", description: "Excluir colaboradores", module: "employees" },
    // Punches
    { code: "punches.view", description: "Visualizar registros de ponto", module: "punches" },
    { code: "punches.adjust", description: "Ajustar registros de ponto", module: "punches" },
    { code: "punches.export", description: "Exportar AFD/AEJ", module: "punches" },
    // Timesheets
    { code: "timesheets.view", description: "Visualizar folhas de ponto", module: "timesheets" },
    { code: "timesheets.approve", description: "Aprovar folhas de ponto", module: "timesheets" },
    // Devices
    { code: "devices.manage", description: "Gerenciar dispositivos", module: "devices" },
    // Reports
    { code: "reports.view", description: "Visualizar relatórios", module: "reports" },
    { code: "reports.export", description: "Exportar relatórios", module: "reports" },
    // Schedules
    { code: "schedules.view", description: "Visualizar escalas", module: "schedules" },
    { code: "schedules.manage", description: "Gerenciar escalas", module: "schedules" },
    // Billing (company level)
    { code: "billing.view", description: "Visualizar assinatura e faturas", module: "billing" },
    { code: "billing.manage", description: "Gerenciar assinatura", module: "billing" },
    // Company settings
    { code: "company.settings", description: "Configurações da empresa", module: "company" },
  ];

  const permissions = await Promise.all(
    permData.map((p) => prisma.permission.create({ data: p }))
  );

  const perm = (code: string) => permissions.find((p) => p.code === code)!;

  // ============================================================
  // ROLES
  // ============================================================
  console.log("👥 Creating roles...");

  // SUPER_ADMIN - Platform owner (João)
  const superAdminRole = await prisma.role.create({
    data: {
      name: "SUPER_ADMIN",
      description: "Administrador da plataforma - acesso total",
      isSystem: true,
      rolePermissions: {
        create: permissions.map((p) => ({ permissionId: p.id })),
      },
    },
  });

  // COMPANY_ADMIN - Company owner/admin
  const companyAdminRole = await prisma.role.create({
    data: {
      name: "COMPANY_ADMIN",
      description: "Administrador da empresa - acesso total à empresa",
      isSystem: false,
      rolePermissions: {
        create: permissions
          .filter((p) => !p.code.startsWith("admin."))
          .map((p) => ({ permissionId: p.id })),
      },
    },
  });

  // MANAGER - Branch manager
  const managerRole = await prisma.role.create({
    data: {
      name: "MANAGER",
      description: "Gestor de filial - gerencia colaboradores e ponto",
      isSystem: false,
      rolePermissions: {
        create: [
          perm("employees.view"), perm("employees.create"), perm("employees.edit"),
          perm("punches.view"), perm("punches.adjust"),
          perm("timesheets.view"), perm("timesheets.approve"),
          perm("reports.view"),
          perm("schedules.view"), perm("schedules.manage"),
          perm("devices.manage"),
        ].map((p) => ({ permissionId: p.id })),
      },
    },
  });

  // HR - Human Resources
  const hrRole = await prisma.role.create({
    data: {
      name: "HR",
      description: "Recursos Humanos - visualiza relatórios e folhas de ponto",
      isSystem: false,
      rolePermissions: {
        create: [
          perm("employees.view"),
          perm("punches.view"), perm("punches.export"),
          perm("timesheets.view"),
          perm("reports.view"), perm("reports.export"),
          perm("schedules.view"),
        ].map((p) => ({ permissionId: p.id })),
      },
    },
  });

  // VIEWER - Read only
  const viewerRole = await prisma.role.create({
    data: {
      name: "VIEWER",
      description: "Somente leitura",
      isSystem: false,
      rolePermissions: {
        create: [
          perm("employees.view"),
          perm("punches.view"),
          perm("timesheets.view"),
          perm("reports.view"),
        ].map((p) => ({ permissionId: p.id })),
      },
    },
  });

  // ============================================================
  // SUPER ADMIN USER (João - Platform Owner)
  // ============================================================
  console.log("🔐 Creating Super Admin user...");

  const superAdmin = await prisma.systemUser.create({
    data: {
      email: "admin@pontoonline.com",
      passwordHash: await bcrypt.hash("Admin@2026", 12),
      name: "João Carlos",
      roleId: superAdminRole.id,
      companyId: null, // Super admin has no company - sees all
      branchId: null,
      isActive: true,
      isSuperAdmin: true,
    },
  });

  // ============================================================
  // DEMO COMPANY 1 - Tech Solutions
  // ============================================================
  console.log("🏢 Creating demo company: Tech Solutions...");

  const company1 = await prisma.company.create({
    data: {
      name: "Tech Solutions LTDA",
      cnpj: "12.345.678/0001-90",
      address: "Rua das Flores, 100, São Paulo, SP",
      phone: "(11) 98765-4321",
      email: "contato@techsolutions.com.br",
      dpoName: "Carlos Responsável",
      dpoEmail: "dpo@techsolutions.com.br",
    },
  });

  // Subscription for company 1
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  await prisma.subscription.create({
    data: {
      companyId: company1.id,
      planId: professionalPlan.id,
      status: "TRIAL",
      trialEndsAt: trialEnd,
    },
  });

  // Branch
  const branch1 = await prisma.branch.create({
    data: {
      companyId: company1.id,
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
      companyId: company1.id,
      name: "Filial Rio de Janeiro",
      code: "RJ-001",
      address: "Avenida Copacabana, 500, Rio de Janeiro, RJ",
      phone: "(21) 3000-0002",
      timezone: "America/Sao_Paulo",
      toleranceMinutes: 5,
    },
  });

  // Company admin user
  const companyAdmin1 = await prisma.systemUser.create({
    data: {
      email: "admin@techsolutions.com.br",
      passwordHash: await bcrypt.hash("Admin@123456", 12),
      name: "Administrator",
      roleId: companyAdminRole.id,
      companyId: company1.id,
      branchId: branch1.id,
      isActive: true,
    },
  });

  // Manager user
  const manager1 = await prisma.systemUser.create({
    data: {
      email: "manager@techsolutions.com.br",
      passwordHash: await bcrypt.hash("Manager@123456", 12),
      name: "Branch Manager",
      roleId: managerRole.id,
      companyId: company1.id,
      branchId: branch1.id,
      isActive: true,
    },
  });

  // HR user
  const hr1 = await prisma.systemUser.create({
    data: {
      email: "rh@techsolutions.com.br",
      passwordHash: await bcrypt.hash("RH@123456", 12),
      name: "Maria RH",
      roleId: hrRole.id,
      companyId: company1.id,
      branchId: branch1.id,
      isActive: true,
    },
  });

  // Work schedule
  const schedule = await prisma.workSchedule.create({
    data: {
      branchId: branch1.id,
      name: "Segunda a Sexta 8h",
      type: "FIXED",
      weeklyHours: 40,
      description: "Jornada de trabalho de segunda a sexta, 08h diárias",
      scheduleEntries: {
        create: [
          { dayOfWeek: 1, startTime: "08:00", endTime: "17:00", breakStartTime: "12:00", breakEndTime: "13:00", breakMinutes: 60, isWorkDay: true },
          { dayOfWeek: 2, startTime: "08:00", endTime: "17:00", breakStartTime: "12:00", breakEndTime: "13:00", breakMinutes: 60, isWorkDay: true },
          { dayOfWeek: 3, startTime: "08:00", endTime: "17:00", breakStartTime: "12:00", breakEndTime: "13:00", breakMinutes: 60, isWorkDay: true },
          { dayOfWeek: 4, startTime: "08:00", endTime: "17:00", breakStartTime: "12:00", breakEndTime: "13:00", breakMinutes: 60, isWorkDay: true },
          { dayOfWeek: 5, startTime: "08:00", endTime: "17:00", breakStartTime: "12:00", breakEndTime: "13:00", breakMinutes: 60, isWorkDay: true },
          { dayOfWeek: 6, startTime: "00:00", endTime: "00:00", isWorkDay: false },
          { dayOfWeek: 0, startTime: "00:00", endTime: "00:00", isWorkDay: false },
        ],
      },
    },
  });

  // Device
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

  // Employees
  await Promise.all([
    prisma.employee.create({
      data: {
        branchId: branch1.id, name: "João da Silva", cpf: "12345678901", pis: "123456789",
        registration: "001", email: "joao.silva@techsolutions.com.br", phone: "(11) 98765-1234",
        position: "Desenvolvedor", department: "Tecnologia", scheduleId: schedule.id,
        admissionDate: new Date("2022-01-15"), isActive: true, deviceUserId: "device_001",
      },
    }),
    prisma.employee.create({
      data: {
        branchId: branch1.id, name: "Maria dos Santos", cpf: "98765432101", pis: "987654321",
        registration: "002", email: "maria.santos@techsolutions.com.br", phone: "(11) 98765-5678",
        position: "Analista de Sistemas", department: "Tecnologia", scheduleId: schedule.id,
        admissionDate: new Date("2021-06-20"), isActive: true, deviceUserId: "device_002",
      },
    }),
    prisma.employee.create({
      data: {
        branchId: branch1.id, name: "Pedro Oliveira", cpf: "55555555555", pis: "555555555",
        registration: "003", email: "pedro.oliveira@techsolutions.com.br", phone: "(11) 98765-9012",
        position: "Designer", department: "Design", scheduleId: schedule.id,
        admissionDate: new Date("2023-03-10"), isActive: true, deviceUserId: "device_003",
      },
    }),
  ]);

  // Holiday
  await prisma.holiday.create({
    data: {
      branchId: branch1.id,
      date: new Date("2026-09-07"),
      name: "Independência do Brasil",
      type: "NATIONAL",
    },
  });

  // ============================================================
  // DEMO COMPANY 2 - Comercial Brasil
  // ============================================================
  console.log("🏢 Creating demo company: Comercial Brasil...");

  const company2 = await prisma.company.create({
    data: {
      name: "Comercial Brasil LTDA",
      cnpj: "98.765.432/0001-10",
      address: "Av. Brasil, 500, Recife, PE",
      phone: "(81) 3333-4444",
      email: "contato@comercialbrasil.com.br",
    },
  });

  await prisma.subscription.create({
    data: {
      companyId: company2.id,
      planId: starterPlan.id,
      status: "TRIAL",
      trialEndsAt: trialEnd,
    },
  });

  const branch3 = await prisma.branch.create({
    data: {
      companyId: company2.id,
      name: "Sede Recife",
      code: "PE-001",
      address: "Av. Boa Viagem, 200, Recife, PE",
      phone: "(81) 3333-5555",
      timezone: "America/Recife",
      toleranceMinutes: 10,
    },
  });

  await prisma.systemUser.create({
    data: {
      email: "admin@comercialbrasil.com.br",
      passwordHash: await bcrypt.hash("Admin@123456", 12),
      name: "Roberto Administrador",
      roleId: companyAdminRole.id,
      companyId: company2.id,
      branchId: branch3.id,
      isActive: true,
    },
  });

  const schedule2 = await prisma.workSchedule.create({
    data: {
      branchId: branch3.id,
      name: "Comercial 44h",
      type: "FIXED",
      weeklyHours: 44,
      description: "Jornada comercial 44h semanais",
      scheduleEntries: {
        create: [
          { dayOfWeek: 1, startTime: "08:00", endTime: "18:00", breakStartTime: "12:00", breakEndTime: "14:00", breakMinutes: 120, isWorkDay: true },
          { dayOfWeek: 2, startTime: "08:00", endTime: "18:00", breakStartTime: "12:00", breakEndTime: "14:00", breakMinutes: 120, isWorkDay: true },
          { dayOfWeek: 3, startTime: "08:00", endTime: "18:00", breakStartTime: "12:00", breakEndTime: "14:00", breakMinutes: 120, isWorkDay: true },
          { dayOfWeek: 4, startTime: "08:00", endTime: "18:00", breakStartTime: "12:00", breakEndTime: "14:00", breakMinutes: 120, isWorkDay: true },
          { dayOfWeek: 5, startTime: "08:00", endTime: "18:00", breakStartTime: "12:00", breakEndTime: "14:00", breakMinutes: 120, isWorkDay: true },
          { dayOfWeek: 6, startTime: "08:00", endTime: "12:00", isWorkDay: true },
          { dayOfWeek: 0, startTime: "00:00", endTime: "00:00", isWorkDay: false },
        ],
      },
    },
  });

  await Promise.all([
    prisma.employee.create({
      data: {
        branchId: branch3.id, name: "Ana Costa", cpf: "11122233344", pis: "111222333",
        registration: "001", email: "ana@comercialbrasil.com.br", position: "Vendedora",
        department: "Vendas", scheduleId: schedule2.id, admissionDate: new Date("2024-01-10"),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        branchId: branch3.id, name: "Bruno Ferreira", cpf: "44455566677", pis: "444555666",
        registration: "002", email: "bruno@comercialbrasil.com.br", position: "Estoquista",
        department: "Logística", scheduleId: schedule2.id, admissionDate: new Date("2024-03-15"),
        isActive: true,
      },
    }),
  ]);

  // ============================================================
  // DONE
  // ============================================================
  console.log(`
✅ Seed completed successfully!

📊 Summary:
  - 3 Plans: Starter (R$99), Professional (R$199), Enterprise (R$499)
  - 25 Permissions across 9 modules
  - 5 Roles: SUPER_ADMIN, COMPANY_ADMIN, MANAGER, HR, VIEWER
  - 2 Companies with subscriptions (trial)
  - 3 Branches across both companies
  - 5 Employees across both companies
  - 5 System Users

🔐 Login Credentials:
  Super Admin:       admin@pontoonline.com / Admin@2026
  Company 1 Admin:   admin@techsolutions.com.br / Admin@123456
  Company 1 Manager: manager@techsolutions.com.br / Manager@123456
  Company 1 HR:      rh@techsolutions.com.br / RH@123456
  Company 2 Admin:   admin@comercialbrasil.com.br / Admin@123456
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
