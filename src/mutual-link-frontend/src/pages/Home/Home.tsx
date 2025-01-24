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
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { regularMenuItems, adminMenuItems } from "@/constants/menuItems";
import { useAuth } from "@/contexts/AuthContext";
import { useWeb3Auth } from "@/contexts/Web3AuthContext";
import UserInfoModal from "@/components/UserInfoModal";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useToken } = theme;

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const [userInfoModalVisible, setUserInfoModalVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout: authLogout, userInfo } = useAuth();
  const { logout: web3AuthLogout } = useWeb3Auth();
  const { token } = useToken();

  const menuItems = [
    ...regularMenuItems,
    ...(userInfo?.role === "admin" ? adminMenuItems : []),
  ];

  const getSelectedKey = () => {
    const path = location.pathname.split("/").pop() || "";
    if (path === "doctor-list") return "doctorList";
    if (path === "approval-waiting") return "approvalWaiting";
    if (path === "medical-data-send") return "medicalDataSend";
    if (path === "medical-data-receive") return "medicalDataReceive";
    if (path === "user-management") return "userManagement";
    if (path === "hospital-management") return "hospitalManagement";
    if (path === "medical-record-waiting") return "medicalRecordWaiting";
    return "doctorList";
  };

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
      case "medicalRecordWaiting":
        navigate("/home/medical-record-waiting");
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
          <Title
            level={3}
            style={{
              margin: 0,
              color: token.colorPrimary,
              display: "flex",
              alignItems: "center",
            }}
          >
            <img
              src="/favicon.ico"
              alt="Mutual Link Logo"
              style={{
                width: "28px",
                height: "28px",
                marginRight: "8px",
                display: "block",
              }}
            />
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
          <Space
            style={{ cursor: "pointer" }}
            onClick={() => setUserInfoModalVisible(true)}
          >
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
          trigger={null}
          collapsible
          collapsed={collapsed}
          style={{
            background: "var(--background-color)",
            boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
          }}
          width={250}
        >
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            onClick={handleMenuClick}
            style={{
              height: "100%",
              borderRight: 0,
              background: "var(--background-color)",
            }}
            items={menuItems}
            theme="light"
            className="sidebar-menu"
          />
        </Sider>
        <Layout
          style={{
            padding: "24px",
            background: "var(--background-color)",
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <Content
            style={{
              padding: 24,
              margin: 0,
              background: "#fff",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              minHeight: 280,
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
      <UserInfoModal
        visible={userInfoModalVisible}
        onClose={() => setUserInfoModalVisible(false)}
        userInfo={userInfo}
      />
    </Layout>
  );
}
