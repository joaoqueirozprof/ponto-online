'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import DataTable from '@/components/DataTable';

export default function PunchesPage() {
  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPunches();
  }, []);

  const fetchPunches = async () => {
    try {
      const response = await apiClient.get('/punches/normalized?skip=0&take=50');
      setPunches(response.data.data);
    } catch (error) {
      console.error('Error fetching punches:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'punchTime', label: 'Data/Hora' },
    { key: 'punchType', label: 'Tipo' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Registros de Ponto</h1>
      <div className="card">
        <DataTable columns={columns} data={punches} loading={loading} />
      </div>
    </div>
  );
}
