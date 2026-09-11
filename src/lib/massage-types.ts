export const MASSAGE_TYPE_IDS = [
  "classic",
  "relaxing",
  "deep_tissue",
  "sports",
  "therapeutic",
  "thai",
  "hot_stone",
  "aromatherapy",
  "lymphatic",
  "prenatal",
  "reflexology",
  "shiatsu",
  "cupping",
  "anti_cellulite",
  "facial",
  "honey",
  "bamboo",
  "back_neck",
] as const;

export type MassageTypeId = (typeof MASSAGE_TYPE_IDS)[number];
export type MassageTypeValue = MassageTypeId | `custom:${string}`;

export const CUSTOM_MASSAGE_TYPE_PREFIX = "custom:";
export const CUSTOM_MASSAGE_TYPE_MAX_LENGTH = 40;

export const massageTypeLabels: Record<
  MassageTypeId,
  { en: string; uk: string }
> = {
  classic: { en: "Classic", uk: "Класичний" },
  relaxing: { en: "Relaxing", uk: "Розслабляючий" },
  deep_tissue: { en: "Deep tissue", uk: "Глибоких тканин" },
  sports: { en: "Sports", uk: "Спортивний" },
  therapeutic: { en: "Therapeutic", uk: "Лікувальний" },
  thai: { en: "Thai", uk: "Тайський" },
  hot_stone: { en: "Hot stone", uk: "Гарячими каменями" },
  aromatherapy: { en: "Aromatherapy", uk: "Ароматерапія" },
  lymphatic: { en: "Lymphatic", uk: "Лімфодренажний" },
  prenatal: { en: "Prenatal", uk: "Для вагітних" },
  reflexology: { en: "Reflexology", uk: "Рефлексотерапія" },
  shiatsu: { en: "Shiatsu", uk: "Шіацу" },
  cupping: { en: "Cupping", uk: "Баночний" },
  anti_cellulite: { en: "Anti-cellulite", uk: "Антицелюлітний" },
  facial: { en: "Facial", uk: "Масаж обличчя" },
  honey: { en: "Honey", uk: "Медовий" },
  bamboo: { en: "Bamboo", uk: "Бамбуковий" },
  back_neck: { en: "Back & neck", uk: "Спина та шия" },
};

const massageTypeIdSet = new Set<string>(MASSAGE_TYPE_IDS);

export function isMassageTypeId(value: string): value is MassageTypeId {
  return massageTypeIdSet.has(value);
}

function readCustomLabel(raw: string) {
  try {
    return decodeURIComponent(raw).trim().replace(/\s+/g, " ");
  } catch {
    return raw.trim().replace(/\s+/g, " ");
  }
}

export function isCustomMassageType(
  value: string,
): value is `custom:${string}` {
  if (!value.startsWith(CUSTOM_MASSAGE_TYPE_PREFIX)) return false;
  const label = readCustomLabel(value.slice(CUSTOM_MASSAGE_TYPE_PREFIX.length));
  return label.length > 0 && label.length <= CUSTOM_MASSAGE_TYPE_MAX_LENGTH;
}

export function isMassageTypeValue(value: string): value is MassageTypeValue {
  return isMassageTypeId(value) || isCustomMassageType(value);
}

export function makeCustomMassageType(label: string): MassageTypeValue | null {
  const trimmed = label.trim().replace(/\s+/g, " ").slice(0, CUSTOM_MASSAGE_TYPE_MAX_LENGTH);
  if (!trimmed) return null;
  return `${CUSTOM_MASSAGE_TYPE_PREFIX}${encodeURIComponent(trimmed)}`;
}

export function getCustomMassageTypes(types: MassageTypeValue[]) {
  return types.filter(isCustomMassageType);
}

export function parseMassageTypes(
  raw: string | null | undefined,
): MassageTypeValue[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeMassageTypeList(parsed);
  } catch {
    return [];
  }
}

export function serializeMassageTypes(types: MassageTypeValue[]) {
  return JSON.stringify(normalizeMassageTypeList(types));
}

export function normalizeMassageTypesInput(
  value: unknown,
): MassageTypeValue[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return normalizeMassageTypeList(value);
}

function canonicalizeMassageType(value: string): MassageTypeValue | null {
  const trimmed = value.trim();
  if (isMassageTypeId(trimmed)) return trimmed;
  if (!isCustomMassageType(trimmed)) return null;
  const label = readCustomLabel(trimmed.slice(CUSTOM_MASSAGE_TYPE_PREFIX.length));
  return makeCustomMassageType(label);
}

function normalizeMassageTypeList(values: unknown[]): MassageTypeValue[] {
  const result: MassageTypeValue[] = [];
  const seen = new Set<string>();

  for (const item of values) {
    if (typeof item !== "string") continue;
    const value = canonicalizeMassageType(item);
    if (!value) continue;

    const dedupeKey = isCustomMassageType(value)
      ? `custom:${readCustomLabel(value.slice(CUSTOM_MASSAGE_TYPE_PREFIX.length)).toLowerCase()}`
      : value;

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(value);
  }

  return result;
}

export function getMassageTypeLabel(
  value: string,
  locale: "en" | "uk",
) {
  if (isMassageTypeId(value)) return massageTypeLabels[value][locale];
  if (isCustomMassageType(value)) {
    return readCustomLabel(value.slice(CUSTOM_MASSAGE_TYPE_PREFIX.length));
  }
  return value;
}

export function hasSameMassageTypeLabel(
  types: MassageTypeValue[],
  label: string,
  locale: "en" | "uk",
) {
  const normalized = label.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return false;
  return types.some(
    (type) => getMassageTypeLabel(type, locale).toLowerCase() === normalized,
  );
}
