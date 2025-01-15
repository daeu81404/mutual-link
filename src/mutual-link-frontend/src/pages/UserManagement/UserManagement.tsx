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
import { useState } from "react";
import type { ColumnsType } from "antd/es/table";

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

const initialUsers: User[] = [
  {
    key: "1",
    id: 1,
    name: "김창남",
    email: "kim@hospital.com",
    phone: "010-1234-5678",
    hospital: "서울대병원",
    department: "정신과",
    role: "admin",
  },
  {
    key: "2",
    id: 2,
    name: "이강희",
    email: "lee@hospital.com",
    phone: "010-2345-6789",
    hospital: "서울대병원",
    department: "내과",
    role: "user",
  },
];

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

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
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: "사용자를 삭제하시겠습니까?",
      content: "이 작업은 되돌릴 수 없습니다.",
      onOk() {
        setUsers(users.filter((user) => user.id !== id));
        message.success("사용자가 삭제되었습니다.");
      },
    });
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      const newUser = {
        ...values,
        key: values.id.toString(),
      };

      setUsers((prev) => {
        const index = prev.findIndex((user) => user.id === values.id);
        if (index > -1) {
          const newUsers = [...prev];
          newUsers[index] = newUser;
          return newUsers;
        }
        return [...prev, newUser];
      });

      setIsModalVisible(false);
      message.success("사용자 정보가 저장되었습니다.");
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={handleAdd}>
          사용자 추가
        </Button>
      </div>

      <Table columns={columns} dataSource={users} />

      <Modal
        title="사용자 정보"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="id"
            label="ID"
            rules={[{ required: true, message: "ID를 입력하세요" }]}
          >
            <Input />
          </Form.Item>
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
