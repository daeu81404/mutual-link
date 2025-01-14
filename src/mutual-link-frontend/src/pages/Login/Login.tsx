import { Layout, Typography, Button } from "antd";
import { useNavigate } from "react-router-dom";

const { Content } = Layout;
const { Title } = Typography;

const Login = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = () => {
    // TODO: Implement Google Login
    navigate("/home/doctor-list");
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
        }}
      >
        <Title level={3}>Mutual-Link Admin</Title>
        <Button
          type="primary"
          onClick={handleGoogleLogin}
          style={{
            width: "300px",
            height: "40px",
            borderRadius: "8px",
          }}
        >
          Google Login
        </Button>
      </Content>
    </Layout>
  );
};

export default Login;
