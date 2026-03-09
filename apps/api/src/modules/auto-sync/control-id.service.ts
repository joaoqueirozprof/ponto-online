import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';

export interface ControlIdSession {
  deviceId: string;
  session: string;
  baseUrl: string;
  expiresAt: number;
}

export interface AfdRecord {
  nsr: string;
  type: string;
  date: string;
  time: string;
  pis: string;
  raw: string;
}

export interface ControlIdUser {
  id: number;
  registration: string;
  name: string;
  password?: string;
  begin_time?: number;
  end_time?: number;
}

/**
 * Raw TCP/TLS HTTP POST — bypasses Node.js strict HTTP parser.
 * Control iD devices use LF (\n) instead of CRLF (\r\n) in HTTP responses,
 * which causes Node's built-in http/https modules to throw parse errors.
 * This function uses raw socket I/O and parses the response manually.
 */
function rawHttpPost(
  host: string,
  port: number,
  path: string,
  body: string,
  useHttps: boolean,
  timeoutMs = 30000,
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const request = [
      `POST ${path} HTTP/1.0`,
      `Host: ${host}`,
      'Content-Type: application/json',
      `Content-Length: ${Buffer.byteLength(body)}`,
      'Connection: close',
      '',
      body,
    ].join('\r\n');

    let socket: net.Socket;

    if (useHttps) {
      socket = tls.connect({
        host,
        port,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      });
    } else {
      socket = net.createConnection({ host, port });
      socket.setTimeout(timeoutMs);
    }

    let rawData = Buffer.alloc(0);
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      socket.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('connect', () => {
      socket.write(request);
    });

    // For TLS, wait for 'secureConnect' event
    if (useHttps) {
      (socket as tls.TLSSocket).on('secureConnect', () => {
        socket.write(request);
      });
      // Remove the 'connect' listener to avoid double-write
      socket.removeAllListeners('connect');
    }

    socket.on('data', (chunk) => {
      rawData = Buffer.concat([rawData, chunk]);
    });

    socket.on('end', () => {
      clearTimeout(timer);
      if (timedOut) return;
      try {
        const raw = rawData.toString('utf8');
        // Split headers from body on \r\n\r\n or \n\n
        const sepIdx = raw.indexOf('\r\n\r\n') !== -1
          ? raw.indexOf('\r\n\r\n') + 4
          : raw.indexOf('\n\n') + 2;

        const headerPart = sepIdx > 4 ? raw.substring(0, sepIdx) : raw;
        const responseBody = sepIdx > 4 ? raw.substring(sepIdx) : '';

        // Parse status code from first line
        const firstLine = headerPart.split(/\r?\n/)[0] || '';
        const statusMatch = firstLine.match(/HTTP\/[\d.]+ (\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;

        // Handle redirect via Location header
        const locationMatch = headerPart.match(/[Ll]ocation:\s*(.+?)[\r\n]/);
        if (locationMatch && [301, 302, 303, 307, 308].includes(status)) {
          const location = locationMatch[1].trim();
          const redirectUrl = location.startsWith('http')
            ? location
            : `${useHttps ? 'https' : 'http'}://${host}:${port}${location}`;
          const rParsed = new URL(redirectUrl);
          const rPort = parseInt(rParsed.port) || (rParsed.protocol === 'https:' ? 443 : 80);
          resolve(rawHttpPost(rParsed.hostname, rPort, rParsed.pathname + rParsed.search, body, rParsed.protocol === 'https:', timeoutMs));
          return;
        }

        resolve({ status, data: responseBody });
      } catch (err: any) {
        reject(err);
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) reject(err);
    });

    socket.on('timeout', () => {
      clearTimeout(timer);
      socket.destroy();
      reject(new Error(`Socket timeout after ${timeoutMs}ms`));
    });
  });
}

/**
 * Wrapper to call rawHttpPost from a URL string
 */
function httpPost(url: string, body?: any, timeoutMs = 30000): Promise<{ status: number; data: string }> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const port = parsed.port ? parseInt(parsed.port) : (isHttps ? 443 : 80);
  const path = parsed.pathname + parsed.search;
  const postData = body ? JSON.stringify(body) : '';
  return rawHttpPost(parsed.hostname, port, path, postData, isHttps, timeoutMs);
}

/**
 * Determine base URL for device — uses HTTPS when port is 443
 */
function getBaseUrl(ipAddress: string, port: number | null): string {
  const p = port || 80;
  if (p === 443) {
    return `https://${ipAddress}:${p}`;
  }
  return `http://${ipAddress}:${p}`;
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

    const baseUrl = getBaseUrl(device.ipAddress, device.port);

    try {
      const result = await httpPost(`${baseUrl}/login.fcgi`, {
        login: device.login || 'admin',
        password: device.encryptedPassword || 'admin',
      }, 10000);

      if (result.status !== 200) {
        throw new Error(`Login failed with status ${result.status}`);
      }

      const data = JSON.parse(result.data);

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
    } catch (error: any) {
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
      const result = await httpPost(url, body);

      if (result.status === 401 || result.status === 403) {
        // Session might have expired, retry with new login
        this.sessions.delete(deviceId);
        const newSession = await this.getSession(deviceId);
        const retryUrl = queryParams
          ? `${newSession.baseUrl}/${endpoint}?session=${newSession.session}&${queryParams}`
          : `${newSession.baseUrl}/${endpoint}?session=${newSession.session}`;

        const retryResult = await httpPost(retryUrl, body);
        if (retryResult.status !== 200) {
          throw new Error(`Request failed after retry: ${retryResult.status}`);
        }

        try { return JSON.parse(retryResult.data); } catch { return retryResult.data; }
      }

      if (result.status !== 200) {
        throw new Error(`Request to ${endpoint} failed: ${result.status}`);
      }

      try { return JSON.parse(result.data); } catch { return result.data; }
    } catch (error: any) {
      this.logger.error(`Request to device ${deviceId} endpoint ${endpoint} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export AFD (Arquivo Fonte de Dados) from device
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

      const baseUrl = getBaseUrl(device.ipAddress, device.port);
      const result = await httpPost(
        `${baseUrl}/login.fcgi`,
        { login: device.login || 'admin', password: device.encryptedPassword || 'admin' },
        5000,
      );

      return result.status === 200;
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
