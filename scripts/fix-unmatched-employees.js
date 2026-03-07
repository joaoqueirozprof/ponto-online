const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapping: Secullum data -> DB employee ID
// These were unmatched due to name differences (truncation, typos, abbreviations)
const fixes = [
  // Manual matches (confirmed)
  { id: "cmmgbun6a00dnmc4bkn34thcw", position: "AUXILIAR DE FATURAMENTO", department: "ESCRITORIO", schedule: "1" },  // Amanda/Amada Carvalho Aquino
  { id: "cmmgbuho100abmc4b0itagmgr", position: "AUXILIAR DE PRODUCAO", department: "FABRICA", schedule: "4" },  // Cicero Ubiratan De Souza
  { id: "cmmgbull800cpmc4bufw5qbf2", position: "AUXILIAR DE PRODUCAO", department: "FABRICA", schedule: "4" },  // Dorian Dimas Oliveira
  { id: "cmmgbup1c00ermc4bur6myanv", position: "AUXILIAR DE PRODUCAO", department: "FABRICA", schedule: "4" },  // Eridan Pereira Lemos
  { id: "cmmgbuh6t00a1mc4blp0gyi1l", position: "AUXILIAR DE PRODUCAO", department: "FABRICA", schedule: "4" },  // Francisco Marcio Pereira Lima
  { id: "cmmgbuhy000ahmc4bgu5042a7", position: "AUXILIAR DE PRODUCAO", department: "FABRICA", schedule: "4" },  // Salenio Guedes Da Silva Dos Santos
  { id: "cmmgbumsp00dfmc4b6msw20we", position: "OP. DE CAMARA FRIA", department: "LOJA FISICA", schedule: "6" },  // Francisco De Assis De Araujo
  { id: "cmmgbulok00crmc4bzw42w3ve", position: "AUXILIAR DE CONFERENTE", department: "LOJA FISICA", schedule: "11" },  // Joao Victor/Vitor De Oliveira Lima
  { id: "cmmgbuqza00fvmc4b44hia0dg", position: "OP. DE CAIXA", department: "LOJA FISICA", schedule: "16" },  // Karina Silva/Da Silva
  { id: "cmmgbuied00armc4ba9fm3234", position: "OP. DE CAMARA FRIA", department: "LOJA FISICA", schedule: "6" },  // Marcos Vinicius Do Nascimento Fernandes
  { id: "cmmgbuk4g00btmc4bv95o4d8o", position: "OP. DE CAIXA", department: "LOJA FISICA", schedule: "16" },  // Maria Vilaneide De Oliveira
  { id: "cmmgbuqb900fhmc4bhrksdqmu", position: "EMBALADOR", department: "LOJA FISICA", schedule: "2" },  // Severino Rodiberto/Rosiberto Da Costa
  { id: "cmmgbumzk00djmc4bb0bjfc20", position: "REPOSITOR", department: "LOJA FISICA", schedule: "6" },  // Jose Leudomar Ferreira Fernandes

  // Partial matches (high confidence)
  { id: "cmmgbujxz00bpmc4bnjbnfmlx", position: "AUXILIAR DE PRODUCAO", department: "FABRICA", schedule: "4" },  // Francisco Everton (dos Santos Chaves)
  { id: "cmmgbulb500cjmc4bvg6bfpj3", position: "CONFERENTE DE CARGA", department: "LOJA FISICA", schedule: "6" },  // Antonio Marcos (Silva Da Costa)
  { id: "cmmgburd100g3mc4b5wfkuqj0", position: "REPOSITOR", department: "LOJA FISICA", schedule: "11" },  // F Arthur Lopes Da Silva -> Francisco Arthur
  { id: "cmmgbujro00blmc4b7yem5tqk", position: "AUXILIAR DE DESCARGA", department: "LOJA FISICA", schedule: "3" },  // Thiago Pereira -> Francisco Thiago Do Nascimento Pereira
  { id: "cmmgbukhk00c1mc4bas5cmmbc", position: "EMBALADOR", department: "LOJA FISICA", schedule: "11" },  // Joao Vitor (Rodrigues Santos)
  { id: "cmmgbumm600dbmc4bgxymevit", position: "OP. DE CAMARA FRIA", department: "LOJA FISICA", schedule: "6" },  // Jocelio Bezerra (Da Costa)
  { id: "cmmgbulhz00cnmc4bpprjn1vi", position: "OP. DE CAMARA FRIA", department: "LOJA FISICA", schedule: "11" },  // Josenilton Barbalho (Da Silva)
];

