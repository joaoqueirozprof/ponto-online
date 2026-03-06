import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'API health check' })
  @ApiResponse({
    status: 200,
    description: 'API is running',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2024-01-15T10:30:00Z',
      },
    },
  })
  async getHealth() {
    return this.healthService.getHealth();
  }
}
