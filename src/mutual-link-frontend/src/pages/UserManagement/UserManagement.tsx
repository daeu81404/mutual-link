import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Tooltip,
} from "antd";
import { useState, useEffect } from "react";
import type { ColumnsType } from "antd/es/table";
import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "../../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import {
  CopyOutlined,
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { createActor } from "../../utils/actor";

interface Doctor {
  id: bigint;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: string;
  publicKey: string[];
}

interface FormattedDoctor {
  key: string;
  id: number;
  name: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  role: string;
  publicKey: string | undefined;
}

type GetAllDoctorsResponse =
  | {
      ok: Doctor[];
    }
  | {
      err: string;
    };

const UserManagement = () => {
  const [users, setUsers] = useState<FormattedDoctor[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [backendActor, setBackendActor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<FormattedDoctor | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  useEffect(() => {
    const initActor = async () => {
      try {
        const actor = await createActor();
        setBackendActor(actor);
        return actor;
      } catch (error) {
        throw error;
      }
    };

    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const actor = await initActor();
        if (!actor) return;

        const offset = BigInt((pagination.current - 1) * pagination.pageSize);
        const limit = BigInt(pagination.pageSize);
        const result = await actor.getPagedDoctors(offset, limit);

        const formattedUsers = result.items.map((doctor: Doctor) => ({
          key: doctor.id.toString(),
          id: Number(doctor.id.toString()),
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          hospital: doctor.hospital,
          department: doctor.department,
          role: doctor.role,
          publicKey: doctor.publicKey[0],
        }));

        setUsers(formattedUsers);
        setPagination((prev) => ({
          ...prev,
          total: Number(result.total.toString()),
        }));
      } catch (error) {
        message.error(
          "의사 목록을 불러올 수 없습니다. 네트워크 연결을 확인해주세요."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [pagination.current, pagination.pageSize]);

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

  const columns: ColumnsType<FormattedDoctor> = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "이름", dataIndex: "name", key: "name" },
    { title: "이메일", dataIndex: "email", key: "email" },
    {
      title: "전화번호",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (phone: string) => formatPhoneNumber(phone),
    },
    { title: "병원", dataIndex: "hospital", key: "hospital" },
    { title: "부서", dataIndex: "department", key: "department" },
    { title: "권한", dataIndex: "role", key: "role" },
    {
      title: "Public Key",
      dataIndex: "publicKey",
      key: "publicKey",
      width: 300,
      render: (publicKey: string) =>
        publicKey ? (
          <div
            style={{ cursor: "pointer" }}
            onClick={() => {
              navigator.clipboard.writeText(publicKey);
              message.success("Public Key가 클립보드에 복사되었습니다.");
            }}
            title={publicKey}
          >
            <Space>
              <span>{publicKey.substring(0, 15)}...</span>
              <CopyOutlined style={{ color: "#1890ff" }} />
            </Space>
          </div>
        ) : (
          <span style={{ color: "#ff4d4f" }}>최초 로그인 대기</span>
        ),
    },
    {
      title: "작업",
      key: "action",
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Button
            type="primary"
            ghost
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
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

  const handleEdit = (user: FormattedDoctor) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    if (!backendActor) {
      message.error("시스템에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
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
            message.error(
              "사용자 삭제 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
            );
          }
        } catch (error) {
          message.error(
            "사용자 삭제 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
          );
        }
      },
    });
  };

  const handleModalOk = async () => {
    if (!backendActor) {
      message.error("시스템에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
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
        publicKey: editingUser?.publicKey ? [editingUser.publicKey] : [],
      };

      const result = editingUser
        ? await backendActor.updateDoctor(doctor)
        : await backendActor.createDoctor(doctor);

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
          publicKey: result.ok.publicKey[0] || undefined,
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
      message.error(
        "사용자 정보 저장 중 문제가 발생했습니다. 입력하신 정보를 다시 확인해주세요."
      );
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <div className="table-toolbar">
        <Button type="primary" icon={<UserAddOutlined />} onClick={handleAdd}>
          사용자 추가
        </Button>
      </div>

      <Table
        columns={columns.map((column) => ({
          ...column,
          align: column.key === "action" ? "center" : "left",
          ellipsis: column.key !== "action",
          render:
            column.key === "publicKey"
              ? (publicKey: string) =>
                  publicKey ? (
                    <div
                      className="copyable-text"
                      onClick={() => {
                        navigator.clipboard.writeText(publicKey);
                        message.success(
                          "Public Key가 클립보드에 복사되었습니다."
                        );
                      }}
                      title={publicKey}
                    >
                      <span>{publicKey.substring(0, 15)}...</span>
                      <CopyOutlined />
                    </div>
                  ) : (
                    <span style={{ color: "#ff4d4f" }}>최초 로그인 대기</span>
                  )
              : column.key === "role"
              ? (role: string) => (
                  <span
                    className={`status-tag ${
                      role === "admin"
                        ? "status-tag-approved"
                        : "status-tag-pending"
                    }`}
                  >
                    {role === "admin" ? "관리자" : "일반 사용자"}
                  </span>
                )
              : column.render,
        }))}
        dataSource={users}
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

      <Modal
        title={`사용자 ${editingUser ? "수정" : "추가"}`}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={520}
        style={{ top: 20 }}
        styles={{
          body: {
            padding: "24px",
            maxHeight: "calc(100vh - 200px)",
            overflow: "auto",
            background: "white",
            borderRadius: "8px",
          },
        }}
      >
        <Form
          form={form}
          layout="vertical"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
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
            rules={[
              { required: true, message: "이름을 입력하세요" },
              { min: 2, message: "이름은 최소 2자 이상이어야 합니다" },
              { max: 50, message: "이름은 최대 50자까지 입력 가능합니다" },
              {
                pattern: /^[가-힣a-zA-Z\s]+$/,
                message: "이름은 한글과 영문만 입력 가능합니다",
              },
              {
                whitespace: true,
                message: "이름은 공백만으로 구성될 수 없습니다",
              },
            ]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <div style={{ display: "flex", gap: "16px" }}>
            <Form.Item
              name="email"
              label="이메일"
              rules={[
                { required: true, message: "이메일을 입력하세요" },
                { type: "email", message: "올바른 이메일 형식이 아닙니다" },
                {
                  max: 100,
                  message: "이메일은 최대 100자까지 입력 가능합니다",
                },
                {
                  whitespace: true,
                  message: "이메일은 공백을 포함할 수 없습니다",
                },
              ]}
              style={{ flex: 1.2 }}
            >
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              name="phone"
              label="전화번호"
              rules={[
                { required: true, message: "전화번호를 입력하세요" },
                {
                  pattern: /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/,
                  message: "올바른 전화번호 형식이 아닙니다",
                },
              ]}
              style={{ flex: 0.8 }}
            >
              <Input
                maxLength={13}
                onChange={(e) => {
                  // 자동으로 하이픈 추가
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  if (value.length <= 11) {
                    let formattedValue = value;
                    if (value.length > 3) {
                      formattedValue = value.slice(0, 3) + "-" + value.slice(3);
                    }
                    if (value.length > 7) {
                      formattedValue =
                        formattedValue.slice(0, 8) +
                        "-" +
                        formattedValue.slice(8);
                    }
                    form.setFieldsValue({ phone: formattedValue });
                  }
                }}
                placeholder="010-0000-0000"
              />
            </Form.Item>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <Form.Item
              name="hospital"
              label="병원"
              rules={[
                { required: true, message: "병원을 입력하세요" },
                { min: 2, message: "병원명은 최소 2자 이상이어야 합니다" },
                {
                  max: 100,
                  message: "병원명은 최대 100자까지 입력 가능합니다",
                },
                {
                  whitespace: true,
                  message: "병원명은 공백만으로 구성될 수 없습니다",
                },
              ]}
              style={{ flex: 1.2 }}
            >
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              name="department"
              label="부서"
              rules={[
                { required: true, message: "부서를 입력하세요" },
                { min: 2, message: "부서명은 최소 2자 이상이어야 합니다" },
                { max: 50, message: "부서명은 최대 50자까지 입력 가능합니다" },
                {
                  whitespace: true,
                  message: "부서명은 공백만으로 구성될 수 없습니다",
                },
              ]}
              style={{ flex: 0.8 }}
            >
              <Input maxLength={50} />
            </Form.Item>
          </div>
          <Form.Item
            label="권한"
            name="role"
            rules={[{ required: true, message: "권한을 선택해주세요" }]}
            style={{ width: "50%" }}
          >
            <Select style={{ width: "100%" }}>
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
