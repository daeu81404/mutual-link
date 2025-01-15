import {
  UserOutlined,
  ClockCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  SettingOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { MenuProps } from "antd";
import React from "react";

type MenuItem = Required<MenuProps>["items"][number];

export const regularMenuItems: MenuItem[] = [
  {
    key: "doctorList",
    icon: React.createElement(UserOutlined),
    label: "의사목록",
  },
  {
    key: "approvalWaiting",
    icon: React.createElement(ClockCircleOutlined),
    label: "승인대기",
  },
  {
    key: "medicalDataSend",
    icon: React.createElement(UploadOutlined),
    label: "진료데이터(송신)",
  },
  {
    key: "medicalDataReceive",
    icon: React.createElement(DownloadOutlined),
    label: "진료데이터(수신)",
  },
];

// 관리자 메뉴 아이템
export const adminMenuItems: MenuItem[] = [
  {
    key: "adminManagement",
    icon: React.createElement(SettingOutlined),
    label: "관리자 설정",
    children: [
      {
        key: "userManagement",
        icon: React.createElement(TeamOutlined),
        label: "사용자 관리",
      },
      {
        key: "hospitalManagement",
        icon: React.createElement(SafetyCertificateOutlined),
        label: "병원 관리",
      },
    ],
  },
];
