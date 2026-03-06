import dotenv from 'dotenv';

dotenv.config();

export const config = {
  api: {
    baseUrl: process.env.DEVICE_CONNECTOR_API_URL || 'http://localhost:3010/api/v1',
  },
  device: {
    apiUrl: process.env.CONTROL_ID_API_URL || 'http://localhost:8080',
    timeout: parseInt(process.env.CONTROL_ID_TIMEOUT || '5000', 10),
  },
  sync: {
    interval: parseInt(process.env.DEVICE_CONNECTOR_SYNC_INTERVAL || '3600000', 10),
  },
  log: {
    level: process.env.DEVICE_CONNECTOR_LOG_LEVEL || 'info',
  },
};

export default config;
