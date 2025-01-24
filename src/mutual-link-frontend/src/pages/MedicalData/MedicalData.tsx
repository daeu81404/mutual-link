import {
  Table,
  Select,
  Input,
  Button,
  Space,
  message,
  Modal,
  Timeline,
  Card,
  Tag,
} from "antd";
import {
  DownloadOutlined,
  CopyOutlined,
  EyeOutlined,
  SwapOutlined,
  HistoryOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useState, useEffect } from "react";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import { useAuth } from "@/contexts/AuthContext";
import CryptoJS from "crypto-js";
import * as eccrypto from "@toruslabs/eccrypto";
import FileViewerModal from "@/components/FileViewerModal";
import JSZip from "jszip";
import { MedicalDataCache } from "@/utils/indexedDB";
import DoctorInfoModal from "@/components/DoctorInfoModal";

const { Search } = Input;

interface MedicalDataProps {
  type: "send" | "receive";
}

interface BackendMedicalRecord {
  id: bigint;
  date: bigint;
  phone: string;
  patientName: string;
  title: string;
  description: string;
  fromDoctor: string;
  fromEmail: string;
  fromHospital: string;
  fromDepartment: string;
  fromPhone: string;
  toDoctor: string;
  toEmail: string;
  toHospital: string;
  toDepartment: string;
  toPhone: string;
  cid: string;
  encryptedAesKeyForSender: string;
  encryptedAesKeyForReceiver: string;
  status: string;
  originalRecordId: bigint | null;
  transferredDoctors: string[];
}

