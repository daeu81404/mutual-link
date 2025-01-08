import { doctors } from "@/mocks/doctors";
import { Doctor } from "@/types/doctor";
import { Table, Button } from "antd";
import type { ColumnsType } from "antd/es/table";

const DoctorList = () => {
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
      render: (_, record) => (
        <Button type="primary">환자 진료 기록 전송</Button>
      ),
    },
  ];

  const data = doctors;

  return <Table columns={columns} dataSource={data} rowKey="no" />;
};

export default DoctorList;
