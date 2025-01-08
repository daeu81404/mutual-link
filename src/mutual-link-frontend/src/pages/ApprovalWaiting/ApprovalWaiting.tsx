import { approvals } from "@/mocks/approvals";
import { Approval } from "@/types/approval";
import { Table, Select, Input } from "antd";
import type { ColumnsType } from "antd/es/table";

const { Search } = Input;

const ApprovalWaiting = () => {
  const columns: ColumnsType<Approval> = [
    { title: "No", dataIndex: "no", key: "no", width: 70 },
    { title: "생성일", dataIndex: "date", key: "date", width: 120 },
    { title: "휴대폰", dataIndex: "requestId", key: "requestId", width: 120 },
    {
      title: "환자명",
      dataIndex: "patientName",
      key: "patientName",
      width: 100,
    },
    { title: "제목", dataIndex: "content", key: "content" },
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
        </>
      ),
    },
    { title: "CID", dataIndex: "cid", key: "cid", width: 150 },
    { title: "상태", dataIndex: "status", key: "status", width: 100 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <Select
          defaultValue="수신자"
          style={{ width: 120 }}
          options={[
            { value: "receiver", label: "수신자" },
            { value: "sender", label: "송신자" },
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
        rowKey="no"
        pagination={{
          total: approvals.length,
          pageSize: 10,
          current: 1,
        }}
      />
    </div>
  );
};

export default ApprovalWaiting;
