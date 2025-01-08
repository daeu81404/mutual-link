import { Layout, Menu, Button, Typography, Space } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { menuItems } from "@/constants/menuItems";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleMenuClick = (e: { key: string }) => {
    switch (e.key) {
      case "doctorList":
        navigate("/doctor-list");
        break;
      case "approvalWaiting":
        navigate("/approval-waiting");
        break;
      case "medicalDataSend":
        navigate("/medical-data-send");
        break;
      case "medicalDataReceive":
        navigate("/medical-data-receive");
        break;
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: "16px", width: 64, height: 64 }}
          />
          <Title level={3} style={{ margin: 0 }}>
            Mutual Link
          </Title>
        </div>
        <Space>
          <Text>서울대병원 정신과</Text>
          <Text>김창남님</Text>
          <Button type="default">로그아웃</Button>
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
        >
          <Menu
            mode="inline"
            defaultSelectedKeys={["doctorList"]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        <Content style={{ padding: 24, background: "#fff" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
