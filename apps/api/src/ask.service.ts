import { Injectable } from '@nestjs/common';
import { orchestrate } from '@traceforge/core';
import { randomUUID } from 'crypto';
import type { AskRequest } from '@traceforge/core';

type HandleInput = {
  input: string;
  tenant?: string;
  chaos?: {
    breakTool?: boolean;
    badRag?: boolean;
    policyRisk?: boolean;
    tokenSpike?: boolean;
  };
};

@Injectable()
export class AskService {
  async handle(input: HandleInput): Promise<ReturnType<typeof orchestrate>> {
    const requestId = randomUUID();
    const tenantId = input.tenant ?? 'unknown';
    
    const askRequest: AskRequest = {
      requestId,
      tenantId,
      input: { text: input.input },
      chaos: input.chaos,
    };
    
    return orchestrate(askRequest);
  }
}

