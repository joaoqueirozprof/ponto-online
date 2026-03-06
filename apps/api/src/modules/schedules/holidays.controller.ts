import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HolidaysService } from './holidays.service';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new holiday' })
  create(@Body() createHolidayDto: any) {
    return this.holidaysService.create(createHolidayDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all holidays' })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50,
  ) {
    return this.holidaysService.findAll(branchId, skip, take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get holiday by ID' })
  findOne(@Param('id') id: string) {
    return this.holidaysService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update holiday' })
  update(@Param('id') id: string, @Body() updateHolidayDto: any) {
    return this.holidaysService.update(id, updateHolidayDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete holiday' })
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
