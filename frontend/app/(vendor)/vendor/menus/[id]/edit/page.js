// app/(vendor)/vendor/menus/[id]/edit/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const TAG_OPTIONS = [
  { code: "VEGETARIAN",    label: "素食" },
  { code: "BEEF",          label: "牛肉" },
  { code: "CHICKEN",       label: "雞肉" },
  { code: "PORK",          label: "豬肉" },
  { code: "LAMB",          label: "羊肉" },
  { code: "CHINESE",       label: "中式" },
  { code: "JAPANESE",      label: "日式" },
  { code: "ITALIAN",       label: "義式" },
  { code: "SOUTHEAST_ASIAN", label: "東南亞" },
  { code: "AMERICAN",      label: "美式" },
  { code: "BUDGET",        label: "便宜" },
  { code: "SPICY",         label: "辣" },
  { code: "MILD",          label: "不辣" },
];

// ─── 共用 input class ─────────────────────────────────────
const INPUT_CLS =
  "mt-1.5 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none transition " +
  "focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-400)]/20 " +
  "placeholder:text-slate-300";

export default function EditMenuPage() {
  const router     = useRouter();
  const { id }     = useParams();          // menuId
  const fileRef    = useRef(null);

  const [fetching,       setFetching]       = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error,          setError]          = useState("");
  const [imagePreview,   setImagePreview]   = useState("");

  // 原始資料 → 用來當 placeholder（清空欄位時顯示灰色提示）
  const [original, setOriginal] = useState(null);

  const [form, setForm] = useState({
    name:       "",
    price:      "",
    dailyLimit: "",
    imageUrl:   "",
    isActive:   true,
    tags:       [],
  });

  // ── 1. 載入現有資料（透過 Next.js API proxy） ──────────────
  useEffect(() => {
    if (!id) return;

    async function fetchMenu() {
      try {
        // ✅ 呼叫 /api/vendor/menus/[id]，由伺服器帶 auth cookie 轉發後端
        const res = await fetch(`/api/vendor/menus/${id}`);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `伺服器回應錯誤 (${res.status})`);
        }

        const data = await res.json();

        const loaded = {
          name:       data.name       ?? "",
          price:      String(data.price      ?? ""),
          dailyLimit: String(data.dailyLimit ?? ""),
          imageUrl:   data.imageUrl   ?? "",
          isActive:   data.isActive   ?? true,
          tags:       data.tags       ?? [],
        };

        setForm(loaded);
        setOriginal(loaded);   // 保留原始值供 placeholder 使用
        if (data.imageUrl) setImagePreview(data.imageUrl);
      } catch (err) {
        setError(`無法載入餐點資料：${err.message}`);
      } finally {
        setFetching(false);
      }
    }

    fetchMenu();
  }, [id]);

  // ── 表單欄位更新 ───────────────────────────────────────────
  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function onTagChange(code) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(code)
        ? prev.tags.filter((t) => t !== code)
        : [...prev.tags, code],
    }));
  }

  // ── 2. 圖片上傳（S3 Pre-signed URL，同樣走 proxy） ─────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 立刻顯示本地預覽
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);

    setUploadingImage(true);
    setError("");

    try {
      const res = await fetch(
        `/api/vendor/menus/upload-image-url?contentType=${encodeURIComponent(file.type)}`,
      );
      if (!res.ok) throw new Error("無法取得圖片上傳授權");

      const { uploadUrl, imageUrl } = await res.json();

      // 直接 PUT 到 S3（不需 auth，S3 pre-signed URL 本身即授權）
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("圖片上傳至雲端失敗");

      setForm((prev) => ({ ...prev, imageUrl }));
    } catch (err) {
      setError(err.message || "圖片上傳失敗");
      setImagePreview(form.imageUrl);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setUploadingImage(false);
    }
  }

  // ── 3. 儲存變更 ────────────────────────────────────────────
  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name || !form.price || !form.dailyLimit) {
      setError("請填寫餐點名稱、價格與每日供應份數");
      return;
    }
    if (uploadingImage) {
      setError("圖片還在上傳中，請稍候...");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/menus/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       form.name,
          price:      Number(form.price),
          dailyLimit: Number(form.dailyLimit),
          imageUrl:   form.imageUrl,
          isActive:   form.isActive,
          tags:       form.tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "更新失敗，請確認傳入資料格式");
        return;
      }

      router.push("/vendor/menus");
      router.refresh();
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  // ── 4. 刪除餐點 ────────────────────────────────────────────
  async function onDelete() {
    if (!confirm("確定要刪除此餐點嗎？此操作無法復原。")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/menus/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "刪除失敗");
        return;
      }
      router.push("/vendor/menus");
      router.refresh();
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  // ── 載入中 ────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="mx-auto w-full max-w-xl pt-16 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--teal-400)] border-t-transparent" />
        <p className="mt-3 text-sm text-slate-400">正在載入餐點資料...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">

      {/* 麵包屑 */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/vendor"       className="hover:text-[var(--teal-600)]">工作台</Link>
        <span>/</span>
        <Link href="/vendor/menus" className="hover:text-[var(--teal-600)]">菜單管理</Link>
        <span>/</span>
        <span className="font-semibold text-[var(--navy-900)]">編輯餐點</span>
      </div>

      {/* ── 表單 ── */}
      <section className="surface-panel rounded-lg border border-[var(--line)] bg-white px-6 py-7 shadow-sm">
        <h1 className="text-2xl font-black text-[var(--navy-900)]">編輯餐點</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">

          {/* 餐點名稱 */}
          <div>
            <label className="block text-sm font-bold text-[var(--navy-900)]">
              餐點名稱 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder={original?.name ?? ""}
              className={INPUT_CLS}
            />
          </div>

          {/* 價格 ＋ 每日供應量 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-[var(--navy-900)]">
                價格（元）<span className="text-red-500">*</span>
              </label>
              <input
                name="price"
                type="number"
                min="0"
                value={form.price}
                onChange={onChange}
                onWheel={(e) => e.target.blur()}
                placeholder={original?.price ?? ""}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[var(--navy-900)]">
                每日預設供應量 <span className="text-red-500">*</span>
              </label>
              <input
                name="dailyLimit"
                type="number"
                min="0"
                value={form.dailyLimit}
                onChange={onChange}
                onWheel={(e) => e.target.blur()}
                placeholder={original?.dailyLimit ?? ""}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* 圖片上傳 */}
          <div>
            <label className="block text-sm font-bold text-[var(--navy-900)]">餐點照片</label>
            <div className="mt-1.5 flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--line)] bg-slate-50 text-slate-400">
                {imagePreview ? (
                  <img src={imagePreview} alt="餐點照片" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs">無照片</span>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold text-white">
                    上傳中...
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/jpeg,image/png"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
                <p className="mt-1 text-xs text-slate-400">支援 JPG / PNG</p>
              </div>
            </div>
          </div>

          {/* 標籤 */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--navy-900)]">
              餐點標籤（複選）
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {TAG_OPTIONS.map((tag) => {
                const isChecked = form.tags.includes(tag.code);
                return (
                  <button
                    key={tag.code}
                    type="button"
                    onClick={() => onTagChange(tag.code)}
                    className={`flex items-center justify-center rounded-md border py-2 text-xs font-semibold transition ${
                      isChecked
                        ? "border-[var(--teal-600)] bg-[var(--teal-50)] text-[var(--teal-600)] shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 開放供應 toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--line)] bg-slate-50/50 px-4 py-3 transition hover:bg-slate-50">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={onChange}
              className="h-4 w-4 rounded accent-[var(--teal-600)]"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--navy-900)]">開放供應中</p>
              <p className="text-xs text-slate-400">勾選後此餐點將顯示在員工點餐菜單上</p>
            </div>
          </label>

          {/* 錯誤訊息 */}
          {error && (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-500">
              ⚠️ {error}
            </div>
          )}

          {/* ── 按鈕列：[刪除餐點]  [儲存變更] [取消] ── */}
          <div className="flex items-center gap-3 border-t border-[var(--line)] pt-4">
            {/* 刪除（最左） */}
            <button
              type="button"
              onClick={onDelete}
              disabled={loading}
              className="rounded-md border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              刪除餐點
            </button>

            {/* 彈性空間推右 */}
            <div className="flex flex-1 justify-end gap-3">
              <Link
                href="/vendor/menus"
                className="rounded-md border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={loading || uploadingImage}
                className="rounded-md bg-[var(--navy-600)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "儲存中..." : "儲存變更"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}