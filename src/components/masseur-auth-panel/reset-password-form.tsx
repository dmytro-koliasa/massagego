import { FormEvent } from "react";
import { PasswordField } from "@/components/form-fields";
import type { Dictionary } from "@/lib/i18n";
import type { createNativeValidationHandlers } from "@/lib/native-validation";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation";
import {
  formCardClassName,
  formPrimaryButtonClassName,
} from "@/lib/ui-classes";

type ResetPasswordFormProps = {
  pending: boolean;
  t: Dictionary;
  validation: ReturnType<typeof createNativeValidationHandlers>;
  password: string;
  setPassword: (value: string) => void;
  passwordConfirm: string;
  setPasswordConfirm: (value: string) => void;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  showPasswordConfirm: boolean;
  setShowPasswordConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ResetPasswordForm({
  pending,
  t,
  validation,
  password,
  setPassword,
  passwordConfirm,
  setPasswordConfirm,
  showPassword,
  setShowPassword,
  showPasswordConfirm,
  setShowPasswordConfirm,
  onSubmit,
}: ResetPasswordFormProps) {
  return (
    <div className={formCardClassName}>
      <div className="space-y-5">
        <h2 className="text-left font-display text-2xl tracking-[-0.03em] text-foreground">
          {t.authResetPasswordTitle}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <PasswordField
            id="password"
            label={t.authPassword}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((value) => !value)}
            showLabel={t.authShowPassword}
            hideLabel={t.authHidePassword}
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            validation={validation}
          />
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
          <button
            type="submit"
            disabled={pending}
            className={formPrimaryButtonClassName}
          >
            {pending ? t.authPleaseWait : t.authResetPasswordSubmit}
          </button>
        </form>
      </div>
    </div>
  );
}