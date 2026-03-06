# Ponto Online

Integrated time tracking and payroll system with device synchronization, timesheet calculation, and reporting capabilities.

## Features

- Employee time tracking with device integration
- Automated timesheet calculation
- Overtime and night shift tracking
- Time balance management
- Comprehensive reporting and audit logs
- Multi-branch support
- Role-based access control
- Rest API with Swagger documentation
- Real-time synchronization with Control iD devices

## Architecture

### Monorepo Structure

```
ponto-online/
├── apps/
│   ├── api/              # NestJS REST API
│   ├── web/              # Next.js Frontend
│   └── worker/           # BullMQ Worker for async tasks
├── packages/
│   ├── shared/           # Shared types and utilities
│   ├── device-connector/ # Control iD device agent
│   └── calculation-engine/ # Time calculation engine
├── prisma/               # Database schema
├── infra/                # Docker and infrastructure
└── .github/workflows/    # CI/CD pipelines
```

## Technology Stack

- **Backend**: NestJS, TypeScript, Prisma ORM
- **Frontend**: Next.js, React, Tailwind CSS
- **Database**: PostgreSQL
- **Cache/Queue**: Redis, Bull
- **Device Integration**: Control iD API
- **Container**: Docker, Docker Compose
- **CI/CD**: GitHub Actions

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 16+
- Redis 7+
- npm/pnpm

## Getting Started

### Local Development

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd ponto-online
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development services**
   ```bash
   npm run docker:up
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

The application will be available at:
- **Frontend**: http://localhost:4010
- **API**: http://localhost:3010/api/v1
- **Swagger**: http://localhost:3010/api/docs

### Test Credentials

- **Email**: admin@techsolutions.com.br
- **Password**: Admin@123456
- **Role**: Administrator

## Available Scripts

### Root Level

- `npm run dev` - Start all services in development mode
- `npm run build` - Build all packages
- `npm run start` - Start production services
- `npm run lint` - Run linter across packages
- `npm run format` - Format code
- `npm run type-check` - Type check all packages
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with initial data
- `npm run db:studio` - Open Prisma Studio
- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

## Project Structure

### Apps

#### API (`apps/api/`)
NestJS backend with:
- Authentication & Authorization
- CRUD operations for companies, branches, employees, devices
- Punch record management
- Timesheet calculation
- Sync endpoints for device integration
- Comprehensive reporting
- Audit logging

Key modules:
- `auth/` - JWT authentication and authorization
- `companies/` - Company management
- `employees/` - Employee data
- `devices/` - Device management
- `punches/` - Punch event processing
- `timesheets/` - Timesheet calculations
- `sync/` - Device synchronization endpoints
- `reports/` - Analytics and reporting
- `audit/` - Audit logging

#### Web (`apps/web/`)
Next.js frontend with:
- Authentication and session management
- Dashboard with key metrics
- Employee management interface
- Punch records viewer
- Timesheet management
- Device management
- Reports and analytics

Pages:
- `/` - Redirect to dashboard
- `/login` - Authentication page
- `/dashboard` - Main dashboard
- `/employees` - Employee list and management
- `/punches` - Punch records viewer
- `/timesheets` - Timesheet management
- `/devices` - Device management
- `/reports` - Reports and analytics

#### Worker (`apps/worker/`)
BullMQ workers for async operations:
- Timesheet calculation processor
- Device sync processor
- Job management and monitoring

### Packages

#### Shared (`packages/shared/`)
Shared utilities across all packages:
- TypeScript types and interfaces
- Constants (punch types, statuses, etc.)
- Date utilities with timezone support

#### Device Connector (`packages/device-connector/`)
Control iD device synchronization agent:
- Device authentication and communication
- Punch record synchronization
- Employee synchronization from API to device
- Automatic periodic sync

#### Calculation Engine (`packages/calculation-engine/`)
Time calculation and validation:
- Normal hours calculation
- Overtime calculation
- Night shift tracking
- Break duration validation
- Time balance management

## Database Schema

### Main Entities

- **Company** - Organization
- **Branch** - Company branch/location
- **Employee** - Employee records
- **SystemUser** - System access users
- **Device** - Time tracking devices
- **WorkSchedule** - Employee schedules
- **Holiday** - Holiday dates
- **RawPunchEvent** - Raw punch data from device
- **NormalizedPunch** - Processed punch records
- **Timesheet** - Monthly timesheet
- **TimeBalance** - Time accumulation tracking
- **AuditLog** - System audit trail

## API Documentation

### Authentication

All API endpoints (except login/register) require JWT bearer token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3010/api/v1/employees
```

