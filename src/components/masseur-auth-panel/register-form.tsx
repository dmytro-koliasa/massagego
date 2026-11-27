import type { Country } from "react-phone-number-input/max";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { PasswordField, TextField } from "@/components/form-fields";
import type { Dictionary } from "@/lib/i18n";
import type { CanonicalCity } from "@/lib/city";
import type { createNativeValidationHandlers } from "@/lib/native-validation";
import { EMAIL_MAX, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation";
import { formControlClassName } from "@/lib/ui-classes";
import { ClientPhoneField } from "./client-phone-field";

type RegisterFormProps = {
  isClient: boolean;
  t: Dictionary;
  locale: string;
  validation: ReturnType<typeof createNativeValidationHandlers>;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  cityLabel: string;
  setCityLabel: (value: string) => void;
  setCity: (city: CanonicalCity | null) => void;
  phone: string | undefined;
  setPhone: React.Dispatch<React.SetStateAction<string | undefined>>;
  phoneCountry: Country;
  setPhoneCountry: React.Dispatch<React.SetStateAction<Country>>;
};

export function RegisterForm({
  isClient,
  t,
  locale,
  validation,
  name,
  setName,
  email,
  setEmail,
  cityLabel,
  setCityLabel,
  setCity,
  phone,
  setPhone,
  phoneCountry,
  setPhoneCountry,
}: RegisterFormProps) {
  return (
    <>
      <TextField
        id="name"
        label={t.authName}
        type="text"
        autoComplete="name"
        value={name}
        onChange={setName}
        required
        maxLength={NAME_MAX}
        validation={validation}
      />

      {isClient ? (
        <>
          <ClientPhoneField
            t={t}
            phone={phone}
            setPhone={setPhone}
            phoneCountry={phoneCountry}
            setPhoneCountry={setPhoneCountry}
          />

          <label className="block text-left">
            <span className="mb-1.5 block text-sm text-muted">
              {t.authEmail}
            </span>
            <input
              id="client-email"
              name="email"
              type="email"
              value={email}
              autoComplete="email"
              required
              maxLength={EMAIL_MAX}
              onInvalid={validation.onInvalid}
              onInput={validation.onInput}
              onChange={(event) => setEmail(event.target.value)}
              className={formControlClassName}
            />
            <span className="mt-1.5 block text-xs text-muted">
              {t.authEmailHint}
            </span>
          </label>

          <CityAutocomplete
            value={cityLabel}
            onChange={setCityLabel}
            onSelectCity={setCity}
            label={t.profileCity}
            placeholder={t.profileCityPlaceholder}
            lang={locale === "en" ? "en" : "uk"}
            required
          />
        </>
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
    </>
  );
}

type RegisterFormFooterProps = {
  t: Dictionary;
  passwordConfirm: string;
  setPasswordConfirm: (value: string) => void;
  showPasswordConfirm: boolean;
  setShowPasswordConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  validation: ReturnType<typeof createNativeValidationHandlers>;
};

export function RegisterFormFooter({
  t,
  passwordConfirm,
  setPasswordConfirm,
  showPasswordConfirm,
  setShowPasswordConfirm,
  validation,
}: RegisterFormFooterProps) {
  return (
    <>
      <PasswordField
        id="passwordConfirm"
        label={t.authPasswordConfirm}
        autoComplete="new-password"
        value={passwordConfirm}
        onChange={setPasswordConfirm}
        visible={showPasswordConfirm}
        onToggleVisible={() => setShowPasswordConfirm((value) => !value)}
        showLabel={t.authShowPassword}
        hideLabel={t.authHidePassword}
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        validation={validation}
      />

      <p className="text-center text-xs text-muted">
        <a
          href="/privacy"
          className="text-accent underline underline-offset-2"
        >
          {t.telegramPrivacyLink}
        </a>
        {" · "}
        <a
          href="/terms"
          className="text-accent underline underline-offset-2"
        >
          {t.telegramTermsLink}
        </a>
      </p>
    </>
  );
}