// 菜單標籤詞彙的單一真實來源（single source of truth）。
// 用英文 code 存進 DB，label 為中文對照；新增/調整 tag 只改這裡。
// 供：DTO 驗證白名單、GET /api/v1/menus/tags 端點輸出、tag 篩選查詢驗證。
export const MENU_TAGS = [
  { code: 'VEGETARIAN', label: '素' },
  { code: 'CHICKEN', label: '雞' },
  { code: 'PORK', label: '豬' },
  { code: 'BEEF', label: '牛' },
  { code: 'LAMB', label: '羊' },
  { code: 'CHINESE', label: '中式' },
  { code: 'JAPANESE', label: '日式' },
  { code: 'ITALIAN', label: '義式' },
  { code: 'SOUTHEAST_ASIAN', label: '東南亞' },
  { code: 'AMERICAN', label: '美式' },
  { code: 'BUDGET', label: '便宜' },
  { code: 'SPICY', label: '辣' },
  { code: 'MILD', label: '不辣' },
] as const;

export const MENU_TAG_CODES = MENU_TAGS.map((t) => t.code);

export type MenuTagCode = (typeof MENU_TAGS)[number]['code'];
