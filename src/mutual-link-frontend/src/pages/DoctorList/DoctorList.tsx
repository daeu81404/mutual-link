import { Table, Button, message } from "antd";
import { useState, useEffect } from "react";
import type { ColumnsType } from "antd/es/table";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";

interface BackendDoctor {
  id: bigint;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: string;
}

interface Doctor {
  no: string;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
}

const DoctorList = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendActor, setBackendActor] = useState<any>(null);

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

        const result = (await actor.getAllDoctors()) as BackendDoctor[];
        const formattedDoctors = result.map((doctor: BackendDoctor) => ({
          no: doctor.id.toString(),
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          hospital: doctor.hospital,
          department: doctor.department,
        }));
        setDoctors(formattedDoctors);
      } catch (error) {
        console.error("의사 목록 조회 실패:", error);
        message.error(
          "의사 목록을 가져오는데 실패했습니다. 개발자 도구의 콘솔을 확인해주세요."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

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

  return (
    <Table
      columns={columns}
      dataSource={doctors}
      rowKey="no"
      loading={loading}
    />
  );
};

export default DoctorList;
