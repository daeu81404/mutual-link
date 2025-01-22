import {
  Table,
  Select,
  Input,
  Button,
  Space,
  message,
  Modal,
  Timeline,
} from "antd";
import {
  DownloadOutlined,
  CopyOutlined,
  EyeOutlined,
  SwapOutlined,
  HistoryOutlined,
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

const { Search } = Input;

interface MedicalDataProps {
  type: "send" | "receive";
}

interface BackendApproval {
  id: bigint;
  date: bigint;
  phone: string;
  patientName: string;
  title: string;
  description: string;
  fromDoctor: string;
  toDoctor: string;
  cid: string;
  encryptedAesKeyForSender: string;
  encryptedAesKeyForReceiver: string;
  status: string;
  originalApprovalId: bigint | null;
  transferredDoctors: string[];
}

interface TransferHistory {
  id: number;
  fromDoctor: string;
  fromEmail: string;
  toDoctor: string;
  toEmail: string;
  date: number;
  originalApprovalId: number;
}

interface Approval {
  id: number;
  date: number;
  phone: string;
  patientName: string;
  title: string;
  description: string;
  fromDoctor: string;
  toDoctor: string;
  cid: string;
  status: string;
  encryptedAesKeyForSender: string;
  encryptedAesKeyForReceiver: string;
  originalApprovalId: number | null;
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
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendActor, setBackendActor] = useState<any>(null);
  const [searchType, setSearchType] = useState<
    "sender" | "receiver" | "patient"
  >("sender");
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
  const [selectedRecord, setSelectedRecord] = useState<Approval | null>(null);
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
  const [selectedHistories, setSelectedHistories] = useState<TransferHistory[]>(
    []
  );
  const [relatedApprovals, setRelatedApprovals] = useState<Approval[]>([]);

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

    const fetchApprovals = async () => {
      setLoading(true);
      try {
        const actor = await initActor();
        if (!actor || !userInfo?.name) return;

        const offset = (pagination.current - 1) * pagination.pageSize;
        const result = (await actor.getApprovalsByDoctor(
          userInfo.name,
          type === "send" ? "sender" : "receiver",
          offset,
          pagination.pageSize
        )) as { items: BackendApproval[]; total: bigint };

        const formattedApprovals = result.items.map(
          (approval: BackendApproval) => ({
            id: Number(approval.id.toString()),
            date: Number(approval.date.toString()),
            phone: approval.phone,
            patientName: approval.patientName,
            title: approval.title,
            description: approval.description,
            fromDoctor: approval.fromDoctor,
            toDoctor: approval.toDoctor,
            cid: approval.cid,
            status: approval.status,
            encryptedAesKeyForSender: approval.encryptedAesKeyForSender,
            encryptedAesKeyForReceiver: approval.encryptedAesKeyForReceiver,
            originalApprovalId: approval.originalApprovalId
              ? Number(approval.originalApprovalId.toString())
              : null,
            transferredDoctors: approval.transferredDoctors,
          })
        );

        setApprovals(formattedApprovals);
        setPagination((prev) => ({
          ...prev,
          total: Number(result.total.toString()),
        }));
      } catch (error) {
        console.error("승인 목록 조회 실패:", error);
        message.error("승인 목록을 가져오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [userInfo?.name, type, pagination.current, pagination.pageSize]);

  useEffect(() => {
    medicalDataCache.init();
  }, []);

  const handleFileView = async (record: Approval) => {
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
  const handleTransferClick = (record: Approval) => {
    setSelectedRecord(record);
    setTransferModalVisible(true);
    fetchDoctors(1, doctorPagination.pageSize);
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
      message.error("이관할 진료 데이터가 선택되지 않았습니다.");
      return;
    }
    // 이미 이관된 데이터인지 확인
    if (selectedRecord.status === "transferred") {
      message.error("이미 이관된 진료 데이터입니다.");
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

      // 1. IPFS에서 파일 다운로드
      const encryptedBlob = await downloadFromIPFS(selectedRecord.cid);

      // 2. 현재 사용자의 AES 키 복호화
      const decryptedAesKey = await decryptAesKey(
        type === "send"
          ? selectedRecord.encryptedAesKeyForSender
          : selectedRecord.encryptedAesKeyForReceiver,
        userInfo?.privateKey || ""
      );

      // 3. 새로운 의사의 공개키로 AES 키 암호화
      console.log("Selected doctor public key:", selectedDoctor.publicKey); // 디버깅용 로그

      // publicKey가 배열인 경우 첫 번째 요소를 사용
      let receiverPublicKeyHex = Array.isArray(selectedDoctor.publicKey)
        ? selectedDoctor.publicKey[0]
        : selectedDoctor.publicKey;

      // 0x 접두사가 있으면 제거
      if (
        typeof receiverPublicKeyHex === "string" &&
        receiverPublicKeyHex.startsWith("0x")
      ) {
        receiverPublicKeyHex = receiverPublicKeyHex.slice(2);
      }

      // 현재 사용자(sender)의 공개키 처리
      if (!userInfo.publicKey) {
        message.error("현재 사용자의 공개키가 없습니다.");
        return;
      }
      let senderPublicKeyHex = userInfo.publicKey;
      if (senderPublicKeyHex.startsWith("0x")) {
        senderPublicKeyHex = senderPublicKeyHex.slice(2);
      }

      if (!receiverPublicKeyHex || !senderPublicKeyHex) {
        message.error("공개키가 올바르지 않습니다.");
        return;
      }

      console.log(
        "Public key hex for encryption - receiver:",
        receiverPublicKeyHex
      ); // 디버깅용 로그
      console.log(
        "Public key hex for encryption - sender:",
        senderPublicKeyHex
      ); // 디버깅용 로그

      // Receiver용 AES 키 암호화
      const encryptedAesKeyForNewReceiver = await eccrypto.encrypt(
        Buffer.from(receiverPublicKeyHex, "hex"),
        Buffer.from(decryptedAesKey, "hex")
      );

      // Sender용 AES 키 암호화
      const encryptedAesKeyForNewSender = await eccrypto.encrypt(
        Buffer.from(senderPublicKeyHex, "hex"),
        Buffer.from(decryptedAesKey, "hex")
      );

      const encryptedAesKeyForReceiverString = JSON.stringify({
        iv: encryptedAesKeyForNewReceiver.iv.toString("hex"),
        ephemPublicKey:
          encryptedAesKeyForNewReceiver.ephemPublicKey.toString("hex"),
        ciphertext: encryptedAesKeyForNewReceiver.ciphertext.toString("hex"),
        mac: encryptedAesKeyForNewReceiver.mac.toString("hex"),
      });

      const encryptedAesKeyForSenderString = JSON.stringify({
        iv: encryptedAesKeyForNewSender.iv.toString("hex"),
        ephemPublicKey:
          encryptedAesKeyForNewSender.ephemPublicKey.toString("hex"),
        ciphertext: encryptedAesKeyForNewSender.ciphertext.toString("hex"),
        mac: encryptedAesKeyForNewSender.mac.toString("hex"),
      });

      // 4. 새로운 승인 생성 (originalApprovalId 추가)
      const originalId = selectedRecord.originalApprovalId || selectedRecord.id;
      const approvalData = {
        id: BigInt(0),
        date: BigInt(Date.now() * 1000000),
        phone: selectedRecord.phone,
        patientName: selectedRecord.patientName,
        title: selectedRecord.title,
        description: selectedRecord.description || "",
        fromDoctor: userInfo?.name || "",
        toDoctor: selectedDoctor?.name || "",
        cid: selectedRecord.cid,
        encryptedAesKeyForSender: encryptedAesKeyForSenderString,
        encryptedAesKeyForReceiver: encryptedAesKeyForReceiverString,
        status: "pending",
        originalApprovalId: [BigInt(originalId)], // opt nat 타입을 위해 배열로 감싸기
        transferredDoctors: [userInfo?.name || ""],
      };

      await backendActor.createApproval(approvalData);

      // 5. 이관 히스토리 추가
      await backendActor.addTransferHistory({
        id: BigInt(0),
        fromDoctor: userInfo.name,
        fromEmail: userInfo.email,
        toDoctor: selectedDoctor.name,
        toEmail: selectedDoctor.email,
        date: BigInt(Date.now() * 1000000),
        originalApprovalId: BigInt(originalId),
      });

      // 6. 원본 데이터의 상태를 transferred로 업데이트
      await backendActor.updateApprovalStatus(selectedRecord.id, "transferred");

      message.success("진료 데이터가 성공적으로 이관되었습니다.");
      setTransferModalVisible(false);
      setSelectedDoctor(null);
      setSelectedRecord(null);

      // 목록 새로고침
      const offset = (pagination.current - 1) * pagination.pageSize;
      const result = await backendActor.getApprovalsByDoctor(
        userInfo.name,
        type === "send" ? "sender" : "receiver",
        offset,
        pagination.pageSize
      );

      const formattedApprovals = result.items.map(
        (approval: BackendApproval) => ({
          id: Number(approval.id.toString()),
          date: Number(approval.date.toString()),
          phone: approval.phone,
          patientName: approval.patientName,
          title: approval.title,
          description: approval.description,
          fromDoctor: approval.fromDoctor,
          toDoctor: approval.toDoctor,
          cid: approval.cid,
          status: approval.status,
          encryptedAesKeyForSender: approval.encryptedAesKeyForSender,
          encryptedAesKeyForReceiver: approval.encryptedAesKeyForReceiver,
          originalApprovalId: approval.originalApprovalId
            ? Number(approval.originalApprovalId.toString())
            : null,
          transferredDoctors: approval.transferredDoctors,
        })
      );

      setApprovals(formattedApprovals);
    } catch (error) {
      console.error("진료 데이터 이관 실패:", error);
      message.error("진료 데이터 이관에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 이관 히스토리 조회
  const handleHistoryClick = async (approvalId: number) => {
    try {
      // 현재 승인 정보 조회
      const approvalResult = await backendActor.getApproval(BigInt(approvalId));
      console.log("현재 승인 정보:", approvalResult);

      if (!approvalResult) {
        message.error("승인 정보를 찾을 수 없습니다.");
        return;
      }

      // approval이 배열인 경우 첫 번째 항목 사용
      const approval = Array.isArray(approvalResult)
        ? approvalResult[0]
        : approvalResult;

      // originalApprovalId가 있으면 그것을 사용, 없으면 현재 id가 원본
      const originalId =
        Array.isArray(approval.originalApprovalId) &&
        approval.originalApprovalId.length > 0
          ? Number(approval.originalApprovalId[0].toString())
          : approval.id;

      // 원본 승인 정보 조회
      const originalApproval = await backendActor.getApproval(
        BigInt(originalId)
      );
      if (!originalApproval) {
        message.error("원본 승인 정보를 찾을 수 없습니다.");
        return;
      }

      const originalApprovalData = Array.isArray(originalApproval)
        ? originalApproval[0]
        : originalApproval;

      console.log("사용할 originalId:", originalId);

      const histories = await backendActor.getTransferHistories(
        BigInt(originalId)
      );
      console.log("조회된 이관 히스토리:", histories);

      const formattedHistories = histories.map((h: any) => {
        console.log("개별 히스토리 날짜:", h.date, typeof h.date);
        const historyDate =
          typeof h.date === "bigint"
            ? Number(h.date.toString()) / 1000000
            : Number(h.date) / 1000000;
        return {
          id: Number(h.id),
          fromDoctor: h.fromDoctor,
          fromEmail: h.fromEmail,
          toDoctor: h.toDoctor,
          toEmail: h.toEmail,
          date: historyDate,
          originalApprovalId: Number(h.originalApprovalId),
        };
      });

      // 최초 전송 기록 추가
      const initialHistory = {
        id: originalId,
        fromDoctor: originalApprovalData.fromDoctor || "",
        fromEmail: "",
        toDoctor: originalApprovalData.toDoctor || "",
        toEmail: "",
        date:
          typeof originalApprovalData.date === "bigint"
            ? Number(originalApprovalData.date.toString()) / 1000000
            : Number(originalApprovalData.date) / 1000000,
        originalApprovalId: originalId,
      };

      const allHistories = [initialHistory, ...formattedHistories];
      console.log("전체 히스토리:", allHistories);

      setSelectedHistories(allHistories);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error("이관 히스토리 조회 실패:", error);
      message.error("이관 히스토리를 불러오는데 실패했습니다.");
    }
  };

  const columns: ColumnsType<Approval> = [
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
      render: (_, record) => {
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
      render: (_, record) => <>{record.fromDoctor}</>,
    },
    {
      title: "수신자",
      key: "receiver",
      width: 200,
      render: (_, record) => <>{record.toDoctor}</>,
    },
    {
      title: "CID",
      dataIndex: "cid",
      key: "cid",
      width: 150,
      render: (cid: string) => (
        <div
          style={{ cursor: "pointer" }}
          onClick={() => {
            navigator.clipboard.writeText(cid);
            message.success("CID가 클립보드에 복사되었습니다.");
          }}
          title={cid}
        >
          <Space>
            <span>{cid.substring(0, 15)}...</span>
            <CopyOutlined style={{ color: "#1890ff" }} />
          </Space>
        </div>
      ),
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        switch (status) {
          case "pending":
            return "대기";
          case "transferred":
            return "이관됨";
          default:
            return status;
        }
      },
    },
    {
      title: "작업",
      key: "action",
      render: (_, record) => (
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
            record.status !== "transferred" &&
            record.toDoctor === userInfo?.name &&
            !record.transferredDoctors.includes(userInfo?.name || "") && (
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
  ];

  return (
    <>
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          <Select
            value={searchType}
            style={{ width: 120 }}
            onChange={(value) => {
              setSearchType(value);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            options={[
              { value: "sender", label: "송신자" },
              { value: "receiver", label: "수신자" },
              { value: "patient", label: "환자명" },
            ]}
          />
          <Search
            placeholder="검색어를 입력하세요"
            style={{ width: 300 }}
            onSearch={(value) => console.log(value)}
          />
        </div>
        <Table
          columns={columns}
          dataSource={approvals}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => {
              setPagination((prev) => ({
                ...prev,
                current: page,
                pageSize: pageSize,
              }));
            },
          }}
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
        title="진료 이력 조회"
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedHistories([]);
          setDoctors([]);
        }}
        footer={null}
        width={600}
      >
        <div>
          <h4>진료 이력</h4>
          <Timeline>
            {selectedHistories.map((history) => (
              <Timeline.Item key={history.id}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ marginLeft: 8 }}>
                    {new Date(history.date).toLocaleString("ko-KR", {
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <strong>{history.fromDoctor}</strong>
                  </div>
                  <div style={{ margin: "0 12px" }}>→</div>
                  <div style={{ flex: 1 }}>
                    <strong>{history.toDoctor}</strong>
                  </div>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      </Modal>
    </>
  );
};

export default MedicalData;
