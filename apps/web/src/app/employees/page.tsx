'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import DataTable from '@/components/DataTable';

interface Employee {
  id: string;
  name: string;
  cpf: string;
  position: string;
  isActive: boolean;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get('/employees?skip=0&take=50');
      setEmployees(response.data.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nome' },
    { key: 'cpf', label: 'CPF' },
    { key: 'position', label: 'Cargo' },
    {
      key: 'isActive',
      label: 'Status',
      render: (value: boolean) => (
        <span className={`badge ${value ? 'badge-success' : 'badge-danger'}`}>
          {value ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Colaboradores</h1>
        <button className="btn-primary">Adicionar Colaborador</button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={employees} loading={loading} />
      </div>
    </div>
  );
}
