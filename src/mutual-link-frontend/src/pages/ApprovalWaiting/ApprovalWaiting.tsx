import { Table, Select, Input, message, Space } from "antd";
import { useState, useEffect } from "react";
import type { ColumnsType } from "antd/es/table";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import { useAuth } from "@/contexts/AuthContext";
import { CopyOutlined } from "@ant-design/icons";

const { Search } = Input;

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

const ApprovalWaiting = () => {
  const { userInfo } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendActor, setBackendActor] = useState<any>(null);
  const [searchRole, setSearchRole] = useState<"receiver" | "sender">("sender");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

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
          searchRole,
          offset,
          pagination.pageSize
        )) as { items: BackendApproval[]; total: bigint };

        const formattedApprovals = result.items.map(
          (approval: BackendApproval) => ({
            id: Number(approval.id),
            date: Number(approval.date),
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
  }, [userInfo?.name, searchRole, pagination.current, pagination.pageSize]);

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
      render: (_: unknown, record: Approval) => <>{record.fromDoctor}</>,
      hidden: searchRole === "sender",
    },
    {
      title: "수신자",
      key: "receiver",
      width: 200,
      render: (_: unknown, record: Approval) => <>{record.toDoctor}</>,
      hidden: searchRole === "receiver",
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
        const color = status === "승인대기중" ? "#ff4d4f" : "#52c41a";
        return <span style={{ color }}>{status}</span>;
      },
    },
  ].filter((column) => !column.hidden);

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <Select
          value={searchRole}
          style={{ width: 120 }}
          onChange={(value) => {
            setSearchRole(value);
            setPagination((prev) => ({ ...prev, current: 1 }));
          }}
          options={[
            { value: "receiver", label: "수신자" },
            { value: "sender", label: "송신자" },
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
  );
};

export default ApprovalWaiting;
