import axios from 'axios';
import { config } from '../config';
import ControlIDClient from '../controlid/client';

export class EmployeeSyncService {
  private apiClient = axios.create({
    baseURL: config.api.baseUrl,
  });

  async syncEmployeesFromAPI(
    branchId: string,
    login: string,
    password: string,
  ): Promise<{ synced: number; errors: number }> {
    const controlIdClient = new ControlIDClient();

    try {
      await controlIdClient.login(login, password);

      const employees = await this.apiClient.get(`/sync/employees/${branchId}`);

      let syncedCount = 0;
      let errorCount = 0;

      for (const employee of employees.data) {
        try {
          await controlIdClient.sendEmployee({
            id: employee.deviceUserId,
            name: employee.name,
            cpf: employee.cpf,
            position: employee.position,
          });

          syncedCount++;
        } catch (error) {
          console.error(`Error syncing employee ${employee.id}:`, error);
          errorCount++;
        }
      }

      console.log(`Synced ${syncedCount} employees to device in branch ${branchId}`);

      return { synced: syncedCount, errors: errorCount };
    } catch (error) {
      console.error(`Error syncing employees to device:`, error);
      throw error;
    } finally {
      await controlIdClient.logout();
    }
  }

  async updateEmployeeDeviceMapping(
    employeeId: string,
    deviceUserId: string,
  ): Promise<void> {
    try {
      await this.apiClient.post(`/sync/employee-device-id/${employeeId}`, {
        deviceUserId,
      });

      console.log(`Updated device mapping for employee ${employeeId}`);
    } catch (error) {
      console.error(`Error updating employee device mapping:`, error);
      throw error;
    }
  }
}

export default EmployeeSyncService;
