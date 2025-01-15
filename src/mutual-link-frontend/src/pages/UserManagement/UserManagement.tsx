import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
} from "antd";
import { useState, useEffect } from "react";
import type { ColumnsType } from "antd/es/table";
import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";

interface Doctor {
  id: bigint;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: "admin" | "user";
}

interface User {
  key: string;
  id: number;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: "admin" | "user";
}

type GetAllDoctorsResponse =
  | {
      ok: Doctor[];
    }
  | {
      err: string;
    };

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [backendActor, setBackendActor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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

        const result = (await actor.getAllDoctors()) as Doctor[];
        const formattedUsers = result.map((doctor: Doctor) => ({
          key: doctor.id.toString(),
          id: Number(doctor.id),
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          hospital: doctor.hospital,
          department: doctor.department,
          role: doctor.role as "admin" | "user",
        }));
        setUsers(formattedUsers);
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

  const columns: ColumnsType<User> = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "이름", dataIndex: "name", key: "name" },
    { title: "이메일", dataIndex: "email", key: "email" },
    { title: "전화번호", dataIndex: "phone", key: "phone" },
    { title: "병원", dataIndex: "hospital", key: "hospital" },
    { title: "부서", dataIndex: "department", key: "department" },
    { title: "권한", dataIndex: "role", key: "role" },
    {
      title: "작업",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button type="primary" onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Button danger onClick={() => handleDelete(record.id)}>
            삭제
          </Button>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    if (!backendActor) {
      message.error("백엔드가 초기화되지 않았습니다.");
      return;
    }

    Modal.confirm({
      title: "사용자를 삭제하시겠습니까?",
      content: "이 작업은 되돌릴 수 없습니다.",
      async onOk() {
        try {
          const result = await backendActor.deleteDoctor(id);
          if ("ok" in result) {
            setUsers(users.filter((user) => user.id !== id));
            message.success("사용자가 삭제되었습니다.");
          } else {
            message.error("사용자 삭제에 실패했습니다: " + result.err);
          }
        } catch (error) {
          console.error("사용자 삭제 중 오류 발생:", error);
          message.error("사용자 삭제 중 오류가 발생했습니다.");
        }
      },
    });
  };

  const handleModalOk = async () => {
    if (!backendActor) {
      message.error("백엔드가 초기화되지 않았습니다.");
      return;
    }

    try {
      const values = await form.validateFields();
      const doctor = {
        id: editingUser ? BigInt(editingUser.id) : BigInt(0),
        name: values.name,
        email: values.email,
        phone: values.phone,
        hospital: values.hospital,
        department: values.department,
        role: values.role,
      };

      const result = await backendActor.updateDoctor(doctor);

      if ("ok" in result) {
        const newUser = {
          id: Number(result.ok.id),
          name: result.ok.name,
          email: result.ok.email,
          phone: result.ok.phone,
          hospital: result.ok.hospital,
          department: result.ok.department,
          role: result.ok.role,
          key: result.ok.id.toString(),
        };

        setUsers((prev) => {
          if (editingUser) {
            const index = prev.findIndex((user) => user.id === editingUser.id);
            if (index > -1) {
              const newUsers = [...prev];
              newUsers[index] = newUser;
              return newUsers;
            }
          }
          return [...prev, newUser];
        });

        setIsModalVisible(false);
        message.success(`사용자가 ${editingUser ? "수정" : "추가"}되었습니다.`);
      } else {
        message.error(
          `사용자 ${editingUser ? "수정" : "추가"}에 실패했습니다: ` +
            result.err
        );
      }
    } catch (error) {
      message.error("사용자 정보 저장 중 오류가 발생했습니다.");
      console.error(error);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={handleAdd}>
          사용자 추가
        </Button>
      </div>

      <Table columns={columns} dataSource={users} loading={loading} />

      <Modal
        title={`사용자 ${editingUser ? "수정" : "추가"}`}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          {editingUser && (
            <Form.Item
              name="id"
              label="ID"
              rules={[{ required: true, message: "ID를 입력하세요" }]}
            >
              <Input disabled />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: "이름을 입력하세요" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { required: true, message: "이메일을 입력하세요" },
              { type: "email", message: "올바른 이메일 형식이 아닙니다" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="전화번호"
            rules={[{ required: true, message: "전화번호를 입력하세요" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="hospital"
            label="병원"
            rules={[{ required: true, message: "병원을 입력하세요" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="department"
            label="부서"
            rules={[{ required: true, message: "부서를 입력하세요" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="권한"
            rules={[{ required: true, message: "권한을 선택하세요" }]}
          >
            <Select>
              <Select.Option value="admin">관리자</Select.Option>
              <Select.Option value="user">일반 사용자</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
