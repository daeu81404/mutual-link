import { Table, Button, message, Modal, Form, Input, Upload } from "antd";
import { useState, useEffect } from "react";
import type { ColumnsType } from "antd/es/table";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import { UploadOutlined } from "@ant-design/icons";

interface BackendDoctor {
  id: bigint;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: string;
}

interface Doctor {
  no: string;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
}

const DoctorList = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendActor, setBackendActor] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    const initActor = async () => {
      try {
        const currentHost = window.location.hostname;
        const host = currentHost.includes("localhost")
          ? `http://${currentHost}:4943`
          : "http://127.0.0.1:4943";

        const agent = new HttpAgent({ host });

        if (host.includes("localhost") || host.includes("127.0.0.1")) {
          await agent.fetchRootKey();
        }

        const canisterId = "bkyz2-fmaaa-aaaaa-qaaaq-cai";

        const actor = Actor.createActor(idlFactory, {
          agent,
          canisterId,
        });

        setBackendActor(actor);
        return actor;
      } catch (error) {
        console.error("Actor 초기화 실패:", error);
        message.error("백엔드 연결에 실패했습니다.");
        return null;
      }
    };

    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const actor = await initActor();
        if (!actor) return;

        const result = (await actor.getAllDoctors()) as BackendDoctor[];
        const formattedDoctors = result.map((doctor: BackendDoctor) => ({
          no: doctor.id.toString(),
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          hospital: doctor.hospital,
          department: doctor.department,
        }));
        setDoctors(formattedDoctors);
      } catch (error) {
        console.error("의사 목록 조회 실패:", error);
        message.error(
          "의사 목록을 가져오는데 실패했습니다. 개발자 도구의 콘솔을 확인해주세요."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const handleUploadClick = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsModalOpen(true);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleModalSubmit = async (values: any) => {
    try {
      // TODO: 실제 업로드 로직 구현
      console.log("제출된 데이터:", values);
      message.success("진료 기록이 성공적으로 전송되었습니다.");
      handleModalCancel();
    } catch (error) {
      console.error("업로드 실패:", error);
      message.error("진료 기록 전송에 실패했습니다.");
    }
  };

  const columns: ColumnsType<Doctor> = [
    { title: "No", dataIndex: "no", key: "no" },
    { title: "담당의사", dataIndex: "name", key: "name" },
    { title: "이메일", dataIndex: "email", key: "email" },
    { title: "휴대폰", dataIndex: "phone", key: "phone" },
    { title: "병원", dataIndex: "hospital", key: "hospital" },
    { title: "부서", dataIndex: "department", key: "department" },
    {
      title: "환자 진료 기록 전송",
      key: "action",
      render: (_, record) => (
        <Button type="primary" onClick={() => handleUploadClick(record)}>
          환자 진료 기록 전송
        </Button>
      ),
    },
  ];

  return (
    <>
      <Table
        columns={columns}
        dataSource={doctors}
        rowKey="no"
        loading={loading}
      />
      <Modal
        title="환자 진료 기록 업로드"
        open={isModalOpen}
        onCancel={handleModalCancel}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleModalSubmit}>
          <Form.Item
            label="제목"
            name="title"
            rules={[{ required: true, message: "제목을 입력해주세요" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="환자명"
            name="patientName"
            rules={[{ required: true, message: "환자명을 입력해주세요" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="휴대폰"
            name="phone"
            rules={[{ required: true, message: "휴대폰 번호를 입력해주세요" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="소견" name="description">
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item
            label="업로드 할 파일"
            name="files"
            rules={[{ required: true, message: "파일을 선택해주세요" }]}
          >
            <Upload.Dragger
              name="files"
              multiple={false}
              beforeUpload={() => false}
              accept=".zip,.jpg,.png,.gif,.bmp,.webp,.pdf,.dicom"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Click to Upload</p>
              <p className="ant-upload-hint">
                압축(zip) 파일만 업로드 가능합니다.
                <br />
                압축파일 안에는 [dicom, jpg, png, gif, bmp, webp, pdf] 파일만
                포함 가능합니다.
              </p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ float: "right" }}>
              등록
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DoctorList;
