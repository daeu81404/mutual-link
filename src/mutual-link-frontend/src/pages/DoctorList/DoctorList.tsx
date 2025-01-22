import {
  Table,
  Button,
  message,
  Modal,
  Form,
  Input,
  Upload,
  Input as AntInput,
  Card,
  Row,
  Col,
  Statistic,
  Select,
} from "antd";
import { useState, useEffect } from "react";
import type { ColumnsType } from "antd/es/table";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import { UploadOutlined } from "@ant-design/icons";
import CryptoJS from "crypto-js";
import { useAuth } from "@/contexts/AuthContext";
import * as eccrypto from "@toruslabs/eccrypto";

const { Search } = AntInput;

interface BackendDoctor {
  id: bigint;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: string;
  publicKey: string[];
}

interface Doctor {
  id: number;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: string;
  publicKey: string;
}

// 청크 크기를 500KB로 수정 (메모리 사용량 최적화)
const CHUNK_SIZE = 500 * 1024;

// 파일을 청크 단위로 암호화하여 업로드하는 함수
const encryptAndUploadFile = async (
  file: File,
  aesKey: string,
  onProgress?: (progress: number) => void
): Promise<string | null> => {
  try {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let processedSize = 0;
    const encryptedChunks: Uint8Array[] = [];

    // 파일을 청크 단위로 읽고 암호화
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();

      // 청크 암호화
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
      const encryptedWordArray = CryptoJS.AES.encrypt(wordArray, aesKey);

      // 암호화된 데이터를 Uint8Array로 변환
      const encryptedBase64 = encryptedWordArray.toString();
      const binaryString = atob(encryptedBase64);
      const encryptedBytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        encryptedBytes[j] = binaryString.charCodeAt(j);
      }

      encryptedChunks.push(encryptedBytes);
      processedSize += arrayBuffer.byteLength;

      // 진행률 업데이트 (80%까지는 암호화 작업)
      if (onProgress) {
        onProgress((processedSize / file.size) * 80);
      }

      // 메모리 해제를 위해 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (onProgress) {
      onProgress(90); // 암호화 완료
    }

    // 모든 청크를 하나의 파일로 합치기
    const totalSize = encryptedChunks.reduce(
      (acc, chunk) => acc + chunk.length,
      0
    );
    const combinedArray = new Uint8Array(totalSize + totalChunks * 4); // 각 청크의 크기 정보를 저장하기 위해 4바이트씩 추가

    let offset = 0;
    for (const chunk of encryptedChunks) {
      // 청크 크기 저장 (4바이트)
      const chunkSize = chunk.length;
      combinedArray[offset++] = (chunkSize >> 24) & 0xff;
      combinedArray[offset++] = (chunkSize >> 16) & 0xff;
      combinedArray[offset++] = (chunkSize >> 8) & 0xff;
      combinedArray[offset++] = chunkSize & 0xff;

      // 청크 데이터 저장
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }

    // IPFS에 업로드
    const blob = new Blob([combinedArray], {
      type: "application/octet-stream",
    });
    const encryptedFile = new File([blob], "encrypted_file.bin", {
      type: "application/octet-stream",
    });

    const formData = new FormData();
    formData.append("file", encryptedFile);

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

    if (onProgress) {
      onProgress(100); // 업로드 완료
    }

    const data = await response.json();
    return data?.Hash ?? null;
  } catch (error) {
    console.error("파일 암호화 및 업로드 실패:", error);
    return null;
  }
};

// 공개키를 PEM 형식으로 변환하는 함수
const convertToPEM = (publicKey: string): string => {
  const pemHeader = "-----BEGIN PUBLIC KEY-----\n";
  const pemFooter = "\n-----END PUBLIC KEY-----";
  const keyBuffer = Buffer.from(publicKey.replace("0x", ""), "hex");
  const base64Key = keyBuffer.toString("base64");
  return `${pemHeader}${base64Key}${pemFooter}`;
};

// 안전한 랜덤 키 생성 함수
const generateRandomKey = async (): Promise<string> => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// ZIP 파일 검증 함수
const validateZipFile = async (file: File): Promise<boolean> => {
  // ZIP 파일 시그니처 검사
  const fileHeader = await file.slice(0, 4).arrayBuffer();
  const header = new Uint8Array(fileHeader);

  // ZIP 파일 시그니처: 50 4B 03 04
  const isValidZip =
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    header[2] === 0x03 &&
    header[3] === 0x04;

  return isValidZip;
};

