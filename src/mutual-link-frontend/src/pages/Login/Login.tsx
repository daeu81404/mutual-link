import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Card, Space } from "antd";
import { GoogleOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useWeb3Auth } from "@/contexts/Web3AuthContext";
import { useEffect } from "react";
import { Actor, HttpAgent } from "@dfinity/agent";
import {
  idlFactory,
  Result,
  _SERVICE,
} from "@/declarations/mutual-link-backend";

const { Content } = Layout;
const { Title, Text } = Typography;

const CANISTER_ID =
  process.env.VITE_CANISTER_ID_MUTUAL_LINK_BACKEND ||
  "bkyz2-fmaaa-aaaaa-qaaaq-cai";

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
    const result = await loginWithGoogle();
    console.log(`로그인 결과:`, result);

    if (result.connected && result.publicKey && result.email) {
      const userData = {
        hospital: "서울대병원",
        department: "정신과",
        name: "김창남",
        role: "admin", // user|admin
        email: result.email,
      };

      try {
        // 백엔드 actor 생성
        const agent = new HttpAgent();

        // 로컬 개발 환경에서는 인증서 검증을 비활성화
        if (process.env.NODE_ENV !== "production") {
          await agent.fetchRootKey();
        }

        const actor = Actor.createActor<_SERVICE>(idlFactory, {
          agent,
          canisterId: CANISTER_ID,
        });

        // public key 업데이트
        const updateResult = await actor.updateDoctorPublicKey(
          userData.email,
          result.publicKey
        );
        console.log("Public key 업데이트 결과:", updateResult);

        if ("ok" in updateResult) {
          login(userData);
          navigate("/home/doctor-list");
        } else {
          console.error("Public key 업데이트 실패:", updateResult.err);
        }
      } catch (error) {
        console.error("백엔드 통신 중 오류 발생:", error);
      }
    } else {
      console.error("로그인 실패: 필요한 정보를 가져오지 못했습니다.");
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
