import { useState } from "react";
import { Button, Card, Input, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";

import { loginUser, registerUser } from "../api";
import { clearUserSession, hasUserSession, setUserSession } from "../auth";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(hasUserSession());
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username || !password) {
      Toast.show({ content: "请输入账号与密码" });
      return;
    }
    setLoading(true);
    try {
      const data = await registerUser({ username, password });
      setUserSession(data.access_token);
      setLoggedIn(true);
      Toast.show({ content: "注册并登录成功" });
    } catch {
      Toast.show({ content: "注册失败，账号可能已存在" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!username || !password) {
      Toast.show({ content: "请输入账号与密码" });
      return;
    }
    setLoading(true);
    try {
      const data = await loginUser({ username, password });
      if (data.role !== "user") {
        Toast.show({ content: "请使用游客账号登录" });
        return;
      }
      setUserSession(data.access_token);
      setLoggedIn(true);
      Toast.show({ content: "登录成功" });
    } catch {
      Toast.show({ content: "登录失败" });
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearUserSession();
    setLoggedIn(false);
    Toast.show({ content: "已退出游客登录" });
  }

  return (
    <div className="page-fade-in">
      {loggedIn ? (
        <>
          {/* ===== 个人主页头部 ===== */}
          <div className="profile-hero-section">
            {/* 背景渐变 */}
            <div className="profile-hero-bg" />
            
            {/* 头像和用户信息 */}
            <div className="profile-hero-content">
              <div className="profile-avatar-large">👤</div>
              <div className="profile-hero-info">
                <h1 className="profile-hero-name">{username || "游客"}</h1>
                <p className="profile-hero-bio">探索泸沽湖，记录美好时刻</p>
                <div className="profile-hero-status">
                  <span className="status-badge verified">✓ 已验证</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== 统计面板 ===== */}
          <div className="profile-stats-grid mt-3 mb-3">
            <div className="stat-card">
              <div className="stat-number">12</div>
              <div className="stat-label">打卡次</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">8</div>
              <div className="stat-label">景点</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">2</div>
              <div className="stat-label">绘卷</div>
            </div>
          </div>

          {/* ===== 功能导航 ===== */}
          <div className="profile-action-grid mb-3">
            <Button 
              className="action-btn primary"
              onClick={() => navigate("/checkin")}
            >
              <div className="action-icon">✓</div>
              <div className="action-text">我的打卡</div>
            </Button>
            <Button 
              className="action-btn secondary"
              onClick={() => navigate("/scroll")}
            >
              <div className="action-icon">📄</div>
              <div className="action-text">旅行绘卷</div>
            </Button>
            <Button 
              className="action-btn tertiary"
              onClick={() => {}}
            >
              <div className="action-icon">🧭</div>
              <div className="action-text">我的收藏</div>
            </Button>
            <Button 
              className="action-btn quaternary"
              onClick={() => {}}
            >
              <div className="action-icon">⭐</div>
              <div className="action-text">我的勋章</div>
            </Button>
          </div>

          {/* 功能导航 ===== */}
          <div className="profile-action-grid mb-3">
            <Button 
              className="action-btn primary"
              onClick={() => navigate("/checkin")}
            >
              <div className="action-icon">✓</div>
              <div className="action-text">我的打卡</div>
            </Button>
            <Button 
              className="action-btn secondary"
              onClick={() => navigate("/scroll")}
            >
              <div className="action-icon">📄</div>
              <div className="action-text">旅行绘卷</div>
            </Button>
            <Button 
              className="action-btn tertiary"
              onClick={() => {}}
            >
              <div className="action-icon">🧭</div>
              <div className="action-text">我的收藏</div>
            </Button>
            <Button 
              className="action-btn quaternary"
              onClick={() => {}}
            >
              <div className="action-icon">⭐</div>
              <div className="action-text">我的勋章</div>
            </Button>
          </div>

          {/* ===== 个人信息编辑 ===== */}
          <div className="profile-section">
            <div className="section-title">个人信息</div>
            <Card className="card card-glass">
              <div className="form-group">
                <label className="form-label">账号</label>
                <Input 
                  value={username} 
                  disabled 
                  readOnly
                  placeholder="未设置" 
                  className="input-disabled"
                />
              </div>
              <div className="divider-soft my-3"></div>
              <div className="form-group">
                <label className="form-label">个性签名</label>
                <Input 
                  placeholder="分享你的旅行故事..."
                  maxLength={100}
                  className="signature-input"
                />
                <div className="input-helper-text">最多 100 字</div>
              </div>
            </Card>
          </div>

          {/* ===== 账户操作 ===== */}
          <div className="profile-section mb-2">
            <div className="section-title">账户</div>
            <Button 
              block 
              color="danger" 
              className="logout-btn mt-2"
              onClick={handleLogout}
            >
              🚪 退出登录
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* ===== 未登录状态 ===== */}
          <div className="hero-shell mb-3">
            <div className="hero-kicker">游客中心</div>
            <h1 className="page-title m-0">我的</h1>
            <p className="hero-copy">登录账号解锁完整功能，记录你的泸沽湖之旅。</p>
          </div>

          {/* 登录表单 */}
          <Card className="card card-glass mb-3">
            <div className="form-group">
              <label className="form-label">账号</label>
              <Input 
                value={username} 
                onChange={setUsername} 
                placeholder="输入账号" 
                clearable 
              />
              <div className="input-helper-text">
                如果没有账号，可以先注册一个
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">密码</label>
              <Input 
                value={password} 
                onChange={setPassword} 
                placeholder="输入密码" 
                type="password" 
                clearable 
              />
            </div>

            <div className="button-group-horizontal">
              <Button 
                loading={loading} 
                block 
                onClick={handleRegister}
                style={{ gridColumn: "1 / span 1" }}
              >
                注册新账号
              </Button>
              <Button 
                color="primary" 
                loading={loading} 
                block 
                onClick={handleLogin}
                style={{ gridColumn: "2 / span 1" }}
              >
                登录
              </Button>
            </div>
          </Card>

          {/* 快速开始guide */}
          <Card className="card card-neon mb-3">
            <div className="profile-tips">
              <div className="tips-title">🚀 快速开始</div>
              <ol className="tips-list">
                <li><strong>注册账号：</strong>输入账号和密码，创建游客账号</li>
                <li><strong>浏览景点：</strong>在首页浏览泸沽湖各大景点</li>
                <li><strong>AI 导览：</strong>使用智能导览了解景点信息</li>
                <li><strong>打卡记录：</strong>打卡景点记录旅行足迹</li>
                <li><strong>生成绘卷：</strong>完成旅行后生成专属绘卷</li>
              </ol>
            </div>
          </Card>

          {/* 核心功能展示 */}
          <div className="features-showcase mb-3">
            <div className="section-title">核心功能</div>
            <div className="features-grid">
              <Card className="feature-card">
                <div className="feature-showcase-icon">🧭</div>
                <div className="feature-showcase-title">AI 导览</div>
              </Card>
              <Card className="feature-card">
                <div className="feature-showcase-icon">✓</div>
                <div className="feature-showcase-title">打卡点位</div>
              </Card>
              <Card className="feature-card">
                <div className="feature-showcase-icon">📄</div>
                <div className="feature-showcase-title">旅行绘卷</div>
              </Card>
              <Card className="feature-card">
                <div className="feature-showcase-icon">📍</div>
                <div className="feature-showcase-title">景点详情</div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
