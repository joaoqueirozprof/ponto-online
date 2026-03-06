'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import DataTable from '@/components/DataTable';

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await apiClient.get('/devices?skip=0&take=50');
      setDevices(response.data.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nome' },
    { key: 'model', label: 'Modelo' },
    { key: 'ipAddress', label: 'IP' },
    {
      key: 'isActive',
      label: 'Status',
      render: (value: boolean) => (
        <span className={`badge ${value ? 'badge-success' : 'badge-danger'}`}>
          {value ? 'Online' : 'Offline'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Dispositivos</h1>
        <button className="btn-primary">Adicionar Dispositivo</button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={devices} loading={loading} />
      </div>
    </div>
  );
}
