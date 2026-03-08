/**
 * Migrate punches and timesheets from old employee IDs to new (updated) employee IDs.
 * Uses raw SQL for maximum compatibility.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAPPING = [
  ['cmmh29yp30059bz9p0zcu9ftn', 'cmmh3hqb70xn6gw0wqjwfuv7y', 'MARIA VILANEIDE'],
  ['cmmh29xql0047bz9p07dyq3mp', 'cmmh3hq900xn4gw0wfou371lj', 'MARCOS VINICIUS'],
  ['cmmh29zg10063bz9pu8p89ent', 'cmmh3hq6z0xn2gw0wh7hlsipp', 'JOSENILTON BARBALHO'],
  ['cmmh2a08p006zbz9pgg70c6bf', 'cmmh3hq4y0xn0gw0w674z4wh7', 'JOSE LEUDOMAR'],
  ['cmmh2a01g006rbz9px6efy5il', 'cmmh3hq2n0xmygw0wseb0zse4', 'JOCELIO BEZERRA'],
  ['cmmh29ywl005hbz9pk4lvy25b', 'cmmh3hq0i0xmwgw0wkg7izpcj', 'JOAO VITOR'],
  ['cmmh29yht0051bz9prr3pi0b1', 'cmmh3hpyd0xmugw0wixtbnfeb', 'THIAGO PEREIRA'],
  ['cmmh29yun005fbz9prd50t65g', 'cmmh3hpwf0xmsgw0wjufmae43', 'LUAN'],
  ['cmmh29yjl0053bz9pws1a67eg', 'cmmh3hpuj0xmqgw0wtss4hmfc', 'FRANCISCI ISAC'],
  ['cmmh2a2ap0099bz9pawsa338m', 'cmmh3hpso0xmogw0wj1rjpzwu', 'CANINDE CHAVES'],
  ['cmmh2a2k5009jbz9p8wzz1mkm', 'cmmh3hpqt0xmmgw0wkdtx9rpd', 'F ARTHUR LOPES'],
  ['cmmh29zch005zbz9p5owtjgo1', 'cmmh3hpow0xmkgw0w3ls1en7x', 'ANTONIO MARCOS'],
  ['cmmh29yli0055bz9plq51a4kf', 'cmmh3hpmu0xmigw0w9urwqrpd', 'FRANCISCO EVERTON'],
  ['cmmh2a1ci0087bz9puge9tlpa', 'cmmh3hpkv0xmggw0wkwjd7bqu', 'ERIDAN PEREIRA'],
  ['cmmh29zhv0065bz9p4fs1tjev', 'cmmh3hpj20xmegw0wvtyour9i', 'DORIAN DIMAS'],
  ['cmmh29xbz003rbz9pb7ov8x58', 'cmmh3hph00xmcgw0wobsuj8km', 'CICERO UBIRATAN'],
  ['cmmh2a0c80073bz9p67l0bxuy', 'cmmh3hpf10xmagw0wtnpkpzjs', 'AMANDA CARVALHO'],
];

async function main() {
  console.log('=== Employee Punch Migration (Raw SQL) ===');

  for (const [oldId, newId, name] of MAPPING) {
    try {
      // Check count first
      const countResult = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM "NormalizedPunch" WHERE "employeeId" = $1`,
        oldId
      );
      const punchCount = Number(countResult[0]?.cnt || 0);

      if (punchCount === 0) {
        console.log(`  SKIP: ${name} (already migrated)`);
        continue;
      }

      // Migrate punches
      await prisma.$executeRawUnsafe(
        `UPDATE "NormalizedPunch" SET "employeeId" = $1 WHERE "employeeId" = $2`,
        newId, oldId
      );

      // Migrate timesheets
      await prisma.$executeRawUnsafe(
        `UPDATE "Timesheet" SET "employeeId" = $1 WHERE "employeeId" = $2`,
        newId, oldId
      );

      // Deactivate old employee
      await prisma.$executeRawUnsafe(
        `UPDATE "Employee" SET "isActive" = false WHERE "id" = $1`,
        oldId
      );

      console.log(`  MIGRATED: ${name} (${punchCount} punches)`);
    } catch (err) {
      console.error(`  ERROR: ${name}: ${err.message}`);
    }
  }

  console.log('=== Migration Complete ===');
}

main()
  .catch(e => {
    console.error('Migration error:', e.message);
  })
  .finally(() => prisma.$disconnect());