// Remaining that need to be matched by looking at the DB more carefully:
// FRANCISCO CANINDE CHAVES DE QUEIROZ -> search DB for "Caninde"
// FRANCISCO ISAC GERONCIO DA SILVA -> search for "Francisci Isac" or "Isac"
// FRANCISCO LUAN DO NASCIMENTO BATISTA -> search for "Luan"

async function main() {
  console.log('=== FIX UNMATCHED EMPLOYEES ===\n');

  // Get main branch
  const mainBranch = await prisma.branch.findFirst({ where: { code: 'MTZ-001' } });
  const atacBranch = await prisma.branch.findFirst({ where: { code: 'ATAC-001' } });

  if (!mainBranch) {
    console.log('ERROR: Main branch not found');
    return;
  }

  // Get all schedules
  const schedules = await prisma.workSchedule.findMany();
  const scheduleMap = {};
  for (const s of schedules) {
    const codeMatch = s.name.match(/^(\d+)/);
    if (codeMatch) {
      const code = codeMatch[1];
      if (!scheduleMap[code]) scheduleMap[code] = {};
      scheduleMap[code][s.branchId] = s.id;
    }
  }

  // Try to find remaining unmatched by searching DB
  const searchTerms = [
    { search: 'Caninde', secullum: 'FRANCISCO CANINDE CHAVES DE QUEIROZ', position: 'OP. DE CAMARA FRIA', department: 'LOJA FISICA', schedule: '3', company: 'ATACADISTA' },
    { search: 'Isac', secullum: 'FRANCISCO ISAC GERONCIO DA SILVA', position: 'REPOSITOR', department: 'LOJA FISICA', schedule: '11', company: 'ATACADISTA' },
    { search: 'Luan', secullum: 'FRANCISCO LUAN DO NASCIMENTO BATISTA', position: 'EMBALADOR', department: 'LOJA FISICA', schedule: '11', company: 'ATACADISTA' },
  ];

  for (const term of searchTerms) {
    const found = await prisma.employee.findFirst({
      where: {
        name: { contains: term.search, mode: 'insensitive' },
        scheduleId: null
      }
    });
    if (found) {
      console.log(`Found ${term.secullum} -> ${found.name} (${found.id})`);
      const branchId = term.company === 'ATACADISTA' ? (atacBranch?.id || mainBranch.id) : mainBranch.id;
      const scheduleId = scheduleMap[term.schedule]?.[branchId] || null;

      await prisma.employee.update({
        where: { id: found.id },
        data: {
          position: term.position,
          department: term.department,
          scheduleId: scheduleId,
          branchId: branchId,
        }
      });
      console.log(`  Updated: position=${term.position}, dept=${term.department}, schedule=${term.schedule}`);
    } else {
      console.log(`NOT FOUND: ${term.secullum} (search: ${term.search})`);
    }
  }

  // Process the fixes array
  let updated = 0;
  for (const fix of fixes) {
    const emp = await prisma.employee.findUnique({ where: { id: fix.id } });
    if (!emp) {
      console.log(`ID not found: ${fix.id}`);
      continue;
    }

    // Determine branch based on department
    const isIndustria = fix.department === 'FABRICA';
    const branchId = isIndustria ? mainBranch.id : (atacBranch?.id || mainBranch.id);

    // Find schedule
    const scheduleId = scheduleMap[fix.schedule]?.[branchId] || null;

    await prisma.employee.update({
      where: { id: fix.id },
      data: {
        position: fix.position,
        department: fix.department,
        scheduleId: scheduleId,
        branchId: branchId,
      }
    });
    console.log(`Updated: ${emp.name} -> pos=${fix.position}, dept=${fix.department}, sched=${fix.schedule}`);
    updated++;
  }

  // Final stats
  const total = await prisma.employee.count({ where: { status: 'ACTIVE' } });
  const withSchedule = await prisma.employee.count({ where: { status: 'ACTIVE', scheduleId: { not: null } } });

  console.log(`\n=== RESULTS ===`);
  console.log(`Fixed: ${updated} + search matches`);
  console.log(`Total active: ${total}`);
  console.log(`With schedule: ${withSchedule}`);
  console.log(`Without schedule: ${total - withSchedule}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
