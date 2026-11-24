import { FormEvent } from "react";
import type { Country } from "react-phone-number-input/max";
import { TextField } from "@/components/form-fields";
import type { Dictionary } from "@/lib/i18n";
import type { createNativeValidationHandlers } from "@/lib/native-validation";
import { EMAIL_MAX } from "@/lib/validation";
import {
  formCardClassName,
  formPrimaryButtonClassName,
} from "@/lib/ui-classes";
import { ClientPhoneField } from "./client-phone-field";

type ForgotFormProps = {
  isClient: boolean;
  pending: boolean;
  t: Dictionary;
  validation: ReturnType<typeof createNativeValidationHandlers>;
  phone: string | undefined;
  setPhone: React.Dispatch<React.SetStateAction<string | undefined>>;
  phoneCountry: Country;
  setPhoneCountry: React.Dispatch<React.SetStateAction<Country>>;
  email: string;
  setEmail: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBackToLogin: () => void;
};

export function ForgotForm({
  isClient,
  pending,
  t,
  validation,
  phone,
  setPhone,
  phoneCountry,
  setPhoneCountry,
  email,
  setEmail,
  onSubmit,
  onBackToLogin,
}: ForgotFormProps) {
  return (
    <div className={formCardClassName}>
      <div className="space-y-5">
        <p className="text-left text-sm text-muted">{t.authForgotPasswordHint}</p>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {isClient ? (
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
          )}
          <button
            type="submit"
            disabled={pending}
            className={formPrimaryButtonClassName}
          >
            {pending ? t.authPleaseWait : t.authForgotSubmit}
          </button>
          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full text-sm text-accent underline-offset-2 transition hover:underline"
          >
            {t.authForgotBackToLogin}
          </button>
        </form>
      </div>
    </div>
  );
}