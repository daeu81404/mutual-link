import { Table, Select, Input, Button, Space } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { medicalRecords } from "@/mocks/medicalRecords";

const { Search } = Input;

interface MedicalDataProps {
  type: "send" | "receive";
}

interface MedicalRecord {
  key: string;
  no: number;
  date: string;
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
    doctor?: string;
  };
  cid: string;
  status: string;
}

const MedicalData: React.FC<MedicalDataProps> = ({ type }) => {
  // 송신/수신 타입에 따라 필터링된 데이터를 반환
  const filteredData = medicalRecords.filter((record) => {
    if (type === "send") {
      // 송신 화면: 현재 로그인한 사용자(김창남)가 송신자인 데이터
      return record.sender.doctor === "김창남";
    } else {
      // 수신 화면: 현재 로그인한 사용자(김창남)가 수신자인 데이터
      return record.receiver.doctor === "김창남";
    }
  });

  const columns: ColumnsType<MedicalRecord> = [
    { title: "No", dataIndex: "no", key: "no", width: 70 },
    { title: "생성일", dataIndex: "date", key: "date", width: 120 },
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
    { title: "CID", dataIndex: "cid", key: "cid", width: 150 },
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
      render: () => <Button type="text" icon={<DownloadOutlined />} />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <Select
          defaultValue={type === "send" ? "송신자" : "수신자"}
          style={{ width: 120 }}
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
        dataSource={filteredData}
        rowKey="no"
        pagination={{
          total: filteredData.length,
          pageSize: 10,
          current: 1,
        }}
      />
    </div>
  );
};

export default MedicalData;