### Key Endpoints

- `POST /auth/login` - User login
- `POST /auth/register` - Create new user (admin only)
- `GET /auth/me` - Current user info
- `POST /auth/refresh` - Refresh access token

- `GET /employees` - List employees
- `POST /employees` - Create employee
- `PATCH /employees/:id` - Update employee
- `DELETE /employees/:id` - Delete employee

- `GET /punches/raw` - Get raw punch events
- `GET /punches/normalized` - Get normalized punches
- `POST /punches/:id/adjust` - Adjust punch record

- `GET /timesheets` - List timesheets
- `GET /timesheets/:employeeId/:month/:year` - Get specific timesheet
- `PATCH /timesheets/:id/approve` - Approve timesheet

- `POST /sync/punches/:deviceId` - Sync punches from device
- `GET /sync/employees/:branchId` - Get employees for sync

- `GET /reports/employee/:employeeId/:month/:year` - Employee report
- `GET /reports/branch/:branchId/:month/:year` - Branch report
- `GET /reports/payroll/:branchId/:month/:year` - Payroll report

## Device Integration

### Control iD Connector

The device connector agent synchronizes data between Control iD devices and the Ponto Online API:

1. **Punch Synchronization**: Retrieves punch events from device and imports into system
2. **Employee Synchronization**: Syncs employee data from API to device
3. **Automatic Sync**: Scheduled periodic synchronization

Configuration in `.env`:
```
DEVICE_CONNECTOR_API_URL=http://localhost:3010/api/v1
CONTROL_ID_API_URL=http://192.168.1.100:8080
DEVICE_CONNECTOR_SYNC_INTERVAL=3600000
```

## Deployment

### Docker Compose

Production setup with all services:

```bash
cd infra
docker compose -f docker-compose.yml up -d
```

Services:
- PostgreSQL 16 on port 5433
- Redis 7 on port 6380
- NestJS API on port 3010
- Next.js Frontend on port 4010
- Nginx reverse proxy on ports 80/443
- BullMQ Worker for background jobs

### Backup and Restore

Create backup:
```bash
./infra/scripts/backup.sh
```

Restore from backup:
```bash
./infra/scripts/restore.sh ./backups/ponto_db_backup_YYYYMMDD_HHMMSS.sql.gz
```

## Environment Variables

See `.env.example` for all available variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Redis
REDIS_URL=redis://host:port

# API
API_PORT=3010
API_HOST=0.0.0.0

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3010/api/v1
NEXT_PUBLIC_WEB_URL=http://localhost:4010

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRATION=7d

# Device Connector
DEVICE_CONNECTOR_API_URL=http://localhost:3010/api/v1
DEVICE_CONNECTOR_SYNC_INTERVAL=3600000
CONTROL_ID_API_URL=http://localhost:8080
```

## Development Workflow

### Code Quality

```bash
# Format code
npm run format

# Type checking
npm run type-check

# Linting
npm run lint

# Run tests (when implemented)
npm run test
```

### Git Hooks

The project uses git hooks for quality assurance (can be configured with husky):
- Pre-commit: Lint and format
- Pre-push: Type check and test

## Contributing

1. Create feature branch from `develop`
2. Make changes and commit with descriptive messages
3. Push to branch
4. Create pull request to `develop`
5. Code review and CI checks must pass

## License

PROPRIETARY - All rights reserved

## Support

For issues, questions, or suggestions:
- Create GitHub issue with detailed description
- Include relevant logs and environment information
- For security issues, contact security team directly

## Roadmap

- [ ] Mobile app for employee check-ins
- [ ] SMS notifications for approvals
- [ ] Integration with popular payroll systems
- [ ] Advanced analytics and forecasting
- [ ] Multi-language support
- [ ] Custom reports builder
- [ ] Integration with HRM systems
