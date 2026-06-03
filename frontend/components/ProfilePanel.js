// components/ProfilePanel.js — 個人資料表單
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProfilePanel({ profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null); // "email" | "phone" | "password" | null

  return (
    <section className="surface-panel rounded-lg p-5 sm:p-6">
      <h2 className="text-lg font-black text-[var(--navy-900)]">基本資料</h2>
      <p className="mt-1 text-xs text-slate-500">員工編號、姓名、廠區由福委會建檔，無法自行修改</p>

      <div className="mt-5 divide-y divide-slate-100">
        {/* 員工編號（不可改） */}
        <ReadOnlyField label="員工編號" value={profile.employee_id ? `EMP-${profile.employee_id}` : "—"} />

        {/* 姓名（不可改） */}
        <ReadOnlyField label="姓名" value={profile.full_name || "—"} />

        {/* 廠區（不可改） */}
        <ReadOnlyField label="廠區" value={profile.factory_zone || "—"} />

        {/* Email（可改） */}
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

        {/* 電話（可改） */}
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

        {/* 密碼（可改） */}
        <EditableField
          label="密碼"
          value="••••••••"
          editing={editing === "password"}
          onEdit={() => setEditing("password")}
          onCancel={() => setEditing(null)}
          editor={
            <PasswordEditor
              onSuccess={() => setEditing(null)}
            />
          }
        />
      </div>
    </section>
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
        body: JSON.stringify({
            oldPassword: current,
            newPassword: newPwd,
        }),
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