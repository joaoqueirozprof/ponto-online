'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import DataTable from '@/components/DataTable';

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    try {
      const response = await apiClient.get('/timesheets?skip=0&take=50');
      setTimesheets(response.data.data);
    } catch (error) {
      console.error('Error fetching timesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
    { key: 'status', label: 'Status' },
    { key: 'totalWorkedMinutes', label: 'Horas Trabalhadas' },
  ];

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Folhas de Ponto</h1>
      <div className="card">
        <DataTable columns={columns} data={timesheets} loading={loading} />
      </div>
    </div>
  );
}
