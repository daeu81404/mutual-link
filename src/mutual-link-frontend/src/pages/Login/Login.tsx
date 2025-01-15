import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Card, Space } from "antd";
import { GoogleOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useWeb3Auth } from "@/contexts/Web3AuthContext";
import { useEffect } from "react";

const { Content } = Layout;
const { Title, Text } = Typography;

const Login = () => {
  const { loginWithGoogle } = useWeb3Auth();
  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/home/doctor-list");
    }
  }, [isLoggedIn]);

  const handleGoogleLogin = async () => {
    const isConnected = await loginWithGoogle();
    console.log(`isConnected: ${isConnected}`);

    if (isConnected) {
      const userData = {
        hospital: "서울대병원",
        department: "정신과",
        name: "김창남",
      };
      login(userData);
      navigate("/home/doctor-list");
    }
  };

  return (
    <Layout>
      <Content
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
        }}
      >
        <Card
          style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "15px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Space
            direction="vertical"
            size="large"
            style={{
              width: "100%",
              textAlign: "center",
            }}
          >
            <div>
              <LockOutlined
                style={{
                  fontSize: "48px",
                  color: "#1890ff",
                  marginBottom: "16px",
                }}
              />
              <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
                Mutual-Link
              </Title>
              <Text type="secondary">
                의료 데이터 공유를 위한 안전한 플랫폼
              </Text>
            </div>

            <Button
              type="primary"
              icon={<GoogleOutlined />}
              onClick={handleGoogleLogin}
              size="large"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "8px",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              Google 계정으로 로그인
            </Button>
          </Space>
        </Card>
      </Content>
    </Layout>
  );
};

export default Login;
