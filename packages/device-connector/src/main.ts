import { config } from './config';
import PunchSyncService from './sync/punch-sync';
import EmployeeSyncService from './sync/employee-sync';

class DeviceConnectorAgent {
  private punchSyncService: PunchSyncService;
  private employeeSyncService: EmployeeSyncService;

  constructor() {
    this.punchSyncService = new PunchSyncService();
    this.employeeSyncService = new EmployeeSyncService();
  }

  async start() {
    console.log('Device Connector Agent started');
    console.log(`Sync interval: ${config.sync.interval}ms`);

    setInterval(() => {
      this.performSync();
    }, config.sync.interval);

    this.performSync();
  }

  private async performSync() {
    try {
      console.log(`Performing sync at ${new Date().toISOString()}`);

      const deviceId = process.env.DEVICE_ID || 'default-device';
      const branchId = process.env.BRANCH_ID || 'default-branch';
      const deviceLogin = process.env.DEVICE_LOGIN || 'admin';
      const devicePassword = process.env.DEVICE_PASSWORD || 'admin';

      await this.punchSyncService.syncPunches(deviceId, deviceLogin, devicePassword);

      await this.employeeSyncService.syncEmployeesFromAPI(
        branchId,
        deviceLogin,
        devicePassword,
      );

      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Error during sync:', error);
    }
  }
}

const agent = new DeviceConnectorAgent();
agent.start().catch((error) => {
  console.error('Failed to start Device Connector Agent:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Shutting down Device Connector Agent');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Interrupted');
  process.exit(0);
});
