import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

export class ControlIDClient {
  private client: AxiosInstance;
  private sessionId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.device.apiUrl,
      timeout: config.device.timeout,
    });
  }

  async login(username: string, password: string): Promise<string> {
    try {
      const response = await this.client.post('/login', {
        username,
        password,
      });

      this.sessionId = response.data.sessionId;
      return this.sessionId;
    } catch (error) {
      throw new Error(`Failed to login to Control iD device: ${error}`);
    }
  }

  async getPunches(): Promise<any[]> {
    try {
      const response = await this.client.get('/punches', {
        headers: {
          'X-Session-Id': this.sessionId,
        },
      });

      return response.data.punches || [];
    } catch (error) {
      throw new Error(`Failed to get punches from Control iD: ${error}`);
    }
  }

  async getEmployees(): Promise<any[]> {
    try {
      const response = await this.client.get('/employees', {
        headers: {
          'X-Session-Id': this.sessionId,
        },
      });

      return response.data.employees || [];
    } catch (error) {
      throw new Error(`Failed to get employees from Control iD: ${error}`);
    }
  }

  async sendEmployee(employeeData: any): Promise<void> {
    try {
      await this.client.post('/employees', employeeData, {
        headers: {
          'X-Session-Id': this.sessionId,
        },
      });
    } catch (error) {
      throw new Error(`Failed to send employee to Control iD: ${error}`);
    }
  }

  async getDeviceStatus(): Promise<any> {
    try {
      const response = await this.client.get('/status', {
        headers: {
          'X-Session-Id': this.sessionId,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get device status: ${error}`);
    }
  }

  async logout(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.client.post(
          '/logout',
          {},
          {
            headers: {
              'X-Session-Id': this.sessionId,
            },
          },
        );
      } catch (error) {
        console.error('Error logging out from Control iD:', error);
      }

      this.sessionId = null;
    }
  }
}

export default ControlIDClient;
