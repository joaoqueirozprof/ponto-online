import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ControlIdSession {
  deviceId: string;
  session: string;
  baseUrl: string;
  expiresAt: number;
}

interface AfdRecord {
  nsr: string;
  type: string;
  date: string;
  time: string;
  pis: string;
  raw: string;
}

interface ControlIdUser {
  id: number;
  registration: string;
  name: string;
  password?: string;
  begin_time?: number;
  end_time?: number;
}

@Injectable()
export class ControlIdService {
  private readonly logger = new Logger(ControlIdService.name);
  private sessions: Map<string, ControlIdSession> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Login to Control ID device and get session token
   */
  async login(deviceId: string): Promise<string> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const baseUrl = `http://${device.ipAddress}:${device.port || 80}`;

    try {
      const response = await fetch(`${baseUrl}/login.fcgi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: device.login || 'admin',
          password: device.encryptedPassword || 'admin',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Login failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.session) {
        throw new Error('No session token received from device');
      }

      // Cache session for 30 minutes
      this.sessions.set(deviceId, {
        deviceId,
        session: data.session,
        baseUrl,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      this.logger.log(`Successfully logged into device ${device.name} (${device.ipAddress})`);
      return data.session;
    } catch (error) {
      this.logger.error(`Failed to login to device ${device.name} (${device.ipAddress}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active session for device, login if needed
   */
  async getSession(deviceId: string): Promise<ControlIdSession> {
    const cached = this.sessions.get(deviceId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    await this.login(deviceId);
    return this.sessions.get(deviceId)!;
  }

  /**
   * Make authenticated request to Control ID device
   */
  async request(deviceId: string, endpoint: string, body?: any, queryParams?: string): Promise<any> {
    const session = await this.getSession(deviceId);
    const url = queryParams
      ? `${session.baseUrl}/${endpoint}?session=${session.session}&${queryParams}`
      : `${session.baseUrl}/${endpoint}?session=${session.session}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        // Session might have expired, retry with new login
        if (response.status === 401 || response.status === 403) {
          this.sessions.delete(deviceId);
          const newSession = await this.getSession(deviceId);
          const retryUrl = queryParams
            ? `${newSession.baseUrl}/${endpoint}?session=${newSession.session}&${queryParams}`
            : `${newSession.baseUrl}/${endpoint}?session=${newSession.session}`;

          const retryResponse = await fetch(retryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(30000),
          });

          if (!retryResponse.ok) {
            throw new Error(`Request failed after retry: ${retryResponse.status}`);
          }

          const contentType = retryResponse.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return await retryResponse.json();
          }
          return await retryResponse.text();
        }

        throw new Error(`Request to ${endpoint} failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      this.logger.error(`Request to device ${deviceId} endpoint ${endpoint} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export AFD (Arquivo Fonte de Dados) from device
   * Returns raw AFD text with all punch records
   */
  async exportAfd(deviceId: string, initialDate?: { day: number; month: number; year: number }, initialNsr?: number): Promise<string> {
    const body: any = {};
    if (initialDate) {
      body.initial_date = initialDate;
    }
    if (initialNsr) {
      body.initial_nsr = initialNsr;
    }

    const afdText = await this.request(deviceId, 'export_afd.fcgi', Object.keys(body).length > 0 ? body : undefined);
    return typeof afdText === 'string' ? afdText : JSON.stringify(afdText);
  }

  /**
   * Parse AFD text into structured records (Portaria 1510 format)
   * Type 3 records: punch marks
   *   Positions: 1-9 NSR, 10 type, 11-18 date (ddmmyyyy), 19-22 time (hhmm), 23-34 PIS
   */
  parseAfdRecords(afdText: string): AfdRecord[] {
    const lines = afdText.split('\n').filter(l => l.trim().length > 0);
    const records: AfdRecord[] = [];

    for (const line of lines) {
      if (line.length < 34) continue;
      const type = line.charAt(9);

      if (type === '3') {
        const nsr = line.substring(0, 9).trim();
        const dateStr = line.substring(10, 18); // ddmmyyyy
        const timeStr = line.substring(18, 22); // hhmm
        const pis = line.substring(22, 34).trim();

        records.push({
          nsr,
          type: '3',
          date: dateStr,
          time: timeStr,
          pis,
          raw: line,
        });
      }
    }

    return records;
  }

  /**
   * Convert AFD date/time to UTC Date object
   * AFD times are in BRT (UTC-3, America/Fortaleza)
   */
  afdToUtcDate(dateStr: string, timeStr: string): Date {
    const day = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const year = parseInt(dateStr.substring(4, 8));
    const hour = parseInt(timeStr.substring(0, 2));
    const minute = parseInt(timeStr.substring(2, 4));

    // Add 3 hours to convert BRT to UTC
    let utcHour = hour + 3;
    let utcDay = day;
    let utcMonth = month;
    let utcYear = year;

    if (utcHour >= 24) {
      utcHour -= 24;
      utcDay++;
      const daysInMonth = new Date(utcYear, utcMonth, 0).getDate();
      if (utcDay > daysInMonth) {
        utcDay = 1;
        utcMonth++;
        if (utcMonth > 12) {
          utcMonth = 1;
          utcYear++;
        }
      }
    }

    return new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHour, minute, 0));
  }

  /**
   * Load users from Control ID device
   */
  async loadUsers(deviceId: string): Promise<ControlIdUser[]> {
    const result = await this.request(deviceId, 'load_objects.fcgi', {
      object: 'users',
    });

    return result?.users || [];
  }

  /**
   * Create users on Control ID device
   */
  async createUsers(deviceId: string, users: { registration: string; name: string; password?: string }[]): Promise<{ ids: number[] }> {
    const result = await this.request(deviceId, 'create_objects.fcgi', {
      object: 'users',
      values: users.map(u => ({
        registration: u.registration,
        name: u.name,
        password: u.password || '',
      })),
    });

    return result;
  }

  /**
   * Remove users from Control ID device
   */
  async removeUsers(deviceId: string, userIds: number[]): Promise<any> {
    return this.request(deviceId, 'destroy_objects.fcgi', {
      object: 'users',
      where: {
        users: { id: userIds },
      },
    });
  }

  /**
   * Update users on Control ID device
   */
  async updateUsers(deviceId: string, users: { id: number; registration?: string; name?: string }[]): Promise<any> {
    const results = [];
    for (const user of users) {
      const values: any = {};
      if (user.registration) values.registration = user.registration;
      if (user.name) values.name = user.name;

      const result = await this.request(deviceId, 'modify_objects.fcgi', {
        object: 'users',
        values,
        where: { users: { id: [user.id] } },
      });
      results.push(result);
    }
    return results;
  }

  /**
   * Get device info
   */
  async getDeviceInfo(deviceId: string): Promise<any> {
    return this.request(deviceId, 'system_information.fcgi');
  }

  /**
   * Check if device is reachable
   */
  async pingDevice(deviceId: string): Promise<boolean> {
    try {
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
      });

      if (!device) return false;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${device.ipAddress}:${device.port || 80}/login.fcgi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: device.login || 'admin', password: device.encryptedPassword || 'admin' }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get access logs from device (alternative to AFD)
   */
  async getAccessLogs(deviceId: string, limit?: number, offset?: number): Promise<any[]> {
    const body: any = {
      object: 'access_logs',
    };
    if (limit) body.limit = limit;
    if (offset) body.offset = offset;

    const result = await this.request(deviceId, 'load_objects.fcgi', body);
    return result?.access_logs || [];
  }
}
