import type { Country } from "react-phone-number-input/max";
import { TextField } from "@/components/form-fields";
import type { Dictionary } from "@/lib/i18n";
import type { createNativeValidationHandlers } from "@/lib/native-validation";
import { EMAIL_MAX } from "@/lib/validation";
import { ClientPhoneField } from "./client-phone-field";

type LoginFormProps = {
  isClient: boolean;
  t: Dictionary;
  validation: ReturnType<typeof createNativeValidationHandlers>;
  phone: string | undefined;
  setPhone: React.Dispatch<React.SetStateAction<string | undefined>>;
  phoneCountry: Country;
  setPhoneCountry: React.Dispatch<React.SetStateAction<Country>>;
  email: string;
  setEmail: (value: string) => void;
};

export function LoginForm({
  isClient,
  t,
  validation,
  phone,
  setPhone,
  phoneCountry,
  setPhoneCountry,
  email,
  setEmail,
}: LoginFormProps) {
  return isClient ? (
    <ClientPhoneField
      t={t}
      phone={phone}
      setPhone={setPhone}
      phoneCountry={phoneCountry}
      setPhoneCountry={setPhoneCountry}
    />
  ) : (
    <TextField
      id="email"
      label={t.authEmail}
      type="email"
      autoComplete="email"
      value={email}
      onChange={setEmail}
      required
      maxLength={EMAIL_MAX}
      validation={validation}
    />
  );
}