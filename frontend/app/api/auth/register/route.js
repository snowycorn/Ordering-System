import { NextResponse } from "next/server";
import { ENDPOINTS, SERVICES, USE_LOCAL_MOCKS, apiFetch, jsonOrEmpty, serviceUrl } from "@/lib/api";

function mockRegistration(payload) {
  const id = `USR-DEMO-${Date.now()}`;
  return {
    id,
    email: payload.email,
    role: "employee",
    created_at: new Date().toISOString(),
    employee: {
      id: `EMP-DEMO-${Date.now()}`,
      user_id: id,
      employee_no: payload.employee_no || payload.employeeNo,
      name: payload.name,
      department: payload.department,
      phone: payload.phone,
    },
    mock: true,
  };
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  if (!payload.email || !payload.password || !payload.name) {
    return NextResponse.json({ message: "請填寫姓名、Email 與密碼" }, { status: 400 });
  }

  const userPayload = {
    email: payload.email,
    password: payload.password,
    role: "employee",
  };

  try {
    const userRes = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamUsers), {
      method: "POST",
      body: userPayload,
    });
    const user = await jsonOrEmpty(userRes);

    if (!userRes.ok) {
      return NextResponse.json(
        { message: user.message || "註冊失敗，請稍後再試" },
        { status: userRes.status },
      );
    }

    const userId = user.id || user.userId || user.user_id;
    const employeePayload = {
      user_id: userId,
      userId,
      employee_no: payload.employee_no || payload.employeeNo,
      name: payload.name,
      department: payload.department,
      phone: payload.phone,
      email: payload.email,
    };

    let employee = null;
    let employeeWarning = "";

    if (userId) {
      try {
        const employeeRes = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamEmployees), {
          method: "POST",
          body: employeePayload,
        });
        employee = await jsonOrEmpty(employeeRes);
        if (!employeeRes.ok) {
          employeeWarning = employee.message || "員工資料尚未建立完成";
          employee = null;
        }
      } catch {
        employeeWarning = "員工資料服務暫時無法連線";
      }
    }

    return NextResponse.json(
      {
        ...user,
        employee,
        employeeWarning,
      },
      { status: userRes.status || 201 },
    );
  } catch {
    if (USE_LOCAL_MOCKS) {
      return NextResponse.json(mockRegistration(payload), { status: 201 });
    }

    return NextResponse.json({ message: "IAM 服務無法連線" }, { status: 503 });
  }
}
