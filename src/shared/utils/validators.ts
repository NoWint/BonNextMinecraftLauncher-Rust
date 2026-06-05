import type { ValidationRule } from '../hooks/useFormField';

export const url: ValidationRule = {
  validate: (v) => /^https?:\/\/.+/.test(v),
  message: 'Invalid URL format. Must start with http:// or https://',
};

export const notEmpty: ValidationRule = {
  validate: (v) => v.trim().length > 0,
  message: 'This field cannot be empty',
};

export function memoryRange(min = 512, max = 32768): ValidationRule {
  return {
    validate: (v) => {
      const n = Number(v);
      return !isNaN(n) && n >= min && n <= max;
    },
    message: `Memory must be between ${min} MB and ${max} MB`,
  };
}

export const javaPath: ValidationRule = {
  validate: (v) => /java/i.test(v),
  message: 'Path must contain "java"',
};

export const port: ValidationRule = {
  validate: (v) => {
    const n = Number(v);
    return !isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 65535;
  },
  message: 'Port must be between 1 and 65535',
};

export const proxyUrl: ValidationRule = {
  validate: (v) => /^(https?|socks[45]):\/\/.+/.test(v),
  message: 'Invalid proxy URL. Must start with http://, https://, socks4://, or socks5://',
};
