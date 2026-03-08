/**
 * Migrate punches and timesheets from old employee IDs to new (updated) employee IDs.
 * The 17 employees with cmmh3h prefix are the updated versions with full names.
 * Their punches are currently linked to the old IDs (cmmh2a/cmmh29 prefix).
 * This script runs once and is idempotent (safe to re-run).
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MAPPING = [
  { oldId: 'cmmh29yp30059bz9p0zcu9ftn', newId: 'cmmh3hqb70xn6gw0wqjwfuv7y', oldName: 'MARIA VILANEIDE', newName: 'MARIA VILANEIDE DE OLIVEIRA' },
  { oldId: 'cmmh29xql0047bz9p07dyq3mp', newId: 'cmmh3hq900xn4gw0wfou371lj', oldName: 'MARCOS VINICIUS DO NASCIMENTO', newName: 'MARCOS VINICIUS DO NASCIMENTO FERNANDES' },
  { oldId: 'cmmh29zg10063bz9pu8p89ent', newId: 'cmmh3hq6z0xn2gw0wh7hlsipp', oldName: 'JOSENILTON BARBALHO', newName: 'JOSENILTON BARBALHO DA SILVA' },
  { oldId: 'cmmh2a08p006zbz9pgg70c6bf', newId: 'cmmh3hq4y0xn0gw0w674z4wh7', oldName: 'JOSE LEUDOMAR', newName: 'JOSE LEUDOMAR FERREIRA FERNANDES' },
  { oldId: 'cmmh2a01g006rbz9px6efy5il', newId: 'cmmh3hq2n0xmygw0wseb0zse4', oldName: 'JOCELIO BEZERRA', newName: 'JOCELIO BEZERRA DA COSTA' },
  { oldId: 'cmmh29ywl005hbz9pk4lvy25b', newId: 'cmmh3hq0i0xmwgw0wkg7izpcj', oldName: 'JOAO VITOR', newName: 'JOAO VITOR RODRIGUES SANTOS' },
  { oldId: 'cmmh29yht0051bz9prr3pi0b1', newId: 'cmmh3hpyd0xmugw0wixtbnfeb', oldName: 'THIAGO PEREIRA', newName: 'FRANCISCO THIAGO DO NASCIMENTO PEREIRA' },
  { oldId: 'cmmh29yun005fbz9prd50t65g', newId: 'cmmh3hpwf0xmsgw0wjufmae43', oldName: 'LUAN', newName: 'FRANCISCO LUAN DO NASCIMENTO BATISTA' },
  { oldId: 'cmmh29yjl0053bz9pws1a67eg', newId: 'cmmh3hpuj0xmqgw0wtss4hmfc', oldName: 'FRANCISCI ISAC', newName: 'FRANCISCO ISAC GERONCIO DA SILVA' },
  { oldId: 'cmmh2a2ap0099bz9pawsa338m', newId: 'cmmh3hpso0xmogw0wj1rjpzwu', oldName: 'CANINDE CHAVES', newName: 'FRANCISCO CANINDE CHAVES DE QUEIROZ' },
  { oldId: 'cmmh2a2k5009jbz9p8wzz1mkm', newId: 'cmmh3hpqt0xmmgw0wkdtx9rpd', oldName: 'F ARTHUR LOPES DA SILVA', newName: 'FRANCISCO ARTHUR LOPES DA SILVA' },
  { oldId: 'cmmh29zch005zbz9p5owtjgo1', newId: 'cmmh3hpow0xmkgw0w3ls1en7x', oldName: 'ANTONIO MARCOS', newName: 'ANTONIO MARCOS SILVA DA COSTA' },
  { oldId: 'cmmh29yli0055bz9plq51a4kf', newId: 'cmmh3hpmu0xmigw0w9urwqrpd', oldName: 'FRANCISCO EVERTON', newName: 'FRANCISCO EVERTON DOS SANTOS CHAVES' },
  { oldId: 'cmmh2a1ci0087bz9puge9tlpa', newId: 'cmmh3hpkv0xmggw0wkwjd7bqu', oldName: 'ERIDAN PEREIRA', newName: 'ERIDAN PEREIRA LEMOS' },
  { oldId: 'cmmh29zhv0065bz9p4fs1tjev', newId: 'cmmh3hpj20xmegw0wvtyour9i', oldName: 'DORIAN DIMAS', newName: 'DORIAN DIMAS OLIVEIRA' },
  { oldId: 'cmmh29xbz003rbz9pb7ov8x58', newId: 'cmmh3hph00xmcgw0wobsuj8km', oldName: 'CICERO UBIRATAN DE SOUZ', newName: 'CICERO UBIRATAN DE SOUZA' },
  { oldId: 'cmmh2a0c80073bz9p67l0bxuy', newId: 'cmmh3hpf10xmagw0wtnpkpzjs', oldName: 'AMADA DE CARVALHO AQUINO', newName: 'AMANDA CARVALHO AQUINO' },
];

async function main() {
  console.log('=== Employee Punch Migration ===');
  console.log(`Processing ${MAPPING.length} employee mappings...`);

  let totalPunchesMigrated = 0;
  let totalTimesheetsMigrated = 0;

  for (const { oldId, newId, oldName, newName } of MAPPING) {
    // Check if old employee still has punches (idempotent check)
    const punchCount = await prisma.normalizedPunch.count({ where: { employeeId: oldId } });
    const timesheetCount = await prisma.timesheet.count({ where: { employeeId: oldId } });

    if (punchCount === 0 && timesheetCount === 0) {
      console.log(`  SKIP: ${oldName} -> ${newName} (already migrated, 0 records)`);
      continue;
    }

    console.log(`  MIGRATE: ${oldName} (${punchCount} punches, ${timesheetCount} timesheets) -> ${newName}`);

    // Migrate punches
    if (punchCount > 0) {
      await prisma.normalizedPunch.updateMany({
        where: { employeeId: oldId },
        data: { employeeId: newId },
      });
      totalPunchesMigrated += punchCount;
    }

    // Migrate timesheets
    if (timesheetCount > 0) {
      await prisma.timesheet.updateMany({
        where: { employeeId: oldId },
        data: { employeeId: newId },
      });
      totalTimesheetsMigrated += timesheetCount;
    }

    // Deactivate old employee
    await prisma.employee.update({
      where: { id: oldId },
      data: { isActive: false },
    });
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Punches migrated: ${totalPunchesMigrated}`);
  console.log(`Timesheets migrated: ${totalTimesheetsMigrated}`);
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
