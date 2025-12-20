import { Body, Controller, Get, Query, Post } from '@nestjs/common';
import { AskService } from './ask.service';
import { AskBodyDto } from './ask.dto';

@Controller()
export class AskController {
  constructor(private readonly ask: AskService) {}

  @Get('/health')
  health() {
    return { ok: true };
  }

  @Post('/v1/ask')
  async askV1(
    @Body() body: AskBodyDto,
    @Query('breakTool') breakTool?: string,
    @Query('badRag') badRag?: string,
    @Query('policyRisk') policyRisk?: string,
    @Query('tokenSpike') tokenSpike?: string,
  ) {
    return this.ask.handle({
      input: body.input,
      tenant: body.tenant,
      chaos: {
        breakTool: breakTool === 'true',
        badRag: badRag === 'true',
        policyRisk: policyRisk === 'true',
        tokenSpike: tokenSpike === 'true',
      },
    });
  }
}

