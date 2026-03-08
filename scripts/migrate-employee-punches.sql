-- Migration: Transfer NormalizedPunch records from old employee IDs to new (updated) employee IDs
-- The 17 employees with cmmh3h prefix are the updated versions with full names
-- Their punches are currently linked to the old IDs (cmmh2a/cmmh29 prefix)
-- NOTE: Timesheet migration removed to avoid unique constraint violations on (employeeId, month, year)
-- Reports now calculate from NormalizedPunch data directly, so Timesheet records are not needed.

-- 1. MARIA VILANEIDE -> MARIA VILANEIDE DE OLIVEIRA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hqb70xn6gw0wqjwfuv7y' WHERE "employeeId" = 'cmmh29yp30059bz9p0zcu9ftn';

-- 2. MARCOS VINICIUS DO NASCIMENTO -> MARCOS VINICIUS DO NASCIMENTO FERNANDES
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hq900xn4gw0wfou371lj' WHERE "employeeId" = 'cmmh29xql0047bz9p07dyq3mp';

-- 3. JOSENILTON BARBALHO -> JOSENILTON BARBALHO DA SILVA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hq6z0xn2gw0wh7hlsipp' WHERE "employeeId" = 'cmmh29zg10063bz9pu8p89ent';

-- 4. JOSE LEUDOMAR -> JOSE LEUDOMAR FERREIRA FERNANDES
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hq4y0xn0gw0w674z4wh7' WHERE "employeeId" = 'cmmh2a08p006zbz9pgg70c6bf';

-- 5. JOCELIO BEZERRA -> JOCELIO BEZERRA DA COSTA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hq2n0xmygw0wseb0zse4' WHERE "employeeId" = 'cmmh2a01g006rbz9px6efy5il';

-- 6. JOAO VITOR -> JOAO VITOR RODRIGUES SANTOS
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hq0i0xmwgw0wkg7izpcj' WHERE "employeeId" = 'cmmh29ywl005hbz9pk4lvy25b';

-- 7. THIAGO PEREIRA -> FRANCISCO THIAGO DO NASCIMENTO PEREIRA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpyd0xmugw0wixtbnfeb' WHERE "employeeId" = 'cmmh29yht0051bz9prr3pi0b1';

-- 8. LUAN -> FRANCISCO LUAN DO NASCIMENTO BATISTA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpwf0xmsgw0wjufmae43' WHERE "employeeId" = 'cmmh29yun005fbz9prd50t65g';

-- 9. FRANCISCI ISAC -> FRANCISCO ISAC GERONCIO DA SILVA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpuj0xmqgw0wtss4hmfc' WHERE "employeeId" = 'cmmh29yjl0053bz9pws1a67eg';

-- 10. CANINDE CHAVES -> FRANCISCO CANINDE CHAVES DE QUEIROZ
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpso0xmogw0wj1rjpzwu' WHERE "employeeId" = 'cmmh2a2ap0099bz9pawsa338m';

-- 11. F ARTHUR LOPES DA SILVA -> FRANCISCO ARTHUR LOPES DA SILVA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpqt0xmmgw0wkdtx9rpd' WHERE "employeeId" = 'cmmh2a2k5009jbz9p8wzz1mkm';

-- 12. ANTONIO MARCOS -> ANTONIO MARCOS SILVA DA COSTA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpow0xmkgw0w3ls1en7x' WHERE "employeeId" = 'cmmh29zch005zbz9p5owtjgo1';

-- 13. FRANCISCO EVERTON -> FRANCISCO EVERTON DOS SANTOS CHAVES
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpmu0xmigw0w9urwqrpd' WHERE "employeeId" = 'cmmh29yli0055bz9plq51a4kf';

-- 14. ERIDAN PEREIRA -> ERIDAN PEREIRA LEMOS
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpkv0xmggw0wkwjd7bqu' WHERE "employeeId" = 'cmmh2a1ci0087bz9puge9tlpa';

-- 15. DORIAN DIMAS -> DORIAN DIMAS OLIVEIRA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpj20xmegw0wvtyour9i' WHERE "employeeId" = 'cmmh29zhv0065bz9p4fs1tjev';

