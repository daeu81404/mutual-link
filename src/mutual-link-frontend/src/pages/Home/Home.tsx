import { Layout, Menu, Button, Typography, Space } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useState } from "react";
import { menuItems } from "@/constants/menuItems";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuClick = (e: { key: string }) => {
    switch (e.key) {
      case "doctorList":
        console.log("의사목록 선택됨");
        break;
      case "approvalWaiting":
        console.log("승인대기 선택됨");
        break;
      case "medicalDataSend":
        console.log("진료데이터(송신) 선택됨");
        break;
      case "medicalDataReceive":
        console.log("진료데이터(수신) 선택됨");
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
          width={250}
          theme="light"
          breakpoint="lg"
          collapsedWidth={80}
          collapsed={collapsed}
          onCollapse={(collapsed) => setCollapsed(collapsed)}
        >
          <Menu
            mode="inline"
            defaultSelectedKeys={["doctors"]}
            style={{ height: "100%", borderRight: 0 }}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        <Content
          style={{
            padding: 24,
            background: "linear-gradient(135deg, #4a90e2 0%, #357abd 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center", color: "white" }}>
            <Title style={{ color: "white", fontSize: "3rem" }}>
              Mutual Link
            </Title>
            <Text style={{ color: "white", fontSize: "1.2rem" }}>
              응급 환자 이송 플랫폼
            </Text>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
