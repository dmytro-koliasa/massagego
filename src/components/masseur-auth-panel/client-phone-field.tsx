import { FormEvent } from "react";
import PhoneInput, { type Country } from "react-phone-number-input/max";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import type { Dictionary } from "@/lib/i18n";
import { PHONE_COUNTRIES_ALLOWED } from "@/lib/phone-countries";
import {
  clampInternationalPhone,
  nationalPhoneInsert,
} from "@/lib/phone";

type ClientPhoneFieldProps = {
  t: Pick<Dictionary, "authPhone">;
  phone: string | undefined;
  setPhone: React.Dispatch<React.SetStateAction<string | undefined>>;
  phoneCountry: Country;
  setPhoneCountry: React.Dispatch<React.SetStateAction<Country>>;
};

export function ClientPhoneField({
  t,
  phone,
  setPhone,
  phoneCountry,
  setPhoneCountry,
}: ClientPhoneFieldProps) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm text-muted">{t.authPhone}</span>
      <PhoneInput
        international
        countryCallingCodeEditable={false}
        defaultCountry="UA"
        countries={[...PHONE_COUNTRIES_ALLOWED]}
        addInternationalOption={false}
        flags={flags}
        limitMaxLength
        value={phone}
        onChange={(value) =>
          setPhone(clampInternationalPhone(value, phoneCountry))
        }
        onCountryChange={(country) => {
          if (!country) return;
          setPhoneCountry(country);
          setPhone((current) => clampInternationalPhone(current, country));
        }}
        className="PhoneInputField"
        numberInputProps={{
          name: "tel",
          autoComplete: "tel",
          required: true,
          className:
            "PhoneInputInput h-12 w-full rounded-none border-0 bg-transparent pr-3 pl-1.5 text-foreground outline-none",
          onBeforeInput: (event: FormEvent<HTMLInputElement>) => {
            const inserted = (event.nativeEvent as InputEvent).data ?? "";
            const input = event.currentTarget;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            const next = nationalPhoneInsert(
              input.value,
              start,
              end,
              inserted,
              phoneCountry,
            );
            if (!next.exceeds) return;
            event.preventDefault();
            setPhone(next.value);
          },
        }}
      />
    </label>
  );
}