-- 16. CICERO UBIRATAN DE SOUZ -> CICERO UBIRATAN DE SOUZA
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hph00xmcgw0wobsuj8km' WHERE "employeeId" = 'cmmh29xbz003rbz9pb7ov8x58';

-- 17. AMADA DE CARVALHO AQUINO -> AMANDA CARVALHO AQUINO
UPDATE "NormalizedPunch" SET "employeeId" = 'cmmh3hpf10xmagw0wtnpkpzjs' WHERE "employeeId" = 'cmmh2a0c80073bz9p67l0bxuy';

-- Deactivate the old duplicate employee records
UPDATE "Employee" SET "isActive" = false WHERE "id" IN (
  'cmmh29yp30059bz9p0zcu9ftn',
  'cmmh29xql0047bz9p07dyq3mp',
  'cmmh29zg10063bz9pu8p89ent',
  'cmmh2a08p006zbz9pgg70c6bf',
  'cmmh2a01g006rbz9px6efy5il',
  'cmmh29ywl005hbz9pk4lvy25b',
  'cmmh29yht0051bz9prr3pi0b1',
  'cmmh29yun005fbz9prd50t65g',
  'cmmh29yjl0053bz9pws1a67eg',
  'cmmh2a2ap0099bz9pawsa338m',
  'cmmh2a2k5009jbz9p8wzz1mkm',
  'cmmh29zch005zbz9p5owtjgo1',
  'cmmh29yli0055bz9plq51a4kf',
  'cmmh2a1ci0087bz9puge9tlpa',
  'cmmh29zhv0065bz9p4fs1tjev',
  'cmmh29xbz003rbz9pb7ov8x58',
  'cmmh2a0c80073bz9p67l0bxuy'
);

-- Delete old stale timesheets for the old employee IDs (they're recalculated from punches anyway)
DELETE FROM "TimesheetDay" WHERE "timesheetId" IN (
  SELECT "id" FROM "Timesheet" WHERE "employeeId" IN (
    'cmmh29yp30059bz9p0zcu9ftn', 'cmmh29xql0047bz9p07dyq3mp', 'cmmh29zg10063bz9pu8p89ent',
    'cmmh2a08p006zbz9pgg70c6bf', 'cmmh2a01g006rbz9px6efy5il', 'cmmh29ywl005hbz9pk4lvy25b',
    'cmmh29yht0051bz9prr3pi0b1', 'cmmh29yun005fbz9prd50t65g', 'cmmh29yjl0053bz9pws1a67eg',
    'cmmh2a2ap0099bz9pawsa338m', 'cmmh2a2k5009jbz9p8wzz1mkm', 'cmmh29zch005zbz9p5owtjgo1',
    'cmmh29yli0055bz9plq51a4kf', 'cmmh2a1ci0087bz9puge9tlpa', 'cmmh29zhv0065bz9p4fs1tjev',
    'cmmh29xbz003rbz9pb7ov8x58', 'cmmh2a0c80073bz9p67l0bxuy'
  )
);

DELETE FROM "Timesheet" WHERE "employeeId" IN (
  'cmmh29yp30059bz9p0zcu9ftn', 'cmmh29xql0047bz9p07dyq3mp', 'cmmh29zg10063bz9pu8p89ent',
  'cmmh2a08p006zbz9pgg70c6bf', 'cmmh2a01g006rbz9px6efy5il', 'cmmh29ywl005hbz9pk4lvy25b',
  'cmmh29yht0051bz9prr3pi0b1', 'cmmh29yun005fbz9prd50t65g', 'cmmh29yjl0053bz9pws1a67eg',
  'cmmh2a2ap0099bz9pawsa338m', 'cmmh2a2k5009jbz9p8wzz1mkm', 'cmmh29zch005zbz9p5owtjgo1',
  'cmmh29yli0055bz9plq51a4kf', 'cmmh2a1ci0087bz9puge9tlpa', 'cmmh29zhv0065bz9p4fs1tjev',
  'cmmh29xbz003rbz9pb7ov8x58', 'cmmh2a0c80073bz9p67l0bxuy'
);
