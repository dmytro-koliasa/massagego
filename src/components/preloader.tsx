type PreloaderProps = {
  className?: string;
  label?: string;
};

export function Preloader({ className, label = "Loading" }: PreloaderProps) {
  return (
    <span
      className={["preloader", className].filter(Boolean).join(" ")}
      aria-label={label}
      role="status"
    />
  );
}
