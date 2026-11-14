import { totalCarbsFromSource } from '@/utils/carbsConvention';

import { netCarbsResult } from '../netCarbsModel';

describe('netCarbsResult', () => {
  it('waits silently while carbs or fiber are empty', () => {
    expect(netCarbsResult({ convention: 'total', carbsText: '', fiberText: '' })).toEqual({
      ok: false,
      problem: null,
    });
    expect(netCarbsResult({ convention: 'net', carbsText: '25', fiberText: '' })).toEqual({
      ok: false,
      problem: null,
    });
  });

  it('reads a US label where carbs already include fiber', () => {
    const result = netCarbsResult({ convention: 'total', carbsText: '30', fiberText: '5' });
    expect(result).toEqual({
      ok: true,
      result: { totalCarbs: 30, netCarbs: 25, fiber: 5 },
    });
  });

  it('reads an EU label where carbs exclude fiber, and matches the app convention', () => {
    const result = netCarbsResult({ convention: 'net', carbsText: '25', fiberText: '5' });
    expect(result).toEqual({
      ok: true,
      result: { totalCarbs: 30, netCarbs: 25, fiber: 5 },
    });
    if (!result.ok) {
      throw new Error('expected a result');
    }
    expect(result.result.totalCarbs).toBe(totalCarbsFromSource('net', { carbs: 25, fiber: 5 }));
  });

  it('accepts a comma decimal and zero fiber', () => {
    expect(netCarbsResult({ convention: 'total', carbsText: '12,5', fiberText: '0' })).toEqual({
      ok: true,
      result: { totalCarbs: 12.5, netCarbs: 12.5, fiber: 0 },
    });
  });

  it('refuses fiber above the carbs on a US label, since carbs include fiber there', () => {
    expect(netCarbsResult({ convention: 'total', carbsText: '4', fiberText: '5' })).toEqual({
      ok: false,
      problem: 'fiberTooHigh',
    });
  });

  it('allows fiber above the carbs on an EU label, where the two are separate', () => {
    expect(netCarbsResult({ convention: 'net', carbsText: '4', fiberText: '5' }).ok).toBe(true);
  });

  it('refuses values that are not a usable number', () => {
    expect(netCarbsResult({ convention: 'total', carbsText: 'abc', fiberText: '1' })).toEqual({
      ok: false,
      problem: 'carbs',
    });
    expect(netCarbsResult({ convention: 'total', carbsText: '10', fiberText: '-1' })).toEqual({
      ok: false,
      problem: 'fiber',
    });
  });
});
