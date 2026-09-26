import { useState } from 'react';

import { ApiError, splitFormError, type FieldTargetsByCode } from '@/api/errors';
import { usePlanLimit } from '@/components/plan-limit-sheet';

type FormErrorOptions<F extends string> = {
  // API error codes that belong to a field, e.g. { EMAIL_TAKEN: { field: 'email' } }.
  byCode?: FieldTargetsByCode<F>;
  // Wording that replaces the API's validation message for a field, e.g. for email.
  messages?: Partial<Record<F, string>>;
};

// Error state for a form, following the input design: each problem shows under its field (red
// border and message), and anything that isn't about one field shows under the submit button.
// Forms never use a banner.
export function useFormErrors<F extends string>(fields: readonly F[], options: FormErrorOptions<F> = {}) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<F, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { show: showPlanLimit } = usePlanLimit();

  const setFieldError = (field: F, message: string) =>
    setFieldErrors((current) => ({ ...current, [field]: message }));

  const clearFieldError = (field: F) =>
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const clearErrors = () => {
    setFieldErrors({});
    setFormError(null);
  };

  const showError = (err: unknown) => {
    // "You've used up your plan" belongs in the upgrade sheet, not under a field: no wording
    // here could tell the user what to do about it.
    if (showPlanLimit(err)) return;

    const split = splitFormError(err, fields, options.byCode);
    if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
      for (const field of fields) {
        const message = options.messages?.[field];
        if (split.fieldErrors[field] && message) split.fieldErrors[field] = message;
      }
    }
    setFieldErrors(split.fieldErrors);
    setFormError(split.formError);
  };

  return { fieldErrors, formError, setFieldError, clearFieldError, clearErrors, showError };
}
