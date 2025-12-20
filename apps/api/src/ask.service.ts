import { Injectable } from '@nestjs/common';
import { orchestrate } from '@traceforge/core';
import { randomUUID } from 'crypto';

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
  async handle(input: HandleInput) {
    return orchestrate({
      requestId: randomUUID(),
      input: input.input,
      tenant: input.tenant,
      chaos: input.chaos,
    });
  }
}

