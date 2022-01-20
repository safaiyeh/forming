import { FormInitialValues, ValidationLevel } from './types';
import { isEmpty } from './utils';

const ALL_KEY = Symbol('all');
export class FormState {
  options: {
    initialValues: FormInitialValues;
    validationLevel: ValidationLevel;
  };
  private values: FormInitialValues;
  private validateRules: Record<string, any>;
  private errors: Record<string, any>;
  private listeners: Record<string | symbol, (params: any) => void>;
  constructor({
    initialValues = {},
    validationLevel = 'first',
  }: {
    initialValues?: FormInitialValues;
    validationLevel?: ValidationLevel;
  }) {
    this.options = {
      initialValues,
      validationLevel,
    };
    this.values = initialValues;
    this.validateRules = {};
    this.errors = {};
    this.listeners = {};
  }
  setValue(name: string, value: any) {
    this.values[name] = value;
  }
  getValue(name: string) {
    return this.values[name];
  }
  getValues() {
    return this.values;
  }

  getErrors() {
    return this.errors;
  }

  updateErrors(name: string, errors: any[] | undefined) {
    if (errors === undefined || errors.length === 0) {
      delete this.errors[name];
    } else {
      this.errors[name] = errors;
    }
    this.notifyErrors(name);
  }

  subscribe(name: string | undefined, fn: (val: any) => void) {
    const key = name ?? (ALL_KEY as any);
    this.listeners[key] = fn;
    return () => {
      delete this.listeners[key];
    };
  }

  notifyErrors(name: string) {
    const fn = this.listeners[name];
    fn?.(this.errors[name]);
  }

  setValidateRules(name: string, rules: any) {
    this.validateRules[name] = rules;
  }

  async validate(name: string) {
    const rules = this.validateRules[name];
    if (rules) {
      const errors = [];
      const val = this.getValue(name);
      for (const rule in rules) {
        if (errors.length > 0) {
          if (this.options.validationLevel === 'first') {
            // stop validation on first error
            break;
          }
        }
        const handler = rules[rule];
        if (
          rule === 'required' &&
          typeof handler === 'string' &&
          isEmpty(val)
        ) {
          errors.push({
            rule: 'required',
            message: rule,
          });
          continue;
        }
        if (typeof handler === 'function') {
          const res = await handler(val ?? '');
          if (!['boolean', 'string'].includes(typeof res)) {
            throw new Error('Expect Boolean or String from validation handler');
          }
          if (res === false || res.length > 0) {
            errors.push({
              rule,
              message: typeof res === 'string' ? res : '',
            });
          }
        }
      }
      if (val === this.getValue(name)) {
        // Need to check if the value is still the same in case the value is stale bc of async validation
        this.updateErrors(name, errors.length > 0 ? errors : undefined);
      }
    }
  }

  async validateAll() {
    const names = Object.keys(this.validateRules);
    await Promise.allSettled(names.map(name => this.validate(name)));
  }
}
