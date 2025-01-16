import {
  Layout,
  Menu,
  Button,
  Typography,
  Space,
  Avatar,
  Badge,
  theme,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { regularMenuItems, adminMenuItems } from "@/constants/menuItems";
import { useAuth } from "@/contexts/AuthContext";
import { useWeb3Auth } from "@/contexts/Web3AuthContext";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useToken } = theme;

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { logout: authLogout, userInfo } = useAuth();
  const { logout: web3AuthLogout } = useWeb3Auth();
  const { token } = useToken();

  const menuItems = [
    ...regularMenuItems,
    ...(userInfo?.role === "admin" ? adminMenuItems : []),
  ];

  const handleLogout = async () => {
    await web3AuthLogout();
    authLogout();
    navigate("/login");
  };

  const handleMenuClick = (e: { key: string }) => {
    switch (e.key) {
      case "doctorList":
        navigate("/home/doctor-list");
        break;
      case "approvalWaiting":
        navigate("/home/approval-waiting");
        break;
      case "medicalDataSend":
        navigate("/home/medical-data-send");
        break;
      case "medicalDataReceive":
        navigate("/home/medical-data-receive");
        break;
      case "userManagement":
        navigate("/home/user-management");
        break;
      case "hospitalManagement":
        navigate("/home/hospital-management");
        break;
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: token.colorBgContainer,
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: "16px",
              width: 64,
              height: 64,
              transition: "all 0.2s",
            }}
          />
          <Title level={3} style={{ margin: 0, color: token.colorPrimary }}>
            Mutual Link
          </Title>
        </div>
        <Space size="large">
          <Badge count={5} size="small">
            <Button
              type="text"
              icon={<BellOutlined style={{ fontSize: "20px" }} />}
              style={{ width: 48, height: 48 }}
            />
          </Badge>
          <Space>
            <Avatar
              style={{ backgroundColor: token.colorPrimary }}
              icon={<UserOutlined />}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Text strong>{userInfo?.name}님</Text>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {userInfo?.hospital} {userInfo?.department}
              </Text>
            </div>
          </Space>
          <Button type="primary" ghost onClick={handleLogout}>
            로그아웃
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          width={250}
          theme="light"
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
            height: "calc(100vh - 64px)",
            position: "sticky",
            left: 0,
            top: 64,
            overflow: "auto",
          }}
        >
          <Menu
            mode="inline"
            defaultSelectedKeys={["doctorList"]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ padding: "16px 0" }}
          />
        </Sider>
        <Content
          style={{
            padding: 24,
            background: token.colorBgContainer,
            margin: "24px",
            borderRadius: token.borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
