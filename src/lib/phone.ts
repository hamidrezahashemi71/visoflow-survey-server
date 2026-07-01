// Persian (Extended Arabic-Indic, U+06F0-06F9) and Arabic-Indic (U+0660-0669)
// digits, in order, mapped to Latin 0-9.
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(ch);
    if (persianIndex !== -1) return String(persianIndex);
    return String(ARABIC_INDIC_DIGITS.indexOf(ch));
  });
}

// Normalizes an Iranian mobile number to a canonical `09XXXXXXXXX` form.
// Converts Persian/Arabic-Indic digits to Latin, strips whitespace and the
// `+98`/`0098` country-code prefix, then validates `0?9XXXXXXXXX`. Returns
// null when the input isn't a plausible Iranian mobile number.
export function normalizePhone(raw: string): string | null {
  const latin = toLatinDigits(raw).replace(/\s+/g, "");
  const withoutCountryCode = latin.replace(/^(\+98|0098)/, "");

  if (!/^0?9[0-9]{9}$/.test(withoutCountryCode)) return null;

  return withoutCountryCode.startsWith("0") ? withoutCountryCode : `0${withoutCountryCode}`;
}
