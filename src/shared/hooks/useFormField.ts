import { useState, useCallback } from 'react';

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

export function useFormField(initialValue: string, rules: ValidationRule[]) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(() => {
    for (const rule of rules) {
      if (!rule.validate(value)) {
        setError(rule.message);
        return false;
      }
    }
    setError(null);
    return true;
  }, [value, rules]);

  const onBlur = useCallback(() => {
    validate();
  }, [validate]);

  return { value, setValue, error, validate, onBlur };
}
