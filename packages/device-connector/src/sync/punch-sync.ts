import axios from 'axios';
import { config } from '../config';
import ControlIDClient from '../controlid/client';

export class PunchSyncService {
  private apiClient = axios.create({
    baseURL: config.api.baseUrl,
  });

  async syncPunches(
    deviceId: string,
    login: string,
    password: string,
  ): Promise<{ processed: number; errors: number }> {
    const controlIdClient = new ControlIDClient();

    try {
      await controlIdClient.login(login, password);

      const punches = await controlIdClient.getPunches();

      if (punches.length === 0) {
        console.log(`No new punches found on device ${deviceId}`);
        return { processed: 0, errors: 0 };
      }

      const response = await this.apiClient.post(`/sync/punches/${deviceId}`, {
        punches: punches.map((punch: any) => ({
          userId: punch.userId,
          timestamp: punch.timestamp,
          type: punch.type || 'ENTRY',
        })),
      });

      console.log(`Successfully synced ${response.data.processed} punches from device ${deviceId}`);

      return {
        processed: response.data.processed,
        errors: response.data.errors,
      };
    } catch (error) {
      console.error(`Error syncing punches from device ${deviceId}:`, error);
      throw error;
    } finally {
      await controlIdClient.logout();
    }
  }
}

export default PunchSyncService;
