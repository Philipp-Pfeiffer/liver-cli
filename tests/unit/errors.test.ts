import { describe, it, expect } from 'vitest';
import { LiverError, PROFILE_MISSING, EXIT_CODES } from '../../src/errors/index.js';
import {
  validateWeight,
  validateHeight,
  validateAge,
  validateSex,
  validateVolume,
  validateABV,
} from '../../src/errors/validation.js';

describe('errors', () => {
  it('should create error with correct properties', () => {
    const err = PROFILE_MISSING('status');
    expect(err.code).toBe('PROFILE_MISSING');
    expect(err.exitCode).toBe(EXIT_CODES.USER_ERROR);
    expect(err.hint).toContain('profile set');
    expect(err.context).toEqual({ command: 'status' });
  });
  
  it('should serialize to JSON', () => {
    const err = PROFILE_MISSING('status');
    const json = err.toJSON();
    expect(json.error.code).toBe('PROFILE_MISSING');
    expect(json.error.message).toContain('No profile configured');
  });
  
  it('should validate weight', () => {
    expect(() => validateWeight(70)).not.toThrow();
    expect(() => validateWeight(20)).toThrow();
    expect(() => validateWeight(300)).toThrow();
  });
  
  it('should validate height', () => {
    expect(() => validateHeight(180)).not.toThrow();
    expect(() => validateHeight(100)).toThrow();
  });
  
  it('should validate age', () => {
    expect(() => validateAge(25)).not.toThrow();
    expect(() => validateAge(10)).toThrow();
  });
  
  it('should validate sex', () => {
    expect(() => validateSex('m')).not.toThrow();
    expect(() => validateSex('f')).not.toThrow();
    expect(() => validateSex('o')).not.toThrow();
    expect(() => validateSex('x')).toThrow();
  });
  
  it('should validate volume', () => {
    expect(() => validateVolume(500)).not.toThrow();
    expect(() => validateVolume(0)).toThrow();
    expect(() => validateVolume(5001)).toThrow();
  });
  
  it('should validate ABV', () => {
    expect(() => validateABV(5.2)).not.toThrow();
    expect(() => validateABV(0)).toThrow();
    expect(() => validateABV(101)).toThrow();
  });
});