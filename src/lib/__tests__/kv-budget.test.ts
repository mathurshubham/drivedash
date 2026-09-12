import { beforeEach, describe, expect, it } from 'vitest';

import {
  HARD_LIMIT,
  KvBudgetExceeded,
  SOFT_LIMIT,
  budgetSnapshot,
  guardedPut,
  resetKvBudgetForTests,
} from '../kv-budget';

const DAY1 = Date.parse('2026-09-13T10:00:00.000Z');
const DAY1_LATE = Date.parse('2026-09-13T23:59:59.000Z');
const DAY2 = Date.parse('2026-09-14T00:00:01.000Z');

function store() {
  const puts: string[] = [];
  return {
    puts,
    async put(key: string) {
      puts.push(key);
    },
  };
}

beforeEach(() => {
  resetKvBudgetForTests(DAY1);
});

describe('guardedPut', () => {
  it('writes and counts both kinds while under the limits', async () => {
    const s = store();
    await expect(guardedPut(s, 'users', '{}', 'essential', DAY1)).resolves.toBe('written');
    await expect(guardedPut(s, 'users', '{}', 'optional', DAY1)).resolves.toBe('written');
    expect(s.puts).toHaveLength(2);
    expect(budgetSnapshot(DAY1)).toEqual({
      writesToday: 2,
      softLimit: SOFT_LIMIT,
      hardLimit: HARD_LIMIT,
    });
  });

  it('skips optional writes past the soft limit but still allows essential ones', async () => {
    const s = store();
    for (let i = 0; i < SOFT_LIMIT; i += 1) {
      await guardedPut(s, 'users', '{}', 'essential', DAY1);
    }
    expect(budgetSnapshot(DAY1).writesToday).toBe(SOFT_LIMIT);

    await expect(guardedPut(s, 'users', '{}', 'optional', DAY1)).resolves.toBe('skipped');
    expect(s.puts).toHaveLength(SOFT_LIMIT);
    expect(budgetSnapshot(DAY1).writesToday).toBe(SOFT_LIMIT);

    await expect(guardedPut(s, 'users', '{}', 'essential', DAY1)).resolves.toBe('written');
    expect(s.puts).toHaveLength(SOFT_LIMIT + 1);
  });

  it('throws KvBudgetExceeded for essential writes past the hard limit', async () => {
    const s = store();
    for (let i = 0; i < HARD_LIMIT; i += 1) {
      await guardedPut(s, 'users', '{}', 'essential', DAY1);
    }
    await expect(guardedPut(s, 'users', '{}', 'essential', DAY1)).rejects.toBeInstanceOf(
      KvBudgetExceeded,
    );
    await expect(guardedPut(s, 'users', '{}', 'essential', DAY1)).rejects.toMatchObject({
      status: 503,
      message: 'kv_budget_exceeded',
    });
    expect(s.puts).toHaveLength(HARD_LIMIT);
  });

  it('does not count a write that the store rejected', async () => {
    const failing = {
      async put() {
        throw new Error('kv down');
      },
    };
    await expect(guardedPut(failing, 'users', '{}', 'essential', DAY1)).rejects.toThrow('kv down');
    expect(budgetSnapshot(DAY1).writesToday).toBe(0);
  });

  it('rolls the counter over at the UTC day boundary', async () => {
    const s = store();
    for (let i = 0; i < HARD_LIMIT; i += 1) {
      await guardedPut(s, 'users', '{}', 'essential', DAY1_LATE);
    }
    expect(budgetSnapshot(DAY1_LATE).writesToday).toBe(HARD_LIMIT);

    await expect(guardedPut(s, 'users', '{}', 'optional', DAY2)).resolves.toBe('written');
    expect(budgetSnapshot(DAY2).writesToday).toBe(1);
  });
});
