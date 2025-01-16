import { Table, Button, message, Modal, Form, Input, Upload } from "antd";
import { useState, useEffect } from "react";
import type { ColumnsType } from "antd/es/table";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import { UploadOutlined } from "@ant-design/icons";
import CryptoJS from "crypto-js";
import { useAuth } from "@/contexts/AuthContext";

interface BackendDoctor {
  id: bigint;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: string;
  publicKey: [] | [string];
}

interface Doctor {
  no: string;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  publicKey?: string;
}

const uploadToIPFS = async (
  encryptedContent: string
): Promise<string | null> => {
  try {
    // 암호화된 내용을 Blob으로 변환
    const blob = new Blob([encryptedContent], { type: "text/plain" });
    const file = new File([blob], "encrypted.txt", { type: "text/plain" });

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://ipfs.infura.io:5001/api/v0/add", {
      method: "POST",
      body: formData,
      headers: {
        Authorization:
          "Basic " +
          btoa(
            "52f7d11b90ec45f1ac9912d0fb864695:248a2ce514834460a25058bf8068e740"
          ),
      },
    });

    const data = await response.json();
    return data?.Hash ?? null;
  } catch (error) {
    console.error("IPFS 업로드 실패:", error);
    return null;
  }
};

const DoctorList = () => {
  const { userInfo } = useAuth();
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
          publicKey: doctor.publicKey[0] || undefined,
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
      // 1. AES key 생성
      const aesKey = CryptoJS.lib.WordArray.random(256 / 8);
      const aesKeyString = aesKey.toString();

      // 2. 파일 암호화
      const file = values.files?.fileList[0]?.originFileObj;
      if (!file) {
        message.error("파일을 선택해주세요.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target?.result as string;

        // 파일 내용 암호화
        const encryptedFile = CryptoJS.AES.encrypt(
          fileContent,
          aesKeyString
        ).toString();

        // 3. 송신자의 public key로 AES key 암호화
        // TODO: 실제 송신자의 public key 가져오기
        const senderPublicKey = "sender_public_key";
        const encryptedAesKeyForSender = CryptoJS.AES.encrypt(
          aesKeyString,
          senderPublicKey
        ).toString();

        // 4. 수신자의 public key로 AES key 암호화
        const receiverPublicKey = selectedDoctor?.publicKey || "";
        const encryptedAesKeyForReceiver = CryptoJS.AES.encrypt(
          aesKeyString,
          receiverPublicKey
        ).toString();

        // 5. 암호화된 파일을 IPFS에 업로드
        const cid = await uploadToIPFS(encryptedFile);
        if (!cid) {
          message.error("IPFS 업로드에 실패했습니다.");
          return;
        }

        console.log("cid", cid);

        // TODO: 백엔드로 CID와 암호화된 키 전송하는 로직 구현
        console.log("제출된 데이터:", {
          ...values,
          cid,
          encryptedAesKeyForSender,
          encryptedAesKeyForReceiver,
        });

        message.success("진료 기록이 성공적으로 전송되었습니다.");
        handleModalCancel();
      };

      reader.readAsText(file);
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
      render: (_, record) => {
        // 현재 로그인한 사용자와 동일한 의사인 경우
        if (record.name === userInfo?.name) {
          return <span style={{ color: "#666" }}>본인</span>;
        }
        // public key가 없는 경우
        if (!record.publicKey) {
          return <span style={{ color: "#ff4d4f" }}>최초 로그인 대기</span>;
        }
        return (
          <Button type="primary" onClick={() => handleUploadClick(record)}>
            환자 진료 기록 전송
          </Button>
        );
      },
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
        footer={
          <div
            style={{
              textAlign: "center",
              margin: "0 -24px -24px",
              padding: "16px 24px",
              borderTop: "1px solid #f0f0f0",
            }}
          >
            <Button
              key="cancel"
              onClick={handleModalCancel}
              style={{ marginRight: 8 }}
            >
              취소
            </Button>
            <Button key="submit" type="primary" onClick={form.submit}>
              등록
            </Button>
          </div>
        }
        width={520}
        style={{ top: 20 }}
        bodyStyle={{
          padding: "24px",
          maxHeight: "calc(100vh - 200px)",
          overflow: "auto",
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleModalSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <Form.Item
            label="제목"
            name="title"
            rules={[{ required: true, message: "제목을 입력해주세요" }]}
            style={{ marginBottom: 0 }}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="환자명"
            name="patientName"
            rules={[{ required: true, message: "환자명을 입력해주세요" }]}
            style={{ marginBottom: 0 }}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="휴대폰"
            name="phone"
            rules={[{ required: true, message: "휴대폰 번호를 입력해주세요" }]}
            style={{ marginBottom: 0 }}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="소견"
            name="description"
            style={{
              marginBottom: 0,
              marginLeft: -24,
              marginRight: -24,
              width: "calc(100%)",
            }}
          >
            <Input.TextArea
              rows={6}
              style={{
                width: "100%",
                resize: "none",
                borderRadius: 0,
              }}
            />
          </Form.Item>

          <Form.Item
            label="업로드 할 파일"
            name="files"
            rules={[{ required: true, message: "파일을 선택해주세요" }]}
            style={{ marginBottom: 0 }}
          >
            <Upload.Dragger
              name="files"
              multiple={false}
              maxCount={1}
              beforeUpload={(file) => {
                const isZip =
                  file.type === "application/zip" ||
                  file.type === "application/x-zip-compressed" ||
                  file.name.endsWith(".zip");
                if (!isZip) {
                  message.error("ZIP 파일만 업로드 가능합니다.");
                }
                return false;
              }}
              accept=".zip"
              style={{ padding: "16px 0" }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined
                  style={{ fontSize: "32px", color: "#40a9ff" }}
                />
              </p>
              <p
                className="ant-upload-text"
                style={{ fontSize: "16px", margin: "8px 0" }}
              >
                Click to Upload
              </p>
              <p className="ant-upload-hint" style={{ color: "#666" }}>
                압축(zip) 파일만 업로드 가능합니다.
                <br />
                압축파일 안에는 [dicom, jpg, png, gif, bmp, webp, pdf] 파일만
                포함 가능합니다.
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DoctorList;
