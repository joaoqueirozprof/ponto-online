'use client';

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Relatórios</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-xl font-bold mb-4">Relatório de Colaborador</h3>
          <p className="text-gray-600 mb-4">Visualize detalhes de ponto e folha de um colaborador específico.</p>
          <button className="btn-primary">Gerar Relatório</button>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold mb-4">Relatório de Filial</h3>
          <p className="text-gray-600 mb-4">Resumo consolidado da filial para um período específico.</p>
          <button className="btn-primary">Gerar Relatório</button>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold mb-4">Relatório de Folha de Pagamento</h3>
          <p className="text-gray-600 mb-4">Dados para processamento da folha de pagamento.</p>
          <button className="btn-primary">Gerar Relatório</button>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold mb-4">Auditoria</h3>
          <p className="text-gray-600 mb-4">Log de todas as ações realizadas no sistema.</p>
          <button className="btn-primary">Consultar Auditoria</button>
        </div>
      </div>
    </div>
  );
}
