import { Modal, Descriptions } from "antd";
import { UserInfo } from "@/types/auth";

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
      title="사용자 정보"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Descriptions column={1}>
        <Descriptions.Item label="이름">{userInfo.name}</Descriptions.Item>
        <Descriptions.Item label="이메일">{userInfo.email}</Descriptions.Item>
        <Descriptions.Item label="전화번호">{userInfo.phone}</Descriptions.Item>
        <Descriptions.Item label="병원">{userInfo.hospital}</Descriptions.Item>
        <Descriptions.Item label="진료과">
          {userInfo.department}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default UserInfoModal;
