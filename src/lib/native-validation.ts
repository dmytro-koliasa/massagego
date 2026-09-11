import type { FormEvent } from "react";
import type { Dictionary } from "@/lib/i18n";

type ValidatableElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

function fillTemplate(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function getNativeValidationMessage(
  element: ValidatableElement,
  t: Dictionary,
) {
  const { validity } = element;

  if (validity.valueMissing) return t.validationValueMissing;
  if (validity.typeMismatch) return t.validationTypeMismatch;
  if (validity.tooShort && "minLength" in element) {
    return fillTemplate(t.validationTooShort, {
      min: element.minLength,
    });
  }
  if (validity.tooLong && "maxLength" in element) {
    return fillTemplate(t.validationTooLong, {
      max: element.maxLength,
    });
  }
  if (validity.patternMismatch) return t.validationPatternMismatch;
  if (validity.badInput) return t.validationBadInput;
  return t.validationGeneric;
}

export function createNativeValidationHandlers(t: Dictionary) {
  return {
    onInvalid(event: FormEvent<ValidatableElement>) {
      const element = event.currentTarget;
      element.setCustomValidity(getNativeValidationMessage(element, t));
    },
    onInput(event: FormEvent<ValidatableElement>) {
      event.currentTarget.setCustomValidity("");
    },
  };
}
