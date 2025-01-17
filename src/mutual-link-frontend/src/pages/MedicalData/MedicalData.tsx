import { Table, Select, Input, Button, Space, message } from "antd";
import { DownloadOutlined, CopyOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useState, useEffect } from "react";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import { useAuth } from "@/contexts/AuthContext";
import CryptoJS from "crypto-js";
import * as eccrypto from "@toruslabs/eccrypto";

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
  sender: {
    hospital: string;
    department: string;
    doctor: string;
  };
  receiver: {
    hospital: string;
    department: string;
    doctor: string;
  };
  cid: string;
  encryptedAesKeyForSender: string;
  encryptedAesKeyForReceiver: string;
  status: string;
}

interface Approval {
  id: number;
  date: number;
  phone: string;
  patientName: string;
  title: string;
  sender: {
    hospital: string;
    department: string;
    doctor: string;
  };
  receiver: {
    hospital: string;
    department: string;
    doctor: string;
  };
  cid: string;
  status: string;
  encryptedAesKeyForSender: string;
  encryptedAesKeyForReceiver: string;
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

// 파일 복호화 및 다운로드
const decryptAndDownloadFile = async (
  encryptedBlob: Blob,
  aesKey: string,
  fileName: string
) => {
  try {
    // 암호화된 데이터를 ArrayBuffer로 읽기
    const arrayBuffer = await encryptedBlob.arrayBuffer();
    const encryptedData = new Uint8Array(arrayBuffer);

    const decryptedChunks: Uint8Array[] = [];
    let offset = 0;

    // 각 청크를 읽고 복호화
    while (offset < encryptedData.length) {
      // 청크 크기 읽기 (4바이트)
      const chunkSize =
        (encryptedData[offset] << 24) |
        (encryptedData[offset + 1] << 16) |
        (encryptedData[offset + 2] << 8) |
        encryptedData[offset + 3];
      offset += 4;

      // 청크 데이터 읽기
      const encryptedChunk = encryptedData.slice(offset, offset + chunkSize);
      offset += chunkSize;

      // 바이너리 데이터를 Base64로 변환
      let binary = "";
      for (let i = 0; i < encryptedChunk.length; i++) {
        binary += String.fromCharCode(encryptedChunk[i]);
      }
      const encryptedBase64 = btoa(binary);

      // 복호화
      const decryptedWordArray = CryptoJS.AES.decrypt(encryptedBase64, aesKey);

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
    const combinedArray = new Uint8Array(totalLength);
    let writeOffset = 0;
    for (const chunk of decryptedChunks) {
      combinedArray.set(chunk, writeOffset);
      writeOffset += chunk.length;
    }

    // Blob 생성 및 다운로드
    const blob = new Blob([combinedArray], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // 정리
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("파일 복호화 실패:", error);
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

        const result = (await actor.getApprovalsByDoctor(
          userInfo.name,
          type === "send" ? "sender" : "receiver"
        )) as BackendApproval[];

        const formattedApprovals = result.map((approval: BackendApproval) => ({
          id: Number(approval.id),
          date: Number(approval.date),
          phone: approval.phone,
          patientName: approval.patientName,
          title: approval.title,
          sender: approval.sender,
          receiver: approval.receiver,
          cid: approval.cid,
          status: approval.status,
          encryptedAesKeyForSender: approval.encryptedAesKeyForSender,
          encryptedAesKeyForReceiver: approval.encryptedAesKeyForReceiver,
        }));
        setApprovals(formattedApprovals);
      } catch (error) {
        console.error("승인 목록 조회 실패:", error);
        message.error("승인 목록을 가져오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [userInfo?.name, type]);

  const handleDownload = async (record: any) => {
    try {
      if (!userInfo?.privateKey) {
        message.error("개인키가 없습니다.");
        return;
      }

      setLoading(true);

      console.log("다운로드 시작", {
        userInfo: {
          name: userInfo.name,
          privateKey: userInfo.privateKey.substring(0, 10) + "...",
        },
        record: {
          sender: record.sender,
          receiver: record.receiver,
          encryptedAesKeyForSender: record.encryptedAesKeyForSender,
          encryptedAesKeyForReceiver: record.encryptedAesKeyForReceiver,
        },
      });

      // 1. IPFS에서 암호화된 파일 다운로드
      const encryptedBlob = await downloadFromIPFS(record.cid);

      // 2. AES 키 복호화 (송신자 또는 수신자의 암호화된 AES 키 사용)
      const isSender = userInfo.name === record.sender.doctor;
      console.log("사용자 역할:", isSender ? "송신자" : "수신자");

      const encryptedAesKey = isSender
        ? record.encryptedAesKeyForSender
        : record.encryptedAesKeyForReceiver;

      console.log("선택된 암호화된 AES 키:", {
        encryptedAesKey,
        isSender,
        userInfo: {
          name: userInfo.name,
          doctorName: isSender ? record.sender.doctor : record.receiver.doctor,
        },
      });

      const aesKey = await decryptAesKey(encryptedAesKey, userInfo.privateKey);
      console.log("복호화된 AES 키:", aesKey);

      // 3. 파일 복호화 및 다운로드
      const fileName = `${record.patientName}_${record.title}.zip`;
      await decryptAndDownloadFile(encryptedBlob, aesKey, fileName);

      message.success("파일 다운로드가 완료되었습니다.");
    } catch (error) {
      console.error("다운로드 실패:", error);
      message.error("파일 다운로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Approval> = [
    { title: "No", dataIndex: "id", key: "id", width: 70 },
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
      render: (_, record) => (
        <>
          {record.sender.hospital}
          <br />
          {record.sender.department}
          <br />
          {record.sender.doctor}
        </>
      ),
    },
    {
      title: "수신자",
      key: "receiver",
      width: 200,
      render: (_, record) => (
        <>
          {record.receiver.hospital}
          <br />
          {record.receiver.department}
          <br />
          {record.receiver.doctor}
        </>
      ),
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
      title: "전송 기록 / 이관",
      key: "action",
      width: 150,
      render: () => (
        <Space>
          <Button type="primary">전송 기록</Button>
          {type === "receive" && <Button>이관</Button>}
        </Space>
      ),
    },
    {
      title: "다운로드",
      key: "download",
      width: 70,
      render: (_, record) => (
        <Button onClick={() => handleDownload(record)} loading={loading}>
          다운로드
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <Select
          value={searchType}
          style={{ width: 120 }}
          onChange={(value) => setSearchType(value)}
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
          total: approvals.length,
          pageSize: 10,
          current: 1,
        }}
      />
    </div>
  );
};

export default MedicalData;
