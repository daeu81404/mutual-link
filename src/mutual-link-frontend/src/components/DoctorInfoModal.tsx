import { Modal, Descriptions, Avatar, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";

interface DoctorInfoModalProps {
  visible: boolean;
  onClose: () => void;
  doctor: {
    name: string;
    email: string;
    phone: string;
    hospital: string;
    department: string;
  } | null;
}

const DoctorInfoModal: React.FC<DoctorInfoModalProps> = ({
  visible,
  onClose,
  doctor,
}) => {
  if (!doctor) return null;

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
              {doctor.name}
              <Tag
                color="var(--primary-color)"
                style={{
                  marginLeft: "8px",
                  borderRadius: "4px",
                  padding: "0 8px",
                  fontSize: "12px",
                }}
              >
                의사
              </Tag>
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-color)" }}>
              {doctor.hospital} · {doctor.department}
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
          <Descriptions.Item label="이메일">{doctor.email}</Descriptions.Item>
          <Descriptions.Item label="연락처">{doctor.phone}</Descriptions.Item>
          <Descriptions.Item label="병원">{doctor.hospital}</Descriptions.Item>
          <Descriptions.Item label="부서">
            {doctor.department}
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  );
};

export default DoctorInfoModal;
