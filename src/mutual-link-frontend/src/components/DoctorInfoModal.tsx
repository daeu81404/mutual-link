import { Modal, Descriptions } from "antd";

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
      title="의사 정보"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Descriptions column={1}>
        <Descriptions.Item label="이름">{doctor.name}</Descriptions.Item>
        <Descriptions.Item label="이메일">{doctor.email}</Descriptions.Item>
        <Descriptions.Item label="연락처">{doctor.phone}</Descriptions.Item>
        <Descriptions.Item label="병원">{doctor.hospital}</Descriptions.Item>
        <Descriptions.Item label="부서">{doctor.department}</Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default DoctorInfoModal;
