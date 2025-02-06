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
import { UploadOutlined, CopyOutlined, SendOutlined } from "@ant-design/icons";
import CryptoJS from "crypto-js";
import { useAuth } from "@/contexts/AuthContext";
import * as eccrypto from "@toruslabs/eccrypto";
import { saveReferralMetadata } from "../../firebase/referral";
import { useNavigate } from "react-router-dom";
import { createActor } from "../../utils/actor";

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
  publicKey: string | null;
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
    throw error;
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
    throw error;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancellable, setIsCancellable] = useState(true);

  useEffect(() => {
    const initActor = async () => {
      try {
        const actor = await createActor();
        setBackendActor(actor);
        return actor;
      } catch (error) {
        throw error;
      }
    };

    initActor();
  }, []);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!backendActor) return;

      setLoading(true);
      try {
        const offset = (pagination.current - 1) * pagination.pageSize;
        let result: { items: BackendDoctor[]; total: bigint };

        if (searchQuery && searchQuery.length >= 2) {
          result = (await backendActor.searchDoctors(
            searchType,
            searchQuery,
            offset,
            pagination.pageSize
          )) as { items: BackendDoctor[]; total: bigint };
        } else {
          result = (await backendActor.getPagedDoctors(
            offset,
            pagination.pageSize
          )) as { items: BackendDoctor[]; total: bigint };
        }

        const formattedDoctors = result.items.map((doctor: BackendDoctor) => ({
          id: Number(doctor.id.toString()),
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          hospital: doctor.hospital,
          department: doctor.department,
          role: doctor.role,
          publicKey:
            Array.isArray(doctor.publicKey) && doctor.publicKey.length > 0
              ? doctor.publicKey[0]
              : null,
        }));

        setDoctors(formattedDoctors);
        setPagination((prev) => ({
          ...prev,
          total: Number(result.total.toString()),
        }));
      } catch (error) {
        message.error("의사 목록을 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    // 검색어가 없고 첫 페이지인 경우 API 호출 방지
    if (!searchQuery && pagination.current === 1) {
      fetchDoctors();
    } else {
      const debounceTimer = setTimeout(() => {
        fetchDoctors();
      }, 300); // 300ms 디바운스 적용

      return () => clearTimeout(debounceTimer);
    }
  }, [pagination.current, pagination.pageSize, searchQuery, backendActor]);

  // 검색어 입력 시 자동 검색 (디바운스 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tempSearchQuery !== searchQuery) {
        handleSearch(tempSearchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tempSearchQuery]);

  const handleUploadClick = () => {
    setIsModalOpen(true);
  };

  const handleDoctorUpload = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsModalOpen(true);
  };

  const handleModalCancel = () => {
    if (!isCancellable) return;
    setIsModalOpen(false);
    form.resetFields();
    setIsCancellable(true);
    setIsSubmitting(false);
  };

  const handleModalSubmit = async (values: any) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setIsCancellable(true); // 초기에는 취소 가능

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

      // 파일 암호화 및 업로드가 시작되면 취소 불가능
      setIsCancellable(false);

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

      // 공개키 유효성 검사 추가
      if (!selectedDoctor.publicKey) {
        message.error("수신자의 공개키가 없습니다.");
        return;
      }

      // 3. 송신자의 공개키로 AES 키 암호화
      if (!userInfo.publicKey) {
        message.error("송신자의 공개키가 없습니다.");
        return;
      }

      // 공개키 로그 추가
      console.log("송신자 공개키:", userInfo.publicKey);
      console.log("수신자 공개키:", selectedDoctor.publicKey);

      const encryptedAesKeyForSender = await encryptAesKey(
        aesKey,
        userInfo.publicKey
      );

      const encryptedAesKeyForReceiver = await encryptAesKey(
        aesKey,
        selectedDoctor.publicKey
      );

      // 5. ApprovalManager에 데이터 저장
      console.log("createMedicalRecord 호출 전 파라미터:", {
        patientName: values.patientName,
        phone: values.phone,
        title: values.title,
        description: values.description,
        senderEmail: userInfo?.email || "",
        receiverEmail: selectedDoctor?.email || "",
        cid,
        encryptedAesKeyForSender,
        encryptedAesKeyForReceiver,
      });

      const result = await backendActor.createMedicalRecord(
        values.patientName,
        values.phone,
        values.title,
        values.description || "",
        userInfo?.email || "",
        selectedDoctor?.email || "",
        cid,
        encryptedAesKeyForSender,
        encryptedAesKeyForReceiver
      );

      console.log("createMedicalRecord 결과:", result);

      if ("ok" in result) {
        // Firebase에 메타데이터 저장
        try {
          const referralId = result.ok.id
            ? result.ok.id.toString()
            : result.ok.toString();

          await saveReferralMetadata({
            referralId,
            fromEmail: userInfo?.email || "", // 송신자 이메일
            toEmail: selectedDoctor.email, // 수신자 이메일
            doctorName: selectedDoctor.name,
            hospitalName: selectedDoctor.hospital,
            department: selectedDoctor.department,
            patientName: values.patientName,
            patientPhone: values.phone,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // SMS 전송 로직 추가
          const smsMessage = `${userInfo?.name}님이 전송한 [${values.patientName}]의료정보 도착\nhttps://mutual-link-d70e6.web.app/?referralId=${referralId}`;

          // 전화번호에서 하이픈 제거
          const phoneNumber = values.phone.replace(/-/g, "");
          console.log("SMS 전송 시도:", { phoneNumber, message: smsMessage });

          const response = await fetch(
            "https://8oxqti6xl1.execute-api.ap-northeast-2.amazonaws.com/default/sms",
            {
              method: "POST",
              mode: "no-cors",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: smsMessage,
                phoneNumber: phoneNumber,
              }),
            }
          );
          console.log("SMS 전송 응답:", response);

          message.success("진료 기록이 성공적으로 생성되었습니다.");
          setIsModalOpen(false);
          form.resetFields();
        } catch (error) {
          throw error;
        }
      } else if ("err" in result) {
        message.error(result.err);
      }
    } catch (error) {
      message.error("진료 기록 전송에 실패했습니다.");
      setLoading(false);
    } finally {
      setIsSubmitting(false);
      setIsCancellable(true);
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
      throw error;
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(
        7
      )}`;
    }
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(
        6
      )}`;
    }
    return phone;
  };

  const columns: ColumnsType<Doctor> = [
    { title: "No", dataIndex: "id", key: "id" },
    { title: "담당의사", dataIndex: "name", key: "name" },
    { title: "이메일", dataIndex: "email", key: "email" },
    {
      title: "휴대폰",
      dataIndex: "phone",
      key: "phone",
      render: (phone: string) => formatPhoneNumber(phone),
    },
    { title: "병원", dataIndex: "hospital", key: "hospital" },
    { title: "부서", dataIndex: "department", key: "department" },
    {
      title: "작업",
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
          <Button
            type="primary"
            ghost
            size="small"
            icon={<SendOutlined />}
            onClick={() => handleDoctorUpload(record)}
          >
            진료의뢰
          </Button>
        );
      },
    },
  ];

  const handleSearch = (value: string) => {
    const trimmedValue = value.trim().replace(/\s+/g, " ");

    setSearchQuery(trimmedValue);
    setPagination((prev) => ({ ...prev, current: 1 }));

    if (trimmedValue === "") {
      return;
    }

    if (trimmedValue.length < 2) {
      message.warning("검색어는 최소 2자 이상 입력해주세요.");
      return;
    }

    // 검색 조건별 유효성 검사
    if (searchType === "phone") {
      const cleaned = trimmedValue.replace(/[^\d-]/g, "");
      if (cleaned !== trimmedValue) {
        message.warning("전화번호는 숫자와 하이픈만 입력 가능합니다.");
        return;
      }
      const numbersOnly = cleaned.replace(/-/g, "");
      if (numbersOnly.length > 11) {
        message.warning("전화번호는 최대 11자리까지 입력 가능합니다.");
        return;
      }
      setSearchQuery(numbersOnly);
    } else if (searchType === "email") {
      // 이메일 검색은 부분 검색 허용
      setSearchQuery(trimmedValue.toLowerCase());
    } else {
      setSearchQuery(trimmedValue);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (searchType === "phone") {
      // 전화번호 입력 시 숫자와 하이픈만 허용
      const cleaned = value.replace(/[^\d-]/g, "");
      if (cleaned !== value) {
        return;
      }
      // 숫자만 추출하여 길이 체크
      const numbersOnly = cleaned.replace(/-/g, "");
      if (numbersOnly.length > 11) {
        return;
      }
      // 자동 하이픈 추가
      let formatted = cleaned;
      if (numbersOnly.length > 3) {
        formatted = numbersOnly.slice(0, 3) + "-" + numbersOnly.slice(3);
      }
      if (numbersOnly.length > 7) {
        formatted = formatted.slice(0, 8) + "-" + formatted.slice(8);
      }
      setTempSearchQuery(formatted);
    } else if (searchType === "email") {
      // 이메일 입력 시 공백만 제거
      setTempSearchQuery(value.replace(/\s/g, "").toLowerCase());
    } else {
      setTempSearchQuery(value);
    }
  };

  const handleSearchTypeChange = (value: string) => {
    setSearchType(value as "name" | "hospital" | "department");
    setTempSearchQuery("");
    setSearchQuery("");
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  return (
    <div style={{ padding: "24px" }}>
      <div className="table-toolbar">
        <Select
          defaultValue="name"
          onChange={handleSearchTypeChange}
          style={{ width: 120 }}
          options={[
            { value: "name", label: "의사명" },
            { value: "email", label: "이메일" },
            { value: "phone", label: "휴대폰" },
            { value: "hospital", label: "병원" },
          ]}
        />
        <Search
          placeholder={`${
            searchType === "name"
              ? "의사명"
              : searchType === "email"
              ? "이메일"
              : searchType === "phone"
              ? "휴대폰 번호 (하이픈 포함/미포함 가능)"
              : "병원명"
          }을(를) 입력하세요 (최소 2자 이상)`}
          value={tempSearchQuery}
          onChange={handleSearchInputChange}
          onSearch={handleSearch}
          style={{ width: 400, marginLeft: 8 }}
          allowClear
          onPressEnter={() => handleSearch(tempSearchQuery)}
        />
      </div>
      {doctors.length === 0 && searchQuery ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 0",
            color: "var(--text-secondary)",
            background: "white",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ fontSize: "16px", marginBottom: "8px" }}>
            검색 결과가 없습니다
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-tertiary)" }}>
            다른 검색어로 다시 시도해보세요
          </div>
        </div>
      ) : (
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
      )}
      <Modal
        title="진료의뢰"
        open={isModalOpen}
        onCancel={handleModalCancel}
        footer={
          <div
            style={{
              textAlign: "center",
              margin: "0 -24px -24px",
              padding: "16px 24px",
              borderTop: "1px solid var(--border-color)",
              background: "white",
            }}
          >
            <Button
              key="cancel"
              onClick={handleModalCancel}
              style={{ marginRight: 8 }}
              disabled={!isCancellable}
            >
              취소
            </Button>
            <Button
              key="submit"
              type="primary"
              onClick={form.submit}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </Button>
          </div>
        }
        width={520}
        style={{ top: 20 }}
        bodyStyle={{
          padding: "24px",
          maxHeight: "calc(100vh - 200px)",
          overflow: "auto",
          background: "white",
          borderRadius: "8px",
        }}
        maskClosable={isCancellable}
        closable={isCancellable}
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
          validateTrigger={["onChange", "onBlur"]}
        >
          <Form.Item
            label="제목"
            name="title"
            rules={[
              { required: true, message: "제목을 입력해주세요" },
              { min: 2, message: "제목은 최소 2자 이상이어야 합니다" },
              { max: 100, message: "제목은 최대 100자까지 입력 가능합니다" },
              {
                whitespace: true,
                message: "제목은 공백만으로 구성될 수 없습니다",
              },
            ]}
            style={{ marginBottom: 0 }}
          >
            <Input maxLength={100} showCount />
          </Form.Item>

          <Form.Item
            label="환자명"
            name="patientName"
            rules={[
              { required: true, message: "환자명을 입력해주세요" },
              { min: 2, message: "환자명은 최소 2자 이상이어야 합니다" },
              { max: 50, message: "환자명은 최대 50자까지 입력 가능합니다" },
              {
                whitespace: true,
                message: "환자명은 공백만으로 구성될 수 없습니다",
              },
              {
                pattern: /^[가-힣a-zA-Z\s]+$/,
                message: "환자명은 한글과 영문만 입력 가능합니다",
              },
            ]}
            style={{ marginBottom: 0 }}
          >
            <Input maxLength={50} />
          </Form.Item>

          <Form.Item
            label="휴대폰"
            name="phone"
            rules={[
              { required: true, message: "휴대폰 번호를 입력해주세요" },
              {
                pattern: /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/,
                message: "올바른 휴대폰 번호 형식이 아닙니다",
              },
            ]}
            style={{ marginBottom: 0 }}
          >
            <Input
              maxLength={13}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                if (value.length <= 11) {
                  let formattedValue = value;
                  if (value.length > 3) {
                    formattedValue = value.slice(0, 3) + "-" + value.slice(3);
                  }
                  if (value.length > 7) {
                    formattedValue =
                      formattedValue.slice(0, 8) +
                      "-" +
                      formattedValue.slice(8);
                  }
                  form.setFieldsValue({ phone: formattedValue });
                }
              }}
              placeholder="010-0000-0000"
            />
          </Form.Item>

          <Form.Item
            label="소견"
            name="description"
            rules={[
              { min: 10, message: "소견 입력 시 최소 10자 이상 입력해주세요" },
              { max: 2000, message: "소견은 최대 2000자까지 입력 가능합니다" },
              {
                whitespace: true,
                message: "소견은 공백만으로 구성될 수 없습니다",
              },
            ]}
            style={{
              marginBottom: 0,
              marginLeft: -12,
              marginRight: -12,
              width: "calc(100% + 24px)",
            }}
          >
            <Input.TextArea
              rows={6}
              maxLength={2000}
              showCount
              placeholder="소견을 입력해주세요 (선택사항)"
              style={{
                width: "100%",
                resize: "none",
                borderRadius: "6px",
              }}
            />
          </Form.Item>

          <Form.Item
            label="업로드 할 파일"
            name="files"
            rules={[
              { required: true, message: "파일을 선택해주세요" },
              {
                validator: async (_, fileList) => {
                  if (
                    !fileList ||
                    !fileList.fileList ||
                    fileList.fileList.length === 0
                  ) {
                    return Promise.reject(new Error("파일을 선택해주세요"));
                  }
                  const file = fileList.fileList[0].originFileObj;
                  if (!file)
                    return Promise.reject(new Error("파일을 찾을 수 없습니다"));

                  if (file.size > 100 * 1024 * 1024) {
                    return Promise.reject(
                      new Error("파일 크기는 100MB를 초과할 수 없습니다")
                    );
                  }

                  const isZip =
                    file.type === "application/zip" ||
                    file.type === "application/x-zip-compressed" ||
                    file.name.endsWith(".zip");
                  if (!isZip) {
                    return Promise.reject(
                      new Error("ZIP 파일만 업로드 가능합니다")
                    );
                  }

                  return Promise.resolve();
                },
              },
            ]}
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

                const isValidZip = await validateZipFile(file);
                if (!isValidZip) {
                  message.error("올바른 ZIP 파일 형식이 아닙니다.");
                  return false;
                }

                return false;
              }}
              accept=".zip"
              style={{
                padding: "16px 0",
                background: "white",
                border: "1px dashed var(--border-color)",
                borderRadius: "8px",
              }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined
                  style={{ fontSize: "32px", color: "var(--primary-color)" }}
                />
              </p>
              <p
                className="ant-upload-text"
                style={{ fontSize: "16px", margin: "8px 0" }}
              >
                Click to Upload
              </p>
              <p
                className="ant-upload-hint"
                style={{ color: "var(--text-secondary)" }}
              >
                압축(zip) 파일만 업로드 가능합니다.
                <br />
                압축파일 안에는 [dicom, jpg, png, gif, bmp, webp, pdf] 파일만
                포함 가능합니다.
                <br />
                최대 파일 크기: 100MB
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DoctorList;