// 파일을 청크로 나누기 전에 압축 해제 테스트
const testZipExtraction = async (file: File): Promise<boolean> => {
  try {
    // ZIP 파일 검증
    const isValid = await validateZipFile(file);
    if (!isValid) {
      message.error("올바른 ZIP 파일 형식이 아닙니다.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("ZIP 파일 검증 실패:", error);
    message.error("ZIP 파일 검증에 실패했습니다.");
    return false;
  }
};

const DoctorList = () => {
  const { userInfo } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendActor, setBackendActor] = useState<any>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [form] = Form.useForm();
  const [searchType, setSearchType] = useState("name");

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

        const offset = (pagination.current - 1) * pagination.pageSize;
        const result = (await actor.getPagedDoctors(
          offset,
          pagination.pageSize
        )) as { items: BackendDoctor[]; total: bigint };

        const formattedDoctors = result.items.map((doctor: BackendDoctor) => ({
          id: Number(doctor.id.toString()),
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          hospital: doctor.hospital,
          department: doctor.department,
          role: doctor.role,
          publicKey: doctor.publicKey[0],
        }));

        setDoctors(formattedDoctors);
        setPagination((prev) => ({
          ...prev,
          total: Number(result.total.toString()),
        }));
      } catch (error) {
        console.error("의사 목록 조회 실패:", error);
        message.error("의사 목록을 가져오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [pagination.current, pagination.pageSize]);

  const handleUploadClick = () => {
    setIsModalOpen(true);
  };

  const handleDoctorUpload = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsModalOpen(true);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleModalSubmit = async (values: any) => {
    try {
      if (!backendActor) {
        message.error("백엔드가 초기화되지 않았습니다.");
        return;
      }

      if (!userInfo?.publicKey || !selectedDoctor?.publicKey) {
        message.error("송신자 또는 수신자의 공개키가 없습니다.");
        return;
      }

      // 1. AES key 생성 (32바이트 = 256비트)
      const aesKey = await generateRandomKey();
      console.log("생성된 AES 키:", aesKey);

      // 2. 파일 처리
      const uploadedFile = values.files?.fileList[0]?.originFileObj;
      if (!uploadedFile) {
        message.error("파일을 선택해주세요.");
        return;
      }

      // ZIP 파일 검증
      const isValidZip = await testZipExtraction(uploadedFile);
      if (!isValidZip) {
        return;
      }

      // 파일 암호화 및 업로드 진행률 표시를 위한 메시지
      const key = "uploadProgress";
      message.loading({ content: "파일 처리 중...", key });

      // 파일 암호화 및 업로드
      const cid = await encryptAndUploadFile(
        uploadedFile,
        aesKey,
        (progress) => {
          message.loading({
            content: `파일 처리 중... ${Math.round(progress)}%`,
            key,
          });
        }
      );

      if (!cid) {
        message.error({ content: "파일 업로드 실패", key });
        return;
      }

      message.success({ content: "파일 업로드 완료", key });

      // 3. 송신자의 공개키로 AES 키 암호화
      if (!userInfo.publicKey) {
        message.error("송신자의 공개키가 없습니다.");
        return;
      }
      console.log("송신자 공개키:", userInfo.publicKey);
      const encryptedAesKeyForSender = await encryptAesKey(
        aesKey,
        userInfo.publicKey
      );

      // 4. 수신자의 공개키로 AES 키 암호화
      if (!selectedDoctor.publicKey) {
        message.error("수신자의 공개키가 없습니다.");
        return;
      }
      console.log("수신자 공개키:", selectedDoctor.publicKey);
      const encryptedAesKeyForReceiver = await encryptAesKey(
        aesKey,
        selectedDoctor.publicKey
      );

      // 5. ApprovalManager에 데이터 저장
      const approvalData = {
        id: BigInt(0),
        date: BigInt(Date.now() * 1000000),
        phone: form.getFieldValue("phone"),
        patientName: form.getFieldValue("patientName"),
        title: form.getFieldValue("title"),
        description: form.getFieldValue("description") || "",
        fromDoctor: userInfo?.name || "",
        fromEmail: userInfo?.email || "",
        fromHospital: userInfo?.hospital || "",
        fromDepartment: userInfo?.department || "",
        fromPhone: userInfo?.phone || "",
        toDoctor: selectedDoctor?.name || "",
        toEmail: selectedDoctor?.email || "",
        toHospital: selectedDoctor?.hospital || "",
        toDepartment: selectedDoctor?.department || "",
        toPhone: selectedDoctor?.phone || "",
        cid: cid,
        encryptedAesKeyForSender: encryptedAesKeyForSender,
        encryptedAesKeyForReceiver: encryptedAesKeyForReceiver,
        status: "pending",
        originalApprovalId: [],
        transferredDoctors: [userInfo?.name || ""],
      };

      console.log("저장할 데이터:", {
        ...approvalData,
        encryptedAesKeyForSender:
          encryptedAesKeyForSender.substring(0, 50) + "...",
        encryptedAesKeyForReceiver:
          encryptedAesKeyForReceiver.substring(0, 50) + "...",
      });

      try {
        const result = await backendActor.createApproval(approvalData);
        if (result) {
          message.success("승인 요청이 성공적으로 생성되었습니다.");
          setIsModalOpen(false);
          form.resetFields();
        } else {
          message.error("승인 요청 생성에 실패했습니다.");
        }
      } catch (error) {
        console.error("승인 요청 생성 실패:", error);
        message.error(`승인 요청 생성 실패: ${error}`);
      }
    } catch (error) {
      console.error("업로드 실패:", error);
      message.error("진료 기록 전송에 실패했습니다.");
    }
  };

  const encryptAesKey = async (aesKey: string, publicKey: string) => {
    try {
      if (!publicKey) {
        throw new Error("Public key is required");
      }

      // 공개키에서 0x prefix 제거
      const cleanPublicKey = publicKey.replace("0x", "");

      const aesKeyBuffer = Buffer.from(aesKey, "hex");
      const publicKeyBuffer = Buffer.from(cleanPublicKey, "hex");

      const encryptedData = (await eccrypto.encrypt(
        publicKeyBuffer,
        aesKeyBuffer
      )) as {
        iv: Buffer;
        ephemPublicKey: Buffer;
        ciphertext: Buffer;
        mac: Buffer;
      };

      return JSON.stringify({
        iv: encryptedData.iv.toString("hex"),
        ephemPublicKey: encryptedData.ephemPublicKey.toString("hex"),
        ciphertext: encryptedData.ciphertext.toString("hex"),
        mac: encryptedData.mac.toString("hex"),
      });
    } catch (error) {
      console.error("Encryption failed:", error);
      throw error;
    }
  };

  const columns: ColumnsType<Doctor> = [
    { title: "No", dataIndex: "id", key: "id" },
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
        if (!record.publicKey || record.publicKey === "undefined") {
          return <span style={{ color: "#ff4d4f" }}>최초 로그인 대기</span>;
        }
        return (
          <Button type="primary" onClick={() => handleDoctorUpload(record)}>
            환자 진료 기록 전송
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <div className="table-toolbar">
        <Select
          defaultValue="name"
          onChange={(value) => {
            setSearchType(value);
            setPagination((prev) => ({ ...prev, current: 1 }));
          }}
          options={[
            { value: "name", label: "의사명" },
            { value: "email", label: "이메일" },
            { value: "phone", label: "휴대폰" },
            { value: "hospital", label: "병원" },
          ]}
        />
        <Search
          placeholder="검색어를 입력하세요"
          onSearch={(value: string) => console.log(value)}
          allowClear
        />
      </div>
      <Table
        columns={columns.map((column) => ({
          ...column,
          align: column.key === "action" ? "center" : "left",
          ellipsis: true,
        }))}
        dataSource={doctors}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total, range) =>
            `전체 ${total}개 중 ${range[0]}-${range[1]}`,
          onChange: (page, pageSize) => {
            setPagination((prev) => ({
              ...prev,
              current: page,
              pageSize: pageSize,
            }));
          },
        }}
        scroll={{ x: "max-content" }}
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
              borderTop: "1px solid var(--border-color)",
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
              width: "calc(100% + 48px)",
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
              beforeUpload={async (file) => {
                const isZip =
                  file.type === "application/zip" ||
                  file.type === "application/x-zip-compressed" ||
                  file.name.endsWith(".zip");
                if (!isZip) {
                  message.error("ZIP 파일만 업로드 가능합니다.");
                  return false;
                }

                // ZIP 파일 검증
                const isValidZip = await validateZipFile(file);
                if (!isValidZip) {
                  message.error("올바른 ZIP 파일 형식이 아닙니다.");
                  return false;
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
    </div>
  );
};

export default DoctorList;
