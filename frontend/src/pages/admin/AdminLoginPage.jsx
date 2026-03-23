import { useState } from "react";
import { Button, Card, Input, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";

import api from "../../api";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { username, password });
      if (data.role !== "admin") {
        Toast.show({ content: "当前账号不是管理员" });
        return;
      }
      localStorage.setItem("admin_token", data.access_token);
      navigate("/admin");
    } catch {
      Toast.show({ content: "登录失败，请检查账号密码" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mobile-shell p-4 page-fade-in">
      <div className="hero-shell mb-3">
        <div className="hero-kicker">Admin Access</div>
        <h1 className="page-title m-0">管理员登录</h1>
        <p className="hero-copy">进入后台进行景点、二维码与数据看板管理。</p>
      </div>

      <Card className="card card-glass">
        <div className="space-y-3">
          <Input value={username} onChange={setUsername} placeholder="管理员账号" clearable />
          <Input value={password} onChange={setPassword} type="password" placeholder="密码" clearable />
          <Button color="primary" loading={loading} block onClick={handleLogin}>
            登录后台
          </Button>
        </div>
      </Card>
    </div>
  );
}
