import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, serviceUrl } from "@/lib/api";

export async function DELETE(request, { params }) {
  const { id } = await params;
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    // 呼叫後端: DELETE /billing/statements/:id
    const res = await apiFetch(serviceUrl(SERVICES.billing, `/billing/statements/${id}`), {
      token,
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: err.message || "刪除失敗" },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: "伺服器錯誤，刪除失敗" }, { status: 500 });
  }
}