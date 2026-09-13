import type { Country } from "react-phone-number-input/max";
import {
  getCountryCallingCode,
  getExampleNumber,
} from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";

export function getMaxNationalLength(country: Country) {
  return getExampleNumber(country, examples)?.nationalNumber.length ?? 15;
}

export function clampInternationalPhone(
  value: string | undefined,
  country: Country,
): string | undefined {
  if (!value) return value;
  const callingCode = getCountryCallingCode(country);
  const maxNational = getMaxNationalLength(country);
  const prefix = `+${callingCode}`;
  if (!value.startsWith(prefix)) return value;
  const national = value.slice(prefix.length);
  if (national.length <= maxNational) return value;
  return `${prefix}${national.slice(0, maxNational)}`;
}

export function nationalPhoneInsert(
  inputValue: string,
  selectionStart: number,
  selectionEnd: number,
  inserted: string,
  country: Country,
) {
  const insertedDigits = inserted.replace(/\D/g, "");
  const callingCode = String(getCountryCallingCode(country));
  const maxNational = getMaxNationalLength(country);
  const nextDigits =
    inputValue.slice(0, selectionStart).replace(/\D/g, "") +
    insertedDigits +
    inputValue.slice(selectionEnd).replace(/\D/g, "");
  const national = nextDigits.startsWith(callingCode)
    ? nextDigits.slice(callingCode.length)
    : nextDigits;
  return {
    exceeds: insertedDigits.length > 0 && national.length > maxNational,
    value: `+${callingCode}${national.slice(0, maxNational)}`,
  };
}

/** Synthetic unique email for clients who register by phone only. */
export function clientEmailFromPhone(e164: string) {
  const digits = e164.replace(/\D/g, "");
  return `p${digits}@client.local`;
}
