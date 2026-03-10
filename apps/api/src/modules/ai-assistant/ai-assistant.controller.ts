import { Controller, Post, Get, Body, Param, Res, UseGuards, NotFoundException, Request } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AiAssistantService } from './ai-assistant.service';
import { Response } from 'express';

@ApiTags('AI Assistant')
@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly aiService: AiAssistantService) {}

  @Post('chat')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Enviar mensagem ao assistente de IA' })
  async chat(
    @Body('message') message: string,
    @Body('conversationHistory') conversationHistory?: { role: string; content: string }[],
    @Request() req?: any,
  ) {
    return this.aiService.chat(message, conversationHistory || [], req?.tenantCompanyId);
  }

  @Get('pdf/:fileName')
  @ApiOperation({ summary: 'Download de relatório PDF gerado' })
  async downloadPdf(@Param('fileName') fileName: string, @Res() res: Response) {
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!sanitized.endsWith('.pdf')) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    const filePath = this.aiService.getPdfPath(sanitized);
    if (!filePath) {
      throw new NotFoundException('PDF não encontrado ou expirado');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${sanitized}"`);
    res.sendFile(filePath);
  }
}
