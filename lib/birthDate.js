/** 회원가입·체육관 회원 등록 공통 생년월일 셀렉트 옵션 */

export const BIRTH_YEAR_MIN = 1910;
export const BIRTH_YEAR_MAX = 2026;
export const BIRTH_YEAR_OPTIONS = Array.from(
  { length: BIRTH_YEAR_MAX - BIRTH_YEAR_MIN + 1 },
  (_, i) => BIRTH_YEAR_MAX - i
);
export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
export const BIRTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

export function isValidCalendarDate(y, m, d) {
  const yi = Number(y);
  const mi = Number(m);
  const di = Number(d);
  if (!yi || !mi || !di) return false;
  const dt = new Date(yi, mi - 1, di);
  return dt.getFullYear() === yi && dt.getMonth() === mi - 1 && dt.getDate() === di;
}

/** YYYY, MM, DD 문자열 → ISO 날짜 YYYY-MM-DD */
export function birthPartsToIso(y, m, d) {
  const ys = String(y).padStart(4, '0');
  const ms = String(m).padStart(2, '0');
  const ds = String(d).padStart(2, '0');
  return `${ys}-${ms}-${ds}`;
}
