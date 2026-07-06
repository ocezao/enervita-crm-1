#!/usr/bin/env ts-node
/**
 * Script de Contract Testing
 * 
 * Valida automaticamente se as respostas da API estão em conformidade
 * com os schemas Zod definidos nos shared-contracts.
 * 
 * Uso:
 *   npm run contract-test
 *   npx ts-node scripts/contract-test.ts
 */

import { z } from 'zod';
import { LeadListResponseSchema, LeadSingleResponseSchema, CreateLeadSchema } from '../apps/shared-contracts/src/schemas/leads';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
  duration: number;
}

async function testEndpoint<T extends z.ZodType>(
  method: string,
  endpoint: string,
  schema: T,
  payload?: any
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Authorization': `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}` } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await response.json();
    const result = schema.safeParse(data);

    if (!result.success) {
      return {
        endpoint,
        method,
        status: 'FAIL',
        error: `Schema validation failed: ${result.error.message}`,
        duration: Date.now() - startTime,
      };
    }

    return {
      endpoint,
      method,
      status: 'PASS',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      endpoint,
      method,
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

async function runContractTests() {
  console.log('🔍 Running Contract Tests...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  const tests: Array<{
    name: string;
    method: string;
    endpoint: string;
    schema: z.ZodType;
    payload?: any;
  }> = [
    {
      name: 'GET /leads - List response structure',
      method: 'GET',
      endpoint: '/leads?page=1&limit=10',
      schema: LeadListResponseSchema,
    },
    // Adicione mais testes conforme necessário:
    // {
    //   name: 'POST /leads - Create response structure',
    //   method: 'POST',
    //   endpoint: '/leads',
    //   schema: LeadSingleResponseSchema,
    //   payload: { name: 'Test Lead', email: 'test@example.com', phone: '1234567890' }
    // },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    process.stdout.write(`Testing: ${test.name}... `);
    
    const result = await testEndpoint(
      test.method,
      test.endpoint,
      test.schema,
      test.payload
    );

    results.push(result);

    if (result.status === 'PASS') {
      console.log(`✅ PASS (${result.duration}ms)`);
    } else if (result.status === 'SKIP') {
      console.log(`⏭️  SKIP`);
    } else {
      console.log(`❌ FAIL (${result.duration}ms)`);
      console.log(`   Error: ${result.error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Contract tests failed! Check the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All contract tests passed!');
    process.exit(0);
  }
}

// Run tests
runContractTests().catch((error) => {
  console.error('Fatal error running contract tests:', error);
  process.exit(1);
});
