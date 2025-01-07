import {
  UserOutlined,
  ClockCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { MenuProps } from "antd";
import React from "react";

type MenuItem = Required<MenuProps>["items"][number];

export const menuItems: MenuItem[] = [
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
