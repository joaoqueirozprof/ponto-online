import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAssistantService } from './ai-assistant.service';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly aiService: AiAssistantService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a message to the AI assistant' })
  async chat(
    @Body('message') message: string,
    @Body('conversationHistory') conversationHistory?: { role: string; content: string }[],
  ) {
    return this.aiService.chat(message, conversationHistory || []);
  }
}
