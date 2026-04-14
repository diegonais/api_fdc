import { Module } from '@nestjs/common';
import { FirmsClient } from './firms.client';

@Module({
  providers: [FirmsClient],
  exports: [FirmsClient],
})
export class FirmsModule {}
