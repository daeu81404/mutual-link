import { Modal, Descriptions, Avatar } from "antd";
import { UserInfo } from "@/types/auth";
import { UserOutlined } from "@ant-design/icons";

interface UserInfoModalProps {
  visible: boolean;
  onClose: () => void;
  userInfo: UserInfo | null;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({
  visible,
  onClose,
  userInfo,
}) => {
  if (!userInfo) return null;

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Avatar
            size={40}
            icon={<UserOutlined />}
            style={{
              backgroundColor: "var(--primary-color)",
              color: "#fff",
            }}
          />
          <div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              {userInfo.name}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-color)" }}>
              {userInfo.hospital} · {userInfo.department}
            </div>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <div style={{ marginTop: "16px" }}>
        <Descriptions
          column={1}
          bordered
          labelStyle={{
            width: "120px",
            backgroundColor: "var(--background-color)",
          }}
          contentStyle={{
            backgroundColor: "#fff",
          }}
        >
          <Descriptions.Item label="이메일">{userInfo.email}</Descriptions.Item>
          <Descriptions.Item label="전화번호">
            {userInfo.phone}
          </Descriptions.Item>
          <Descriptions.Item label="병원">
            {userInfo.hospital}
          </Descriptions.Item>
          <Descriptions.Item label="진료과">
            {userInfo.department}
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  );
};

export default UserInfoModal;
