// components/VendorProfilePanel.js — 商家個人資料表單
"use client";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

export default function VendorProfilePanel({ profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null); // "email" | "phone" | "category" | "description" | "password" | null

  const zonesDisplay = profile.factory_zones?.length
    ? profile.factory_zones.join("、")
    : "—";

  // 送 PUT 時後端需要完整欄位，所以各 editor 共用這份 base
  const [imageUrl, setImageUrl] = useState(profile.image_url || "");
  const vendorBase = {
    name: profile.name,
    category: profile.category,
    description: profile.description,
    imageUrl,
  };

  return (
    <section className="surface-panel rounded-lg p-5 sm:p-6">
      <h2 className="text-lg font-black text-[var(--navy-900)]">基本資料</h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <p className="text-slate-500">
          商家編號、名稱、供應廠區由系統建檔，無法自行修改
        </p>
        
        {profile?.status === "SUSPENDED" && (
          <p className="font-semibold text-red-500">
            ❗您已被停權，請聯繫福委會申請復權或相關服務。
          </p>
        )}
      </div>
      <ImageUploadSection
        imageUrl={imageUrl}
        vendorBase={vendorBase}
        onUploaded={(url) => setImageUrl(url)}
        onSaved={() => router.refresh()}
      />

      <div className="mt-5 divide-y divide-slate-100">
        <ReadOnlyField label="商家編號" value={profile.vendor_id ? `VND-${profile.vendor_id}` : "—"} />
        <ReadOnlyField label="商家名稱" value={profile.name || "—"} />
        <ReadOnlyField label="供應廠區" value={zonesDisplay} />

        <EditableField
          label="商品類別"
          value={profile.category || "—"}
          editing={editing === "category"}
          onEdit={() => setEditing("category")}
          onCancel={() => setEditing(null)}
          editor={
            <VendorFieldEditor
              fieldLabel="商品類別"
              currentValue={profile.category}
              fieldKey="category"
              vendorBase={vendorBase}
              onSuccess={() => { setEditing(null); router.refresh(); }}
            />
          }
        />

        <EditableField
          label="商家簡介"
          value={profile.description || "—"}
          editing={editing === "description"}
          onEdit={() => setEditing("description")}
          onCancel={() => setEditing(null)}
          editor={
            <VendorFieldEditor
              fieldLabel="商家簡介"
              currentValue={profile.description}
              fieldKey="description"
              vendorBase={vendorBase}
              multiline
              onSuccess={() => { setEditing(null); router.refresh(); }}
            />
          }
        />

        <EditableField
          label="Email"
          value={profile.email}
          editing={editing === "email"}
          onEdit={() => setEditing("email")}
          onCancel={() => setEditing(null)}
          editor={
            <EmailEditor
              currentEmail={profile.email}
              onSuccess={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          }
        />

        <EditableField
          label="電話"
          value={profile.phone_number || "—"}
          editing={editing === "phone"}
          onEdit={() => setEditing("phone")}
          onCancel={() => setEditing(null)}
          editor={
            <PhoneEditor
              currentPhone={profile.phone_number}
              onSuccess={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          }
        />

        <EditableField
          label="密碼"
          value="••••••••"
          editing={editing === "password"}
          onEdit={() => setEditing("password")}
          onCancel={() => setEditing(null)}
          editor={<PasswordEditor onSuccess={() => setEditing(null)} />}
        />
      </div>
    </section>
  );
}

function ImageUploadSection({ imageUrl, vendorBase, onUploaded, onSaved }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(imageUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);

    setUploading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(
        `/api/vendor/menus/upload-image-url?contentType=${encodeURIComponent(file.type)}`
      );
      if (!res.ok) throw new Error("無法取得上傳授權");
      const { uploadUrl, imageUrl: newUrl } = await res.json();

      const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!s3Res.ok) throw new Error("圖片上傳至雲端失敗");

      onUploaded(newUrl);

      setSaving(true);
      const putRes = await fetch("/api/vendor/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vendorBase, imageUrl: newUrl }),
      });
      const data = await putRes.json();
      if (!putRes.ok) throw new Error(data.message || data.error || "儲存失敗");

      setSuccess(true);
      onSaved();
    } catch (err) {
      setError(err.message);
      setPreview(imageUrl);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  const busy = uploading || saving;

  return (
    <div className="mt-5 flex items-center gap-5">
      <div className="relative flex h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[var(--line)] bg-slate-100">
        {preview ? (
          <img src={preview} alt="商家圖片" className="h-full w-full object-cover" />
        ) : (
          <span className="m-auto text-xs text-slate-400">無圖片</span>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">商家形象圖</p>
        {error && <p className="mt-1 text-xs text-[var(--error-fg)]">{error}</p>}
        {success && !error && <p className="mt-1 text-xs text-[var(--teal-600)]">圖片已更新</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="mt-2 rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? "上傳中..." : saving ? "儲存中..." : "更換圖片"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="mt-1 text-xs text-slate-400">JPG / PNG，上傳後自動儲存</p>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function EditableField({ label, value, editing, onEdit, onCancel, editor }) {
  if (editing) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-500">{label}</span>
          <button
            onClick={onCancel}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            取消
          </button>
        </div>
        {editor}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-900">{value}</span>
        <button
          onClick={onEdit}
          className="text-sm font-bold text-[var(--navy-600)] hover:text-[var(--navy-800)]"
        >
          修改
        </button>
      </div>
    </div>
  );
}

function VendorFieldEditor({ fieldLabel, currentValue, fieldKey, vendorBase, multiline, onSuccess }) {
  const [value, setValue] = useState(currentValue || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (value === currentValue) {
      setError(`${fieldLabel}與目前相同`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/vendor/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vendorBase, [fieldKey]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "修改失敗");
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-4">
      {error && (
        <div className="mb-3 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]">
          {error}
        </div>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder={`輸入${fieldLabel}...`}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)] resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`輸入${fieldLabel}...`}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
        />
      )}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-3 rounded-md bg-[var(--navy-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:opacity-50"
      >
        {saving ? "儲存中..." : "確認修改"}
      </button>
    </div>
  );
}

function EmailEditor({ currentEmail, onSuccess }) {
  const [email, setEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    if (email === currentEmail) {
      setError("新 Email 與目前 Email 相同");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_email: email, newEmail: email, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "修改失敗");
      setMessage("修改請求已送出！系統會寄一封驗證信到新 Email，點信中連結後新 Email 才會正式生效。");
      setTimeout(() => onSuccess(), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-4">
      {error && (
        <div className="mb-3 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-3 rounded-md bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success-fg)]">
          {message}
        </div>
      )}
      <p className="mb-2 text-xs text-slate-500">
        修改 Email 需經驗證流程：系統會寄信到新 Email，點擊連結後才會正式生效
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="newname@example.com"
        className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
      />
      <button
        onClick={submit}
        disabled={saving || !email}
        className="mt-3 rounded-md bg-[var(--navy-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:opacity-50"
      >
        {saving ? "送出中..." : "送出驗證信"}
      </button>
    </div>
  );
}

function PhoneEditor({ currentPhone, onSuccess }) {
  const [phone, setPhone] = useState(currentPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (phone === currentPhone) {
      setError("電話與目前相同");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "修改失敗");
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-4">
      {error && (
        <div className="mb-3 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]">
          {error}
        </div>
      )}
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="0912345678"
        className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
      />
      <button
        onClick={submit}
        disabled={saving || !phone}
        className="mt-3 rounded-md bg-[var(--navy-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:opacity-50"
      >
        {saving ? "儲存中..." : "確認修改"}
      </button>
    </div>
  );
}

function PasswordEditor({ onSuccess }) {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    if (!current || !newPwd) {
      setError("請填寫所有欄位");
      return;
    }
    if (newPwd !== confirm) {
      setError("兩次新密碼不一致");
      return;
    }
    if (newPwd.length < 4) {
      setError("新密碼至少 4 字元");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: current, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "修改失敗");
      setMessage("密碼修改成功！");
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-4 space-y-3">
      {error && (
        <div className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success-fg)]">
          {message}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-slate-500">目前密碼</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500">新密碼（至少 4 字元）</label>
        <input
          type="password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500">確認新密碼</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
        />
      </div>
      <button
        onClick={submit}
        disabled={saving}
        className="rounded-md bg-[var(--navy-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:opacity-50"
      >
        {saving ? "儲存中..." : "確認修改"}
      </button>
    </div>
  );
}