interface MedicalRecord {
  id: number;
  date: number;
  phone: string;
  patientName: string;
  title: string;
  description: string;
  fromDoctor: string;
  fromEmail: string;
  fromHospital: string;
  fromDepartment: string;
  fromPhone: string;
  toDoctor: string;
  toEmail: string;
  toHospital: string;
  toDepartment: string;
  toPhone: string;
  cid: string;
  status: string;
  encryptedAesKeyForSender: string;
  encryptedAesKeyForReceiver: string;
  originalRecordId: number | null;
  transferredDoctors: string[];
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

// IPFS로부터 파일 다운로드
const downloadFromIPFS = async (cid: string): Promise<Blob> => {
  try {
    const response = await fetch(`https://ipfs.io/ipfs/${cid}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("IPFS 다운로드 실패:", error);
    throw error;
  }
};

// AES 키 복호화
const decryptAesKey = async (encryptedAesKey: string, privateKey: string) => {
  try {
    if (!encryptedAesKey) {
      throw new Error("암호화된 AES 키가 없습니다.");
    }

    const encryptedData = JSON.parse(encryptedAesKey);
    const encryptedBuffer = {
      iv: Buffer.from(encryptedData.iv, "hex"),
      ephemPublicKey: Buffer.from(encryptedData.ephemPublicKey, "hex"),
      ciphertext: Buffer.from(encryptedData.ciphertext, "hex"),
      mac: Buffer.from(encryptedData.mac, "hex"),
    };

    const privateKeyBuffer = Buffer.from(privateKey.replace("0x", ""), "hex");
    const decryptedBuffer = await eccrypto.decrypt(
      privateKeyBuffer,
      encryptedBuffer
    );
    return decryptedBuffer.toString("hex");
  } catch (error) {
    console.error("AES 키 복호화 실패:", error);
    throw error;
  }
};

const MedicalData: React.FC<MedicalDataProps> = ({ type }) => {
  const { userInfo } = useAuth();
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendActor, setBackendActor] = useState<any>(null);
  const [searchType, setSearchType] = useState<
    "sender" | "receiver" | "patient"
  >(type === "send" ? "receiver" : "sender");
  const [viewerModalVisible, setViewerModalVisible] = useState(false);
  const [viewerFiles, setViewerFiles] = useState<{
    dicom: ArrayBuffer[];
    images: ArrayBuffer[];
    pdf: ArrayBuffer[];
  }>({
    dicom: [],
    images: [],
    pdf: [],
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [medicalDataCache] = useState(() => new MedicalDataCache());
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(
    null
  );
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorPagination, setDoctorPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [doctorSearchType, setDoctorSearchType] = useState<
    "name" | "hospital" | "department"
  >("name");
  const [doctorSearchKeyword, setDoctorSearchKeyword] = useState("");
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHistories, setSelectedHistories] = useState<MedicalRecord[]>(
    []
  );
  const [relatedRecords, setRelatedRecords] = useState<MedicalRecord[]>([]);
  const [selectedDoctorInfo, setSelectedDoctorInfo] = useState<{
    name: string;
    email: string;
    phone: string;
    hospital: string;
    department: string;
  } | null>(null);
  const [doctorInfoModalVisible, setDoctorInfoModalVisible] = useState(false);

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

    const fetchMedicalRecords = async () => {
      setLoading(true);
      try {
        const actor = await initActor();
        if (!actor || !userInfo?.name) return;

        const offset = (pagination.current - 1) * pagination.pageSize;
        const result = (await actor.getMedicalRecordsByDoctor(
          userInfo.name,
          type === "send" ? "sender" : "receiver",
          offset,
          pagination.pageSize
        )) as { items: BackendMedicalRecord[]; total: bigint };

        const formattedRecords = result.items.map(
          (record: BackendMedicalRecord) => ({
            id: Number(record.id.toString()),
            date: Number(record.date.toString()) / 1000000,
            phone: record.phone,
            patientName: record.patientName,
            title: record.title,
            description: record.description,
            fromDoctor: record.fromDoctor,
            fromEmail: record.fromEmail,
            fromHospital: record.fromHospital,
            fromDepartment: record.fromDepartment,
            fromPhone: record.fromPhone,
            toDoctor: record.toDoctor,
            toEmail: record.toEmail,
            toHospital: record.toHospital,
            toDepartment: record.toDepartment,
            toPhone: record.toPhone,
            cid: record.cid,
            status: record.status,
            encryptedAesKeyForSender: record.encryptedAesKeyForSender,
            encryptedAesKeyForReceiver: record.encryptedAesKeyForReceiver,
            originalRecordId: record.originalRecordId
              ? Number(record.originalRecordId.toString())
              : null,
            transferredDoctors: record.transferredDoctors,
          })
        );

        setMedicalRecords(formattedRecords);
        setPagination((prev) => ({
          ...prev,
          total: Number(result.total.toString()),
        }));
      } catch (error) {
        console.error("진료 기록 조회 실패:", error);
        message.error("진료 기록을 가져오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalRecords();
  }, [userInfo?.name, type, pagination.current, pagination.pageSize]);

  useEffect(() => {
    medicalDataCache.init();
  }, []);

  const handleFileView = async (record: MedicalRecord) => {
    // 전체 화면 로딩 표시
    const loadingModal = Modal.info({
      title: "파일 처리 중...",
      content: "진료 데이터를 불러오는 중입니다.",
      icon: <></>,
      okButtonProps: { style: { display: "none" } },
      centered: true,
      maskClosable: false,
    });

    try {
      if (!userInfo?.privateKey) {
        message.error("개인키가 없습니다.");
        return;
      }

      // 송신자 또는 수신자의 암호화된 AES 키 선택
      const isSender = userInfo.name === record.fromDoctor;
      const encryptedAesKey = isSender
        ? record.encryptedAesKeyForSender
        : record.encryptedAesKeyForReceiver;

      if (!encryptedAesKey) {
        throw new Error("암호화된 AES 키가 없습니다.");
      }

      // 1. 캐시된 파일이 있는지 확인
      const cachedData = await medicalDataCache.getCachedFile(record.cid);
      let encryptedData: ArrayBuffer;

      if (cachedData) {
        console.log("캐시된 파일을 사용합니다.");
        message.success("캐시된 파일을 불러옵니다.");
        encryptedData = cachedData.encryptedData;
      } else {
        message.info("파일을 새로 다운로드합니다.");
        // 2. IPFS에서 암호화된 파일 다운로드
        const encryptedBlob = await downloadFromIPFS(record.cid);
        encryptedData = await encryptedBlob.arrayBuffer();

        // 캐시에 암호화된 상태로 저장
        await medicalDataCache.cacheFile(
          record.cid,
          encryptedData,
          encryptedAesKey
        );
      }

      // 3. AES 키 복호화
      const aesKey = await decryptAesKey(encryptedAesKey, userInfo.privateKey);

      // 4. 파일 복호화
      const decryptedChunks: Uint8Array[] = [];
      const encryptedDataArray = new Uint8Array(encryptedData);
      let offset = 0;

      while (offset < encryptedDataArray.length) {
        // 청크 크기 읽기 (4바이트)
        const chunkSize =
          (encryptedDataArray[offset] << 24) |
          (encryptedDataArray[offset + 1] << 16) |
          (encryptedDataArray[offset + 2] << 8) |
          encryptedDataArray[offset + 3];
        offset += 4;

        // 청크 데이터 읽기
        const encryptedChunk = encryptedDataArray.slice(
          offset,
          offset + chunkSize
        );
        offset += chunkSize;

        // 바이너리 데이터를 Base64로 변환
        let binary = "";
        for (let i = 0; i < encryptedChunk.length; i++) {
          binary += String.fromCharCode(encryptedChunk[i]);
        }
        const encryptedBase64 = btoa(binary);

        // 복호화
        const decryptedWordArray = CryptoJS.AES.decrypt(
          encryptedBase64,
          aesKey
        );

        // WordArray를 Uint8Array로 변환
        const words = decryptedWordArray.words;
        const sigBytes = decryptedWordArray.sigBytes;
        const u8 = new Uint8Array(sigBytes);
        let b = 0;
        for (let i = 0; i < sigBytes; i++) {
          const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          u8[b++] = byte;
        }

        decryptedChunks.push(u8);
      }

      // 모든 청크를 하나의 Uint8Array로 합치기
      const totalLength = decryptedChunks.reduce(
        (acc, chunk) => acc + chunk.length,
        0
      );
      const decryptedArrayBuffer = new Uint8Array(totalLength);
      let writeOffset = 0;
      for (const chunk of decryptedChunks) {
        decryptedArrayBuffer.set(chunk, writeOffset);
        writeOffset += chunk.length;
      }

      // 5. ZIP 파일 처리
      const zip = await JSZip.loadAsync(decryptedArrayBuffer);
      const files = {
        dicom: [] as ArrayBuffer[],
        images: [] as ArrayBuffer[],
        pdf: [] as ArrayBuffer[],
      };

      // 각 파일 처리
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (
          zipEntry.dir ||
          filename.startsWith("__MACOSX/") ||
          filename.includes("/._")
        ) {
          continue;
        }

        const fileData = await zipEntry.async("arraybuffer");
        const extension = filename.split(".").pop()?.toLowerCase();

        if (extension === "dcm") {
          files.dicom.push(fileData);
        } else if (["jpg", "jpeg", "png", "gif"].includes(extension || "")) {
          files.images.push(fileData);
        } else if (extension === "pdf") {
          files.pdf.push(fileData);
        }
      }

      setViewerFiles(files);
      setViewerModalVisible(true);
    } catch (error) {
      console.error("파일 처리 실패:", error);
      message.error("파일을 처리하는데 실패했습니다.");
    } finally {
      loadingModal.destroy();
    }
  };

  // 의사 목록 조회
  const fetchDoctors = async (page: number = 1, pageSize: number = 10) => {
    try {
      if (!backendActor) return;
      const offset = (page - 1) * pageSize;
      const result = await backendActor.getPagedDoctors(offset, pageSize);
      let formattedDoctors = result.items
        .map((doctor: any) => {
          // publicKey가 배열이면 첫 번째 요소를 사용, 아니면 그대로 사용
          const publicKey = Array.isArray(doctor.publicKey)
            ? doctor.publicKey[0]
            : doctor.publicKey;

          return {
            id: Number(doctor.id),
            name: doctor.name,
            email: doctor.email,
            phone: doctor.phone,
            hospital: doctor.hospital,
            department: doctor.department,
            role: doctor.role,
            publicKey: publicKey || null,
          };
        })
        // 현재 사용자 제외
        .filter((doctor: Doctor) => doctor.email !== userInfo?.email);

      console.log("Formatted doctors:", formattedDoctors); // 디버깅용 로그

      // 검색어가 있는 경우 필터링
      if (doctorSearchKeyword) {
        const keyword = doctorSearchKeyword.toLowerCase();
        formattedDoctors = formattedDoctors.filter((doctor: Doctor) => {
          switch (doctorSearchType) {
            case "name":
              return doctor.name.toLowerCase().includes(keyword);
            case "hospital":
              return doctor.hospital.toLowerCase().includes(keyword);
            case "department":
              return doctor.department.toLowerCase().includes(keyword);
            default:
              return true;
          }
        });
      }

      setDoctors(formattedDoctors);
      setDoctorPagination((prev) => ({
        ...prev,
        current: page,
        total: formattedDoctors.length,
      }));
    } catch (error) {
      console.error("의사 목록 조회 실패:", error);
      message.error("의사 목록을 불러오는데 실패했습니다.");
    }
  };

  // 이관 모달 열기
  const handleTransferClick = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setTransferModalVisible(true);
    fetchDoctors(1, doctorPagination.pageSize);
  };

  // 이관 히스토리 조회
  const handleHistoryClick = async (recordId: number) => {
    try {
      const relatedRecords = await backendActor.getTransferHistory(recordId);

      const formattedRecords = relatedRecords.map((record: any) => ({
        id: Number(record.id.toString()),
        fromDoctor: record.fromDoctor,
        fromEmail: record.fromEmail,
        fromHospital: record.fromHospital || "",
        fromDepartment: record.fromDepartment || "",
        fromPhone: record.fromPhone || "",
        toDoctor: record.toDoctor,
        toEmail: record.toEmail,
        toHospital: record.toHospital || "",
        toDepartment: record.toDepartment || "",
        toPhone: record.toPhone || "",
        date:
          typeof record.date === "bigint"
            ? Number(record.date.toString()) / 1000000
            : Number(record.date) / 1000000,
        title: record.title || "",
        description: record.description || "",
        patientName: record.patientName || "",
        status: record.status || "",
      }));

      setSelectedHistories(formattedRecords);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error("이관 히스토리 조회 실패:", error);
      message.error("이관 히스토리를 불러오는데 실패했습니다.");
    }
  };

  // 이관 실행
  const handleTransfer = async () => {
    if (!backendActor) {
      message.error("백엔드 연결이 되지 않았습니다.");
      return;
    }
    if (!userInfo) {
      message.error("로그인이 필요합니다.");
      return;
    }
    if (!selectedRecord) {
      message.error("이관할 진료 기록을 선택해주세요.");
      return;
    }
    if (selectedRecord.status === "transferred") {
      message.error("이미 이관된 진료 기록입니다.");
      return;
    }
    if (!selectedDoctor) {
      message.error("이관 받을 의사를 선택해주세요.");
      return;
    }
    if (!selectedDoctor.publicKey) {
      message.error("선택한 의사의 공개키가 등록되어 있지 않습니다.");
      return;
    }

    try {
      setLoading(true);

      // 1. 현재 사용자의 AES 키 복호화
      const decryptedAesKey = await decryptAesKey(
        type === "send"
          ? selectedRecord.encryptedAesKeyForSender
          : selectedRecord.encryptedAesKeyForReceiver,
        userInfo?.privateKey || ""
      );

      // 2. 새로운 의사들의 공개키로 AES 키 암호화
      if (!userInfo.publicKey) {
        message.error("현재 사용자의 공개키가 없습니다.");
        return;
      }

      let senderPublicKeyHex = userInfo.publicKey;
      if (senderPublicKeyHex.startsWith("0x")) {
        senderPublicKeyHex = senderPublicKeyHex.slice(2);
      }

      let receiverPublicKeyHex = selectedDoctor.publicKey;
      if (receiverPublicKeyHex.startsWith("0x")) {
        receiverPublicKeyHex = receiverPublicKeyHex.slice(2);
      }

      if (!receiverPublicKeyHex || !senderPublicKeyHex) {
        message.error("공개키가 올바르지 않습니다.");
        return;
      }

      // Receiver용 AES 키 암호화
      const encryptedAesKeyForReceiver = await eccrypto.encrypt(
        Buffer.from(receiverPublicKeyHex, "hex"),
        Buffer.from(decryptedAesKey, "hex")
      );
      const encryptedAesKeyForReceiverString = JSON.stringify({
        iv: encryptedAesKeyForReceiver.iv.toString("hex"),
        ephemPublicKey:
          encryptedAesKeyForReceiver.ephemPublicKey.toString("hex"),
        ciphertext: encryptedAesKeyForReceiver.ciphertext.toString("hex"),
        mac: encryptedAesKeyForReceiver.mac.toString("hex"),
      });

      // Sender용 AES 키 암호화
      const encryptedAesKeyForSender = await eccrypto.encrypt(
        Buffer.from(senderPublicKeyHex, "hex"),
        Buffer.from(decryptedAesKey, "hex")
      );
      const encryptedAesKeyForSenderString = JSON.stringify({
        iv: encryptedAesKeyForSender.iv.toString("hex"),
        ephemPublicKey: encryptedAesKeyForSender.ephemPublicKey.toString("hex"),
        ciphertext: encryptedAesKeyForSender.ciphertext.toString("hex"),
        mac: encryptedAesKeyForSender.mac.toString("hex"),
      });

      // 3. 이관 실행
      const result = await backendActor.transferMedicalRecord(
        selectedRecord.id,
        userInfo.email,
        selectedDoctor.email,
        encryptedAesKeyForSenderString,
        encryptedAesKeyForReceiverString
      );

      if ("ok" in result) {
        message.success("진료 기록이 성공적으로 이관되었습니다.");
        setTransferModalVisible(false);
        setSelectedDoctor(null);
        setSelectedRecord(null);

        // 목록 새로고침
        const offset = (pagination.current - 1) * pagination.pageSize;
        const recordResult = await backendActor.getMedicalRecordsByDoctor(
          userInfo.name,
          type === "send" ? "sender" : "receiver",
          offset,
          pagination.pageSize
        );

        const formattedRecords = recordResult.items.map((record: any) => ({
          id: Number(record.id.toString()),
          date: Number(record.date.toString()) / 1000000,
          phone: record.phone,
          patientName: record.patientName,
          title: record.title,
          description: record.description,
          fromDoctor: record.fromDoctor,
          fromEmail: record.fromEmail,
          fromHospital: record.fromHospital,
          fromDepartment: record.fromDepartment,
          fromPhone: record.fromPhone,
          toDoctor: record.toDoctor,
          toEmail: record.toEmail,
          toHospital: record.toHospital,
          toDepartment: record.toDepartment,
          toPhone: record.toPhone,
          cid: record.cid,
          status: record.status,
          encryptedAesKeyForSender: record.encryptedAesKeyForSender,
          encryptedAesKeyForReceiver: record.encryptedAesKeyForReceiver,
          originalRecordId: record.originalRecordId
            ? Number(record.originalRecordId.toString())
            : null,
          transferredDoctors: record.transferredDoctors,
        }));

        setMedicalRecords(formattedRecords);
      } else {
        message.error(result.err);
      }
    } catch (error) {
      console.error("진료 기록 이관 실패:", error);
      message.error("진료 기록 이관에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorClick = (record: MedicalRecord, isFromDoctor: boolean) => {
    setSelectedDoctorInfo({
      name: isFromDoctor ? record.fromDoctor : record.toDoctor,
      email: isFromDoctor ? record.fromEmail : record.toEmail,
      phone: isFromDoctor ? record.fromPhone : record.toPhone,
      hospital: isFromDoctor ? record.fromHospital : record.toHospital,
      department: isFromDoctor ? record.fromDepartment : record.toDepartment,
    });
    setDoctorInfoModalVisible(true);
  };

  const columns: ColumnsType<MedicalRecord> = [
    {
      title: "No",
      dataIndex: "id",
      key: "id",
      width: 70,
    },
    {
      title: "생성일",
      key: "date",
      width: 120,
      render: (_: unknown, record: MedicalRecord) => {
        const date = new Date(Number(record.date) / 1000000); // nanoseconds to milliseconds
        return date.toLocaleString("ko-KR", {
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    { title: "휴대폰", dataIndex: "phone", key: "phone", width: 120 },
    {
      title: "환자명",
      dataIndex: "patientName",
      key: "patientName",
      width: 100,
    },
    { title: "제목", dataIndex: "title", key: "title" },
    {
      title: "송신자",
      key: "sender",
      width: 200,
      render: (_: unknown, record: MedicalRecord) => (
        <div
          style={{ cursor: "pointer", color: "#1890ff" }}
          onClick={() => handleDoctorClick(record, true)}
        >
          {record.fromDoctor}
        </div>
      ),
      hidden: type === "send",
    },
    {
      title: "수신자",
      key: "receiver",
      width: 200,
      render: (_: unknown, record: MedicalRecord) => (
        <div
          style={{ cursor: "pointer", color: "#1890ff" }}
          onClick={() => handleDoctorClick(record, false)}
        >
          {record.toDoctor}
        </div>
      ),
      hidden: type === "receive",
    },
    {
      title: "CID",
      dataIndex: "cid",
      key: "cid",
      width: 150,
      render: (cid: string) => (
        <div
          className="copyable-text"
          onClick={() => {
            navigator.clipboard.writeText(cid);
            message.success("CID가 클립보드에 복사되었습니다.");
          }}
          title={cid}
        >
          <span>{cid.substring(0, 15)}...</span>
          <CopyOutlined />
        </div>
      ),
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const statusConfig: Record<
          string,
          { className: string; text: string }
        > = {
          pending: { className: "status-tag status-tag-pending", text: "대기" },
          transferred: {
            className: "status-tag status-tag-transferred",
            text: "이관됨",
          },
        };
        const config = statusConfig[status] || { className: "", text: status };
        return <span className={config.className}>{config.text}</span>;
      },
    },
    {
      title: "작업",
      key: "action",
      render: (_: unknown, record: MedicalRecord) => (
        <Space size="middle">
          <Button icon={<EyeOutlined />} onClick={() => handleFileView(record)}>
            보기
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => handleHistoryClick(record.id)}
          >
            진료이력
          </Button>
          {type === "receive" &&
            record.status === "pending" &&
            record.toDoctor === userInfo?.name &&
            record.fromDoctor !== userInfo?.name && (
              <Button
                icon={<SwapOutlined />}
                onClick={() => handleTransferClick(record)}
              >
                진료의뢰
              </Button>
            )}
        </Space>
      ),
    },
  ].filter((column) => !column.hidden);

  return (
    <>
      <div style={{ padding: "24px" }}>
        <div className="table-toolbar">
          <Select
            value={searchType}
            onChange={(value) => {
              setSearchType(value);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            options={[
              ...(type === "receive"
                ? [{ value: "sender", label: "송신자" }]
                : []),
              ...(type === "send"
                ? [{ value: "receiver", label: "수신자" }]
                : []),
              { value: "patient", label: "환자명" },
            ]}
          />
          <Search
            placeholder="검색어를 입력하세요"
            onSearch={(value) => console.log(value)}
            allowClear
          />
        </div>
        <Table
          columns={columns.map((column) => ({
            ...column,
            align:
              column.key === "action" || column.key === "status"
                ? "center"
                : "left",
            ellipsis: column.key !== "action",
            render:
              column.key === "status"
                ? (status: string) => {
                    const statusConfig: Record<
                      string,
                      { className: string; text: string }
                    > = {
                      pending: {
                        className: "status-tag status-tag-pending",
                        text: "대기",
                      },
                      transferred: {
                        className: "status-tag status-tag-transferred",
                        text: "이관됨",
                      },
                    };
                    const config = statusConfig[status] || {
                      className: "",
                      text: status,
                    };
                    return (
                      <span className={config.className}>{config.text}</span>
                    );
                  }
                : column.key === "cid"
                ? (cid: string) => (
                    <div
                      className="copyable-text"
                      onClick={() => {
                        navigator.clipboard.writeText(cid);
                        message.success("CID가 클립보드에 복사되었습니다.");
                      }}
                      title={cid}
                    >
                      <span>{cid.substring(0, 15)}...</span>
                      <CopyOutlined />
                    </div>
                  )
                : column.render,
          }))}
          dataSource={medicalRecords}
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
      </div>
      <FileViewerModal
        visible={viewerModalVisible}
        onClose={() => {
          setViewerModalVisible(false);
          // 메모리 정리
          setViewerFiles({ dicom: [], images: [], pdf: [] });
        }}
        files={viewerFiles}
      />
      <Modal
        title="진료의뢰"
        open={transferModalVisible}
        onOk={handleTransfer}
        onCancel={() => {
          setTransferModalVisible(false);
          setSelectedDoctor(null);
          setSelectedRecord(null);
          setDoctorPagination((prev) => ({ ...prev, current: 1 }));
          setDoctorSearchKeyword(""); // 검색어 초기화
        }}
        confirmLoading={loading}
      >
        <div style={{ marginBottom: 16 }}>
          <h4>의뢰할 의사 선택</h4>
          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <Select
              size="middle"
              value={doctorSearchType}
              onChange={setDoctorSearchType}
              style={{ width: 120 }}
              options={[
                { value: "name", label: "이름" },
                { value: "hospital", label: "병원" },
                { value: "department", label: "부서" },
              ]}
            />
            <Search
              placeholder="검색어를 입력하세요"
              value={doctorSearchKeyword}
              onChange={(e) => setDoctorSearchKeyword(e.target.value)}
              onSearch={() => fetchDoctors(1, doctorPagination.pageSize)}
              style={{ flex: 1 }}
              allowClear
            />
          </div>
          <Select
            style={{ width: "100%", marginBottom: 16 }}
            placeholder="의사를 선택해주세요"
            onChange={(value) => {
              console.log("Selected doctor ID:", value);
              const doctor = doctors.find((d) => d.id === value);
              console.log("Found doctor:", doctor);
              if (doctor && !doctor.publicKey) {
                message.warning(
                  "선택한 의사의 공개키가 등록되어 있지 않습니다."
                );
                return;
              }
              setSelectedDoctor(doctor || null);
            }}
            value={selectedDoctor?.id}
            options={doctors
              .filter((doctor) => doctor.publicKey) // 공개키가 있는 의사만 표시
              .map((doctor) => ({
                value: doctor.id,
                label: `${doctor.name} (${doctor.hospital} ${doctor.department})`,
              }))}
            notFoundContent={
              doctors.length === 0
                ? "검색 결과가 없습니다"
                : "공개키가 등록된 의사가 없습니다"
            }
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Select
              size="small"
              value={doctorPagination.pageSize}
              onChange={(value) => {
                setDoctorPagination((prev) => ({
                  ...prev,
                  pageSize: value,
                  current: 1,
                }));
                fetchDoctors(1, value);
              }}
              options={[
                { value: 10, label: "10개씩 보기" },
                { value: 20, label: "20개씩 보기" },
                { value: 50, label: "50개씩 보기" },
              ]}
              style={{ width: 120, marginRight: 8 }}
            />
            <Button.Group>
              <Button
                size="small"
                disabled={doctorPagination.current === 1}
                onClick={() =>
                  fetchDoctors(
                    doctorPagination.current - 1,
                    doctorPagination.pageSize
                  )
                }
              >
                이전
              </Button>
              <Button
                size="small"
                disabled={
                  doctorPagination.current * doctorPagination.pageSize >=
                  doctorPagination.total
                }
                onClick={() =>
                  fetchDoctors(
                    doctorPagination.current + 1,
                    doctorPagination.pageSize
                  )
                }
              >
                다음
              </Button>
            </Button.Group>
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 8,
              fontSize: "0.9em",
              color: "#666",
            }}
          >
            {`전체 ${doctorPagination.total}명 중 ${
              (doctorPagination.current - 1) * doctorPagination.pageSize + 1
            }-${Math.min(
              doctorPagination.current * doctorPagination.pageSize,
              doctorPagination.total
            )}명`}
          </div>
        </div>
      </Modal>
      <Modal
        title={
          <div
            style={{
              borderBottom: "1px solid var(--border-color)",
              padding: "16px 24px",
              margin: "0 -24px 16px",
              background: "var(--background-color)",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "var(--primary-color)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <HistoryOutlined /> 진료 이력 조회
            </h3>
          </div>
        }
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedHistories([]);
          setDoctors([]);
        }}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        <Timeline
          mode="left"
          items={selectedHistories.map((history, index) => ({
            label: (
              <div
                style={{ width: "180px", fontSize: "14px", fontWeight: "500" }}
              >
                {new Date(history.date).toLocaleString("ko-KR", {
                  year: "2-digit",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            ),
            children: (
              <Card
                size="small"
                style={{
                  marginBottom:
                    index === selectedHistories.length - 1 ? 0 : "24px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      paddingBottom: "12px",
                    }}
                  >
                    <Tag
                      color={index === 0 ? "blue" : "default"}
                      style={{
                        margin: 0,
                        padding: "4px 12px",
                        borderRadius: "4px",
                      }}
                    >
                      {index === 0 ? "최초 전송" : "이관됨"}
                    </Tag>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "24px",
                      color: "var(--text-color)",
                      fontSize: "14px",
                      padding: "0 8px",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        background: "var(--background-color)",
                        padding: "16px",
                        borderRadius: "6px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "600",
                          marginBottom: "12px",
                          color: "var(--primary-color)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        송신자
                      </div>
                      <div
                        style={{
                          marginBottom: "8px",
                          fontSize: "15px",
                          fontWeight: "500",
                        }}
                      >
                        {history.fromDoctor}
                      </div>
                      <div style={{ marginBottom: "8px", color: "#666" }}>
                        {history.fromHospital} {history.fromDepartment}
                      </div>
                      <div
                        style={{
                          color: "#666",
                          fontSize: "13px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div>{history.fromEmail}</div>
                        <div>{history.fromPhone}</div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: "#ccc",
                      }}
                    >
                      <ArrowRightOutlined style={{ fontSize: "20px" }} />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "var(--background-color)",
                        padding: "16px",
                        borderRadius: "6px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "600",
                          marginBottom: "12px",
                          color: "var(--primary-color)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        수신자
                      </div>
                      <div
                        style={{
                          marginBottom: "8px",
                          fontSize: "15px",
                          fontWeight: "500",
                        }}
                      >
                        {history.toDoctor}
                      </div>
                      <div style={{ marginBottom: "8px", color: "#666" }}>
                        {history.toHospital} {history.toDepartment}
                      </div>
                      <div
                        style={{
                          color: "#666",
                          fontSize: "13px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div>{history.toEmail}</div>
                        <div>{history.toPhone}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ),
            color: index === 0 ? "var(--primary-color)" : "#666",
          }))}
        />
      </Modal>
      <DoctorInfoModal
        visible={doctorInfoModalVisible}
        onClose={() => {
          setDoctorInfoModalVisible(false);
          setSelectedDoctorInfo(null);
        }}
        doctor={selectedDoctorInfo}
      />
    </>
  );
};

export default MedicalData;
