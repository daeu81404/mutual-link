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
  SendOutlined,
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
import { saveReferralMetadata } from "@/firebase/referral";
import { saveNotificationHistory } from "@/firebase/notification";
import { createActor } from "../../utils/actor";

const { Search } = Input;

interface MedicalDataProps {
  type: "send" | "receive";
}

interface BackendMedicalRecord {
  id: bigint;
  date: bigint;
  phone: string;
  patientPhone: string;
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

// IPFS 게이트웨이 목록
const IPFS_GATEWAYS = ["https://ipfs.infura.io:5001/api/v0/cat?arg="];

// IPFS로부터 파일 다운로드
const downloadFromIPFS = async (cid: string): Promise<Blob> => {
  try {
    const response = await fetch(`${IPFS_GATEWAYS[0]}${cid}`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          btoa(
            "52f7d11b90ec45f1ac9912d0fb864695:248a2ce514834460a25058bf8068e740"
          ),
      },
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    // 직접 blob으로 변환
    const blob = await response.blob();
    return blob;
  } catch (error) {
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
    throw error;
  }
};

const MedicalData: React.FC<MedicalDataProps> = ({ type }) => {
  const { userInfo } = useAuth();
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendActor, setBackendActor] = useState<any>(null);
  const [searchType, setSearchType] = useState<"patient" | "doctor">("patient");
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
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
  const [noResults, setNoResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 검색어 입력 핸들러 (디바운스 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tempSearchQuery !== searchQuery) {
        handleSearch(tempSearchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tempSearchQuery]);

  const handleSearch = (value: string) => {
    const trimmedValue = value.trim();
    setSearchQuery(trimmedValue);
    setPagination((prev) => ({ ...prev, current: 1 }));

    if (trimmedValue === "") {
      setNoResults(false);
      return;
    }

    if (trimmedValue.length < 2) {
      message.warning("검색어는 최소 2자 이상 입력해주세요.");
      return;
    }
  };

  // 검색 결과 없음 상태 업데이트
  useEffect(() => {
    setNoResults(medicalRecords.length === 0 && searchQuery !== "");
  }, [medicalRecords, searchQuery]);

  // Actor 초기화를 위한 useEffect
  useEffect(() => {
    const initActor = async () => {
      try {
        const actor = await createActor();
        setBackendActor(actor);
      } catch (error) {
        throw error;
      }
    };

    initActor();
  }, []);

  // 데이터 로딩을 위한 useEffect
  useEffect(() => {
    const fetchMedicalRecords = async () => {
      if (!backendActor || !userInfo?.name) return;

      setLoading(true);
      try {
        const offset = BigInt((pagination.current - 1) * pagination.pageSize);
        const limit = BigInt(pagination.pageSize);
        let result;

        console.log("=== 진료기록 조회 시작 ===");
        console.log("조회 조건:", {
          의사이름: userInfo.name,
          역할: type === "send" ? "sender" : "receiver",
          offset: offset.toString(),
          limit: limit.toString(),
        });

        if (type === "send") {
          result = await backendActor.getMedicalRecordsByDoctor(
            userInfo.name,
            "sender",
            offset,
            limit
          );
        } else {
          result = await backendActor.getMedicalRecordsByDoctor(
            userInfo.name,
            "receiver",
            offset,
            limit
          );
        }

        console.log("백엔드 응답:", result);

        const formattedRecords = (result.items as any[]).map(
          (record: BackendMedicalRecord) => {
            console.log("백엔드 레코드 데이터:", {
              id: record.id.toString(),
              환자명: record.patientName,
              환자전화번호: record.patientPhone,
              phone필드: record.phone,
              송신의사: {
                이름: record.fromDoctor,
                전화번호: record.fromPhone,
              },
              수신의사: {
                이름: record.toDoctor,
                전화번호: record.toPhone,
              },
            });

            // 상태값 매핑 로직
            let status = record.status;
            // 모든 페이지에서 상태를 한글로 표시
            switch (record.status) {
              case "PENDING_APPROVAL":
              case "PENDING":
              case "pending":
                status = "승인 대기";
                break;
              case "APPROVED":
                status = "승인됨";
                break;
              case "REJECTED":
                status = "거부됨";
                break;
              case "TRANSFERRED":
              case "transferred":
                status = "이관됨";
                break;
              case "EXPIRED":
                status = "만료됨";
                break;
              default:
                status = "승인 대기"; // 기본값도 승인 대기로 변경
                break;
            }

            const formatted = {
              id: Number(record.id.toString()),
              date: (() => {
                const originalDate = record.date.toString();
                const milliseconds = Math.floor(Number(originalDate) / 1000000);
                return milliseconds;
              })(),
              phone: record.patientPhone, // patientPhone 사용
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
              status: status,
              encryptedAesKeyForSender: record.encryptedAesKeyForSender,
              encryptedAesKeyForReceiver: record.encryptedAesKeyForReceiver,
              originalRecordId: record.originalRecordId
                ? Number(record.originalRecordId.toString())
                : null,
              transferredDoctors: record.transferredDoctors,
            };

            console.log("변환된 레코드 데이터:", {
              id: formatted.id,
              환자명: formatted.patientName,
              환자전화번호: formatted.phone,
              송신의사: {
                이름: formatted.fromDoctor,
                전화번호: formatted.fromPhone,
              },
              수신의사: {
                이름: formatted.toDoctor,
                전화번호: formatted.toPhone,
              },
            });

            return formatted;
          }
        );

        setMedicalRecords(formattedRecords);
        setPagination((prev) => ({
          ...prev,
          total: Number(result.total.toString()),
        }));
      } catch (error) {
        console.error("진료기록 조회 중 에러:", error);
        message.error(
          "의료기록을 불러올 수 없습니다. 네트워크 연결을 확인해주세요."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalRecords();
  }, [
    backendActor,
    userInfo?.name,
    pagination.current,
    pagination.pageSize,
    type,
  ]);

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
        message.error("로그인 정보가 유효하지 않습니다. 다시 로그인해주세요.");
        return;
      }

      // 송신자 또는 수신자의 암호화된 AES 키 선택
      const isSender = userInfo.name === record.fromDoctor;
      const encryptedAesKey = isSender
        ? record.encryptedAesKeyForSender
        : record.encryptedAesKeyForReceiver;

      if (!encryptedAesKey) {
        message.error(
          "의료 데이터를 복호화할 수 없습니다. 관리자에게 문의해주세요."
        );
        return;
      }

      // 1. 캐시된 파일이 있는지 확인
      const cachedData = await medicalDataCache.getCachedFile(record.cid);
      let encryptedData: ArrayBuffer;

      if (cachedData) {
        encryptedData = cachedData.encryptedData;
      } else {
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
      throw error;
    } finally {
      loadingModal.destroy();
    }
  };

  // 의사 목록 조회
  const fetchDoctors = async (page: number = 1, pageSize: number = 10) => {
    try {
      if (!backendActor) {
        message.error(
          "시스템에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }
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
      message.error("이관 히스토리를 불러오는데 실패했습니다.");
    }
  };

  // 이관 실행
  const handleTransfer = async () => {
    if (!backendActor) {
      message.error("시스템에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
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
      message.error("의사 인증 정보가 없습니다. 관리자에게 문의해주세요.");
      return;
    }

    try {
      setLoading(true);
      setIsSubmitting(true);

      console.log("=== 진료의뢰 시작 ===");
      console.log("선택된 진료기록:", {
        id: selectedRecord.id,
        환자명: selectedRecord.patientName,
        환자전화번호: selectedRecord.phone,
        송신의사: {
          이름: userInfo.name,
          이메일: userInfo.email,
          전화번호: selectedRecord.fromPhone,
        },
        수신의사: {
          이름: selectedDoctor.name,
          이메일: selectedDoctor.email,
          전화번호: selectedDoctor.phone,
        },
      });

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
        // Firebase에 메타데이터 저장
        try {
          await saveReferralMetadata({
            referralId: result.ok.id
              ? result.ok.id.toString()
              : result.ok.toString(),
            fromEmail: userInfo?.email || "", // 송신자 이메일
            toEmail: selectedDoctor.email, // 수신자 이메일
            doctorName: selectedDoctor.name,
            hospitalName: selectedDoctor.hospital,
            department: selectedDoctor.department,
            patientName: selectedRecord.patientName,
            patientPhone: selectedRecord.phone,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // SMS 전송 로직 추가
          console.log("=== 진료의뢰 SMS 발송 디버깅 ===");
          console.log("선택된 진료기록:", {
            환자명: selectedRecord.patientName,
            환자전화번호: selectedRecord.phone,
            송신의사: {
              이름: userInfo?.name,
              전화번호: selectedRecord.fromPhone,
            },
            수신의사: {
              이름: selectedDoctor.name,
              전화번호: selectedDoctor.phone,
            },
          });

          const smsMessage = `${userInfo?.name}님이 전송한 [${
            selectedRecord.patientName
          }]의료정보 도착\nhttps://mutual-link-d70e6.web.app/?referralId=${
            result.ok.id ? result.ok.id.toString() : result.ok.toString()
          }`;

          // 환자의 전화번호에서 하이픈 제거
          const phoneNumber = selectedRecord.phone.replace(/-/g, "");
          console.log("SMS 발송 정보:", {
            수신번호: phoneNumber,
            메시지: smsMessage,
          });

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

          message.success(
            "진료의뢰가 요청되었습니다. 환자의 승인을 기다립니다."
          );
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

          const formattedRecords = recordResult.items.map((record: any) => {
            // 상태값 매핑 로직
            let status = record.status;
            switch (record.status) {
              case "PENDING_APPROVAL":
              case "PENDING":
              case "pending":
                status = "승인 대기";
                break;
              case "APPROVED":
                status = "승인됨";
                break;
              case "REJECTED":
                status = "거부됨";
                break;
              case "TRANSFERRED":
              case "transferred":
                status = "이관됨";
                break;
              case "EXPIRED":
                status = "만료됨";
                break;
              default:
                status = "승인 대기";
                break;
            }

            return {
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
              status: status,
              encryptedAesKeyForSender: record.encryptedAesKeyForSender,
              encryptedAesKeyForReceiver: record.encryptedAesKeyForReceiver,
              originalRecordId: record.originalRecordId
                ? Number(record.originalRecordId.toString())
                : null,
              transferredDoctors: record.transferredDoctors,
            };
          });

          setMedicalRecords(formattedRecords);
        } catch (error) {
          throw error;
        }
      } else {
        message.error(result.err);
      }
    } catch (error) {
      message.error(
        "진료 기록 이관 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
      setIsSubmitting(false);
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

  // 진료 의뢰 버튼 표시 여부 결정 함수
  const showTransferButton = (record: MedicalRecord) => {
    // 1. 수신 페이지에서만 표시
    if (type !== "receive") return false;
    // 2. 승인됨 상태인 경우만 표시
    if (record.status !== "승인됨") return false;
    // 3. 현재 사용자가 수신자인 경우만 표시
    if (record.toDoctor !== userInfo?.name) return false;
    // 4. 현재 사용자가 송신자가 아닌 경우만 표시
    if (record.fromDoctor === userInfo?.name) return false;
    return true;
  };

  // 휴대폰 번호 포맷팅 함수
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

  const columns: ColumnsType<MedicalRecord> = [
    {
      title: "No",
      dataIndex: "id",
      key: "id",
      width: 70,
    },
    {
      title: "생성일",
      dataIndex: "date",
      key: "date",
      render: (_: unknown, record: MedicalRecord) => {
        const date = new Date(Number(record.date));
        return date.toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      },
    },
    {
      title: "휴대폰",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (phone: string) => formatPhoneNumber(phone),
    },
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
        const statusConfig: Record<string, { color: string; text: string }> = {
          "승인 대기": {
            color: "orange",
            text: "승인 대기",
          },
          거부됨: {
            color: "red",
            text: "거부됨",
          },
          승인됨: {
            color: "green",
            text: "승인됨",
          },
          이관됨: {
            color: "blue",
            text: "이관됨",
          },
          만료됨: {
            color: "default",
            text: "만료됨",
          },
        };

        const config = statusConfig[status] || {
          color: "default",
          text: status,
        };
        return (
          <Tag
            color={config.color}
            style={{
              borderRadius: "12px",
              padding: "0 12px",
              height: "24px",
              lineHeight: "24px",
              fontSize: "12px",
              fontWeight: 500,
              textAlign: "center",
              minWidth: "70px",
            }}
          >
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: "작업",
      key: "action",
      render: (_: unknown, record: MedicalRecord) => (
        <Space size="middle">
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleFileView(record)}
          >
            보기
          </Button>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleHistoryClick(record.id)}
          >
            진료이력
          </Button>
          {showTransferButton(record) && (
            <Button
              type="primary"
              ghost
              size="small"
              icon={<SendOutlined />}
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
        <div className="table-toolbar" style={{ marginBottom: "16px" }}>
          <Select
            value={searchType}
            onChange={setSearchType}
            style={{ width: 120 }}
            options={[
              { value: "patient", label: "환자명" },
              { value: "doctor", label: type === "send" ? "수신자" : "송신자" },
            ]}
          />
          <Search
            placeholder={`${
              searchType === "patient"
                ? "환자명"
                : type === "send"
                ? "수신자(의사) 이름"
                : "송신자(의사) 이름"
            }으로 검색 (최소 2자 이상)`}
            value={tempSearchQuery}
            onChange={(e) => setTempSearchQuery(e.target.value)}
            style={{ width: 400, marginLeft: 8 }}
            allowClear
          />
        </div>

        {noResults ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "#999",
            }}
          >
            <div style={{ fontSize: "16px", marginBottom: "8px" }}>
              검색 결과가 없습니다
            </div>
            <div style={{ fontSize: "14px" }}>
              다른 검색어로 다시 시도해보세요
            </div>
          </div>
        ) : (
          <Table
            columns={columns.map((column) => ({
              ...column,
              align:
                column.key === "action" || column.key === "status"
                  ? "center"
                  : "left",
              ellipsis: column.key !== "action",
              render:
                column.key === "cid"
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
        )}
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
          if (loading || isSubmitting) return; // 로딩 중이거나 제출 중일 때는 취소 불가능
          setTransferModalVisible(false);
          setSelectedDoctor(null);
          setSelectedRecord(null);
          setDoctorPagination((prev) => ({ ...prev, current: 1 }));
          setDoctorSearchKeyword(""); // 검색어 초기화
        }}
        confirmLoading={loading}
        maskClosable={!loading && !isSubmitting} // 로딩 중이거나 제출 중일 때는 마스크 클릭으로 닫기 불가능
        closable={!loading && !isSubmitting} // 로딩 중이거나 제출 중일 때는 X 버튼으로 닫기 불가능
        keyboard={!loading && !isSubmitting} // 로딩 중이거나 제출 중일 때는 ESC로 닫기 불가능
        footer={
          <div style={{ textAlign: "center" }}>
            <Button
              onClick={() => {
                if (loading || isSubmitting) return;
                setTransferModalVisible(false);
                setSelectedDoctor(null);
                setSelectedRecord(null);
                setDoctorPagination((prev) => ({ ...prev, current: 1 }));
                setDoctorSearchKeyword("");
              }}
              style={{ marginRight: 8 }}
              disabled={loading || isSubmitting}
            >
              취소
            </Button>
            <Button
              type="primary"
              onClick={handleTransfer}
              loading={loading || isSubmitting}
              disabled={loading || isSubmitting}
            >
              {loading || isSubmitting ? "등록 중..." : "등록"}
            </Button>
          </div>
        }
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
              const doctor = doctors.find((d) => d.id === value);
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
                {new Date(Number(history.date)).toLocaleString("ko-KR", {
                  year: "2-digit",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
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
