/**
 * Script to update employee data from Ponto Secullum 4 reports
 * Creates work schedules, second branch (ATACADISTA), and updates all 75 employees
 * Idempotent - safe to run multiple times
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ===== DATA FROM PONTO SECULLUM 4 HTML REPORTS =====

const SCHEDULES = [
  { code: 1, name: '1 - FATURAMENTO', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 2, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 3, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 4, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 5, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 6, start: '07:00', end: '11:00', bStart: null, bEnd: null, bMin: 0 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 2, name: '2 - Seg/Sex 7:30-11/13-17:30 Sab 7-11', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 2, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 3, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 4, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 5, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 6, start: '07:00', end: '11:00', bStart: null, bEnd: null, bMin: 0 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 3, name: '3 - Seg/Sex 8-11/13-18 Sab 7-11', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '08:00', end: '18:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 2, start: '08:00', end: '18:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 3, start: '08:00', end: '18:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 4, start: '08:00', end: '18:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 5, start: '08:00', end: '18:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 6, start: '07:00', end: '11:00', bStart: null, bEnd: null, bMin: 0 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 4, name: '4 - PRODUCAO', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 2, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 3, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 4, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 5, start: '07:00', end: '17:00', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 6, start: '07:00', end: '11:00', bStart: null, bEnd: null, bMin: 0 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 6, name: '6 - T1 FRENTE DE LOJA', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 2, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 3, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 4, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 5, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 6, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 8, name: '8 - 9:00 AS 13:00 E 15:00 AS 19:00', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '09:00', end: '19:00', bStart: '13:00', bEnd: '15:00', bMin: 120 },
      { day: 2, start: '09:00', end: '19:00', bStart: '13:00', bEnd: '15:00', bMin: 120 },
      { day: 3, start: '09:00', end: '19:00', bStart: '13:00', bEnd: '15:00', bMin: 120 },
      { day: 4, start: '09:00', end: '19:00', bStart: '13:00', bEnd: '15:00', bMin: 120 },
      { day: 5, start: '09:00', end: '19:00', bStart: '13:00', bEnd: '15:00', bMin: 120 },
      { day: 6, start: '09:00', end: '13:00', bStart: null, bEnd: null, bMin: 0 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 9, name: '9 - OPERADOR CHARLES', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 2, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 3, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 4, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 5, start: '07:30', end: '17:30', bStart: '11:00', bEnd: '13:00', bMin: 120 },
      { day: 6, start: '07:00', end: '11:00', bStart: null, bEnd: null, bMin: 0 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 11, name: '11 - REPOSITORES', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 2, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 3, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 4, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 5, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 6, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 12, name: '12 - T3 ACOUGUE', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '13:00', end: '21:20', bStart: '17:00', bEnd: '18:00', bMin: 60 },
      { day: 2, start: '13:00', end: '21:20', bStart: '17:00', bEnd: '18:00', bMin: 60 },
      { day: 3, start: '13:00', end: '21:20', bStart: '17:00', bEnd: '18:00', bMin: 60 },
      { day: 4, start: '13:00', end: '21:20', bStart: '17:00', bEnd: '18:00', bMin: 60 },
      { day: 5, start: '13:00', end: '21:20', bStart: '17:00', bEnd: '18:00', bMin: 60 },
      { day: 6, start: '13:00', end: '21:20', bStart: '17:00', bEnd: '18:00', bMin: 60 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 15, name: '15 - T2 ACOUGUE', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '10:00', end: '18:20', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 2, start: '10:00', end: '18:20', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 3, start: '10:00', end: '18:20', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 4, start: '10:00', end: '18:20', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 5, start: '10:00', end: '18:20', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 6, start: '10:00', end: '18:20', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 16, name: '16 - T2 FRENTE DE LOJA', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 2, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 3, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 4, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 5, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 6, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 17, name: '17 - T2 TELEVENDAS', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 2, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 3, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 4, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 5, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 6, start: '10:40', end: '19:00', bStart: '14:00', bEnd: '15:00', bMin: 60 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
  { code: 18, name: '18 - T1 ACOUGUE', weeklyHours: 44, type: 'FIXED',
    entries: [
      { day: 1, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 2, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 3, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 4, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 5, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 6, start: '07:00', end: '15:20', bStart: '11:00', bEnd: '12:00', bMin: 60 },
      { day: 0, start: '00:00', end: '00:00', bStart: null, bEnd: null, bMin: 0, isWorkDay: false },
    ]
  },
];

// Complete employee data: name, registration (nº folha), company, department, position, schedule code
const EMPLOYEES = [
  // ESCRITORIO department
  { name: 'AMANDA CARVALHO AQUINO', reg: '109', company: 'ATACADISTA', dept: 'ESCRITORIO', position: 'ATENDENTE', schedCode: 1 },
  { name: 'FERNANDO FREITAS PATRIOTA', reg: '108', company: 'ATACADISTA', dept: 'ESCRITORIO', position: 'AUXILIAR DE FATURAMENTO', schedCode: 1 },
  { name: 'JOAO CARLOS HERCULANO DA SILVA QUEIROZ', reg: '55223', company: 'ATACADISTA', dept: 'ESCRITORIO', position: 'PROGRAMADOR DE SISTEMAS DE INFORMATICA', schedCode: 1 },
  { name: 'JOAO PAULO SAMPAIO GOMES', reg: '1114', company: 'ATACADISTA', dept: 'ESCRITORIO', position: 'COMPRADOR', schedCode: 2 },

  // FABRICA department
  { name: 'ANTONIO CARLOS ALVES FAGUNDES', reg: '86', company: 'INDUSTRIA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },
  { name: 'CHARLE LEITE BRASIL', reg: '9', company: 'INDUSTRIA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 9 },
  { name: 'CICERO UBIRATAN DE SOUZA', reg: '38', company: 'INDUSTRIA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },
  { name: 'DAVI JUSTINO DE OLIVEIRA', reg: '10.1', company: 'ATACADISTA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 1 },
  { name: 'DORIAN DIMAS OLIVEIRA', reg: '120', company: 'ATACADISTA', dept: 'FABRICA', position: 'CONFERENTE DE CARGA', schedCode: 1 },
  { name: 'ELISIANO JOSE DA SILVA', reg: '18', company: 'INDUSTRIA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },
  { name: 'ERIDAN PEREIRA LEMOS', reg: '6', company: 'ATACADISTA', dept: 'FABRICA', position: 'AUXILIAR DE CONFERENTE', schedCode: 1 },
  { name: 'FRANCISCO CANINDE MARTINS DA SILVA', reg: '28.2', company: 'INDUSTRIA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'FRANCISCO EDBERGSON DIOGENES DA SILVA', reg: '51', company: 'INDUSTRIA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'FRANCISCO ELISSON MAIA FRANCO', reg: '1.22', company: 'ATACADISTA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'FRANCISCO EVERTON DOS SANTOS CHAVES', reg: '100', company: 'ATACADISTA', dept: 'FABRICA', position: 'CONFERENTE DE CARGA', schedCode: 1 },
  { name: 'FRANCISCO MARCIO PEREIRA LIMA', reg: '106', company: 'ATACADISTA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },
  { name: 'GILBERLINO DE PAIVA SOUZA', reg: '21', company: 'INDUSTRIA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 2 },
  { name: 'JOAQUIM MARCILIO DA COSTA', reg: '30', company: 'ATACADISTA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },
  { name: 'JOSE CRISTIANO NETO', reg: '50,8', company: 'ATACADISTA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'REJANO FERNANDES DA SILVA', reg: '35', company: 'ATACADISTA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },
  { name: 'RERYSON KAUE MARCELINO DE QUEIROZ', reg: '706', company: 'INDUSTRIA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'SALENIO GUEDES DA SILVA DOS SANTOS', reg: '32', company: 'ATACADISTA', dept: 'FABRICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'SEBASTIAO DANTAS DA SILVA', reg: '2', company: 'ATACADISTA', dept: 'FABRICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },

  // LOJA FISICA department
  { name: 'ANTONIO EVERTON DO REGO SOARES', reg: '844', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 11 },
  { name: 'ANTONIO MARCOS SILVA DA COSTA', reg: '50', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 12 },
  { name: 'BRUNA ALVES PEREIRA', reg: '160', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAIXA', schedCode: 16 },
  { name: 'DANIEL MATIAS DE LIMA', reg: '50,6', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 8 },
  { name: 'DANILO JOSE DE OLIVEIRA SILVA', reg: '111069', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 4 },
  { name: 'FERNANDA ALVES DE SOUZA', reg: '702', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAIXA', schedCode: 16 },
  { name: 'FRANCISCO AGNALDO SALDANHA VIEIRA', reg: '44', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'ACOUGUEIRO', schedCode: 12 },
  { name: 'FRANCISCO ALIKSON GOMES SILVA', reg: '119', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'ACOUGUEIRO', schedCode: 12 },
  { name: 'FRANCISCO ANDERSON DA SILVA', reg: '143', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 4 },
  { name: 'FRANCISCO ARTHUR LOPES DA SILVA', reg: '800', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 11 },
  { name: 'FRANCISCO CANINDE CHAVES DE QUEIROZ', reg: '83', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'FRANCISCO DAMIAO DE SOUZA E SILVA', reg: '354', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE CONFERENTE', schedCode: 2 },
  { name: 'FRANCISCO DANILO FERNANDES DANTAS', reg: '1122', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 6 },
  { name: 'FRANCISCO DE ASSIS DE ARAUJO', reg: '500', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 16 },
  { name: 'FRANCISCO ISAC GERONCIO DA SILVA', reg: '101', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 18 },
  { name: 'FRANCISCO JOSE DE AQUINO', reg: '13', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE FATURAMENTO', schedCode: 1 },
  { name: 'FRANCISCO LUAN DO NASCIMENTO BATISTA', reg: '102', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 6 },
  { name: 'FRANCISCO RICARDO SOBRINHO DE QUEIROZ', reg: '94', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OPERADOR DE EMPILHADEIRA', schedCode: 6 },
  { name: 'FRANCISCO THIAGO DO NASCIMENTO PEREIRA', reg: '104', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 11 },
  { name: 'FRANCISCO WALYSON JULYANY', reg: '139', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'ATENDENTE DE TELEVENDAS', schedCode: 17 },
  { name: 'JOAO VICTOR DE OLIVEIRA LIMA', reg: '506', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 6 },
  { name: 'JOAO VITOR RODRIGUES SANTOS', reg: '110', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 11 },
  { name: 'JOCELIO BEZERRA DA COSTA', reg: '507', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 18 },
  { name: 'JOSE JADIELSON LEITE', reg: '131', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE FATURAMENTO', schedCode: 1 },
  { name: 'JOSE JOSIANO NOBRE ALMEIDA', reg: '1,3', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 3 },
  { name: 'JOSE LEUDOMAR FERREIRA FERNANDES', reg: '502', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 6 },
  { name: 'JOSE MICHAEL JACOME LIMA', reg: '841', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'CONFERENTE DE CARGA', schedCode: 1 },
  { name: 'JOSE PAULO MAIA NETO', reg: '172', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE DESCARGA', schedCode: 2 },
  { name: 'JOSE ROSENILDO DE SOUZA', reg: '100,7', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 16 },
  { name: 'JOSEFA ALDENIZA DE QUEIROZ', reg: '100,6', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAIXA', schedCode: 16 },
  { name: 'JOSENILTON BARBALHO DA SILVA', reg: '704', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OPERADOR DE EMPILHADEIRA', schedCode: 11 },
  { name: 'KARINA SILVA', reg: '114', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'ATENDENTE DE TELEVENDAS', schedCode: 6 },
  { name: 'KERLY GILDERLANO DA SILVA', reg: '50,2', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'ACOUGUEIRO', schedCode: 15 },
  { name: 'KLINTON RIAN FELIX SILVA', reg: '1411', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 6 },
  { name: 'LUCAS RYAN DANTAS', reg: '96', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 6 },
  { name: 'LUCAS VINICIUS FERNANDES DA SILVA', reg: '126', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 11 },
  { name: 'LUIZ GUILHERME SILVA DE PAULO', reg: '213', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 16 },
  { name: 'MARCOS VINICIUS DO NASCIMENTO FERNANDES', reg: '142', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE FATURAMENTO', schedCode: 2 },
  { name: 'MARIA EVITALIA DA SILVA SOUZA', reg: '1121', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAIXA', schedCode: 6 },
  { name: 'MARIA VILANEIDE DE OLIVEIRA', reg: '115', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAIXA', schedCode: 6 },
  { name: 'MATHEUS HENRIQUE ALVES', reg: '503', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 11 },
  { name: 'MICHAEL JACKSON DA SILVA', reg: '500,4', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAMARA FRIA', schedCode: 2 },
  { name: 'PAULO ADRIANO DA SILVA', reg: '977', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 16 },
  { name: 'PAULO HENRIQUE DA COSTA', reg: '2097', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 11 },
  { name: 'PEDRO HENRIQUE JUSTINO DE OLIVEIRA', reg: '1117', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 11 },
  { name: 'RODRIGO GOMES DOS SANTOS', reg: '47', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE PRODUCAO', schedCode: 2 },
  { name: 'SALAS MATEUS OLIVEIRA SOUSA', reg: '1010', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'AUXILIAR DE FATURAMENTO', schedCode: 1 },
  { name: 'SEVERINO RODIBERTO DA COSTA', reg: '10', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 6 },
  { name: 'THIAGO DA SILVA ASSIS', reg: '50,3', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'OP. DE CAIXA', schedCode: 16 },
  { name: 'VICTOR EMANUEL DA SILVA', reg: '1120', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'EMBALADOR', schedCode: 16 },
  { name: 'VINICIUS LOPES BEZERRA', reg: '501', company: 'ATACADISTA', dept: 'LOJA FISICA', position: 'REPOSITOR', schedCode: 2 },

  // TRABALHO EXTERNO department
  { name: 'JOSE IZOMAR DA SILVA', reg: '8', company: 'ATACADISTA', dept: 'TRABALHO EXTERNO', position: 'AUXILIAR DE PRODUCAO', schedCode: 1 },
];

function normalizeNameForMatch(name) {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('=== UPDATE EMPLOYEE DATA FROM PONTO SECULLUM 4 ===');

  // 1. Find existing company and branch
  const company = await prisma.company.findFirst({ include: { branches: true } });
  if (!company) {
    console.log('ERROR: No company found. Run initial seed first.');
    return;
  }
  console.log(`Company: ${company.name} (${company.id})`);

  const mainBranch = company.branches[0];
  if (!mainBranch) {
    console.log('ERROR: No branch found.');
    return;
  }
  console.log(`Main branch: ${mainBranch.name} (${mainBranch.id})`);

  // 2. Check if already ran (check for our schedules)
  const existingSchedules = await prisma.workSchedule.findMany({
    where: { branchId: mainBranch.id }
  });

  // Delete old default schedule if it exists and create proper ones
  const hasProperSchedules = existingSchedules.some(s => s.name.includes('FATURAMENTO') || s.name.includes('REPOSITORES'));

  if (hasProperSchedules) {
    console.log('Schedules already exist. Updating employees only...');
  } else {
    // Delete old default schedules
    if (existingSchedules.length > 0) {
      // First unlink employees from old schedules
      await prisma.employee.updateMany({
        where: { branchId: mainBranch.id },
        data: { scheduleId: null }
      });
      // Delete old schedule entries and schedules
      for (const sched of existingSchedules) {
        await prisma.scheduleEntry.deleteMany({ where: { scheduleId: sched.id } });
        await prisma.workSchedule.delete({ where: { id: sched.id } });
      }
      console.log(`Deleted ${existingSchedules.length} old default schedules`);
    }
  }

  // 3. Create work schedules (idempotent)
  const scheduleMap = {}; // code -> scheduleId

  for (const sched of SCHEDULES) {
    let existing = await prisma.workSchedule.findFirst({
      where: { branchId: mainBranch.id, name: sched.name }
    });

    if (!existing) {
      existing = await prisma.workSchedule.create({
        data: {
          branchId: mainBranch.id,
          name: sched.name,
          type: sched.type,
          weeklyHours: sched.weeklyHours,
          description: `Horario ${sched.code} - Ponto Secullum`,
          scheduleEntries: {
            create: sched.entries.map(e => ({
              dayOfWeek: e.day,
              startTime: e.start,
              endTime: e.end,
              breakStartTime: e.bStart,
              breakEndTime: e.bEnd,
              breakMinutes: e.bMin,
              isWorkDay: e.isWorkDay !== undefined ? e.isWorkDay : true,
            }))
          }
        }
      });
      console.log(`Created schedule: ${sched.name}`);
    } else {
      console.log(`Schedule exists: ${sched.name}`);
    }
    scheduleMap[sched.code] = existing.id;
  }

  // 4. Create second branch for ATACADISTA (if not exists)
  let atacadistaBranch = await prisma.branch.findFirst({
    where: { companyId: company.id, name: { contains: 'Atacadista' } }
  });

  if (!atacadistaBranch) {
    atacadistaBranch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'Atacadista Pau dos Ferros',
        code: 'ATAC-001',
        address: 'AV. ESTADOS UNIDOS, 40, NACOES UNIDAS, PAU DOS FERROS, RN',
        phone: mainBranch.phone,
        timezone: 'America/Sao_Paulo',
        toleranceMinutes: 5,
      }
    });
    console.log(`Created ATACADISTA branch: ${atacadistaBranch.id}`);

    // Create same schedules for atacadista branch
    for (const sched of SCHEDULES) {
      const created = await prisma.workSchedule.create({
        data: {
          branchId: atacadistaBranch.id,
          name: sched.name,
          type: sched.type,
          weeklyHours: sched.weeklyHours,
          description: `Horario ${sched.code} - Ponto Secullum`,
          scheduleEntries: {
            create: sched.entries.map(e => ({
              dayOfWeek: e.day,
              startTime: e.start,
              endTime: e.end,
              breakStartTime: e.bStart,
              breakEndTime: e.bEnd,
              breakMinutes: e.bMin,
              isWorkDay: e.isWorkDay !== undefined ? e.isWorkDay : true,
            }))
          }
        }
      });
      scheduleMap[`atac_${sched.code}`] = created.id;
    }
    console.log('Created schedules for ATACADISTA branch');
  } else {
    console.log(`ATACADISTA branch exists: ${atacadistaBranch.id}`);
    // Load existing atacadista schedules
    const atacSchedules = await prisma.workSchedule.findMany({
      where: { branchId: atacadistaBranch.id }
    });
    for (const s of atacSchedules) {
      const code = SCHEDULES.find(sc => sc.name === s.name)?.code;
      if (code) scheduleMap[`atac_${code}`] = s.id;
    }
  }

  // 5. Get all employees
  const allEmployees = await prisma.employee.findMany({
    where: { isActive: true }
  });
  console.log(`Found ${allEmployees.length} active employees in database`);

  // 6. Match and update employees
  let matched = 0;
  let unmatched = [];

  for (const empData of EMPLOYEES) {
    const normalizedSearch = normalizeNameForMatch(empData.name);

    // Try to find employee by normalized name
    const dbEmployee = allEmployees.find(e => {
      const dbName = normalizeNameForMatch(e.name);
      return dbName === normalizedSearch;
    });

    if (dbEmployee) {
      // Determine which branch this employee belongs to
      const isAtacadista = empData.company === 'ATACADISTA';
      const targetBranchId = isAtacadista ? atacadistaBranch.id : mainBranch.id;
      const schedKey = isAtacadista ? `atac_${empData.schedCode}` : empData.schedCode;
      const targetScheduleId = scheduleMap[schedKey] || scheduleMap[empData.schedCode];

      await prisma.employee.update({
        where: { id: dbEmployee.id },
        data: {
          position: empData.position,
          department: empData.dept,
          registration: empData.reg,
          branchId: targetBranchId,
          scheduleId: targetScheduleId || null,
        }
      });
      matched++;
    } else {
      unmatched.push(empData.name);
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Matched and updated: ${matched}/${EMPLOYEES.length}`);
  if (unmatched.length > 0) {
    console.log(`Unmatched (${unmatched.length}):`);
    unmatched.forEach(n => console.log(`  - ${n}`));
  }

  // 7. Summary
  const schedCount = await prisma.workSchedule.count();
  const branchCount = await prisma.branch.count();
  const empWithPos = await prisma.employee.count({ where: { position: { not: null } } });
  const empWithDept = await prisma.employee.count({ where: { department: { not: null } } });
  const empWithSched = await prisma.employee.count({ where: { scheduleId: { not: null } } });

  console.log(`\n=== DATABASE STATE ===`);
  console.log(`Branches: ${branchCount}`);
  console.log(`Work Schedules: ${schedCount}`);
  console.log(`Employees with position: ${empWithPos}`);
  console.log(`Employees with department: ${empWithDept}`);
  console.log(`Employees with schedule: ${empWithSched}`);
}

main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
