import { useState } from "react";
import { Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";

import { loginUser } from "../../api";
import { buildAdminDashboardPath, setAdminSession } from "../../auth";
import { ImmersivePage, CardComponent, GlassInput, ButtonComponent } from "../../components/SharedUI";
import LucideIcon from "../../components/LucideIcon";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    setLoading(true);
    try {
      const data = await loginUser({ username, password });
      if (data.role !== "admin") {
        Toast.show({ content: "当前账号不是管理员" });
        return;
      }
      setAdminSession("", data?.username || username);
      navigate(buildAdminDashboardPath(), { replace: true });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      if (detail) {
        Toast.show({ content: String(detail) });
      } else {
        Toast.show({ content: "登录失败，请检查账号密码" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImmersivePage bgImage="/images/lugu-hero.png" className="items-center justify-center">
      <div className="w-full max-w-sm px-4 flex flex-col justify-center min-h-[60vh]">
        <div className="text-center mb-8">
          <div className="inline-block bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-white/90 text-xs tracking-widest mb-4 border border-white/20 shadow-lg">
            Admin Access
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-wider font-serif drop-shadow-md">
            管理员登录
          </h1>
          <p className="text-white/80 text-sm tracking-wide drop-shadow">
            进入后台进行管理
          </p>
        </div>

        <CardComponent variant="glass" className="p-6">
          <div className="space-y-4">
            <GlassInput
              value={username}
              onChange={setUsername}
              placeholder="管理员账号"
              icon={<LucideIcon name="User" size={16} strokeWidth={2} />}
            />
            <GlassInput
              value={password}
              onChange={setPassword}
              inputType="password"
              placeholder="密码"
              icon={<LucideIcon name="Lock" size={16} strokeWidth={2} />}
            />
            <ButtonComponent
              variant="primary"
              className="w-full mt-2"
              onClick={handleLogin}
            >
              {loading ? "登录中..." : "登录后台"}
            </ButtonComponent>
          </div>
        </CardComponent>
      </div>
    </ImmersivePage>
  );
}
