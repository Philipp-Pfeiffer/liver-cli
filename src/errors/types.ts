export const EXIT_CODES = {
  SUCCESS: 0,
  USER_ERROR: 1,
  STATE_ERROR: 2,
  INTERNAL_ERROR: 3,
  CONFIG_ERROR: 4,
} as const;

export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];

export interface ErrorContext {
  command?: string;
  [key: string]: unknown;
}

export interface LiverErrorJSON {
  error: {
    code: string;
    message: string;
    hint?: string;
    context?: ErrorContext;
  };
}