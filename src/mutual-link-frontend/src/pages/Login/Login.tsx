import { useNavigate } from "react-router-dom";
import { Layout, Typography, Button, Card, Space, message, Spin } from "antd";
import { GoogleOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useWeb3Auth } from "@/contexts/Web3AuthContext";
import { useEffect, useState } from "react";
import { createActor } from "../../utils/actor";
import type { _SERVICE } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did";
import styles from "./Login.module.css";

const { Content } = Layout;
const { Title, Text } = Typography;

const CANISTER_ID =
  process.env.VITE_CANISTER_ID_MUTUAL_LINK_BACKEND ||
  "bkyz2-fmaaa-aaaaa-qaaaq-cai";

const Login = () => {
  const { login, isLoggedIn } = useAuth();
  const { loginWithGoogle, logout } = useWeb3Auth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/home/doctor-list");
    }
  }, [isLoggedIn]);

  const handleGoogleLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const result = await loginWithGoogle();

      if (result.connected && result.publicKey && result.email) {
        try {
          const actor = await createActor();

          // 먼저 사용자 존재 여부 확인
          const doctorResult = await actor.getDoctorByEmail(result.email);

          if (!doctorResult.length) {
            message.error(
              "등록되지 않은 의사 계정입니다. 병원 관리자에게 계정 등록을 요청해주세요."
            );
            await logout();
            return;
          }

          const doctor = doctorResult[0];
          const userData = {
            hospital: doctor.hospital,
            department: doctor.department,
            name: doctor.name,
            role: doctor.role,
            email: doctor.email,
            phone: doctor.phone,
            publicKey: result.publicKey || undefined,
            privateKey: result.privateKey || undefined,
            id: doctor.id.toString(),
          };

          // public key가 이미 등록되어 있는지 확인
          if (doctor.publicKey.length > 0) {
            // 이미 등록된 public key가 현재 key와 같은지 확인
            if (doctor.publicKey[0] === result.publicKey) {
              login(userData);
              navigate("/home/doctor-list");
              return;
            } else {
              message.error(
                "이미 다른 기기에서 로그인된 계정입니다. 기존 기기에서 로그아웃 후 다시 시도하시거나 병원 관리자에게 문의해주세요."
              );
              await logout();
              return;
            }
          }

          // public key가 없는 경우에만 업데이트 진행
          const updateResult = await actor.updateDoctorPublicKey(
            userData.email,
            result.publicKey
          );

          if ("ok" in updateResult) {
            login(userData);
            navigate("/home/doctor-list");
          } else {
            message.error(updateResult.err);
            await logout();
          }
        } catch (error) {
          message.error("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
          await logout();
        }
      } else {
        message.error(
          "구글 계정 정보를 가져올 수 없습니다. 다시 시도해주세요."
        );
        await logout();
      }
    } finally {
      setIsLoading(false);
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
              loading={isLoading}
              disabled={isLoading}
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
              {isLoading ? "로그인 중..." : "Google 계정으로 로그인"}
            </Button>
          </Space>
        </Card>
      </Content>
    </Layout>
  );
};

export default Login;
