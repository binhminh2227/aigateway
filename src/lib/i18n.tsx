"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "vi";

const T = {
  en: {
    // Nav
    nav: {
      dashboard: "Dashboard", apiKeys: "API Keys", usage: "Usage",
      docs: "Documentation", channels: "Channel Status", subscriptions: "My Subscriptions",
      billing: "Recharge / Subscription", orders: "Top-up History", redeem: "Redeem",
      profile: "Profile", admin: "Admin Panel", signout: "Sign out",
    },
    // Top bar
    topbar: { balance: "Balance" },
    // Dashboard page
    dash: {
      title: "Dashboard", welcome: "Welcome back! Here's an overview of your account.",
      balance: "Balance", available: "Available",
      apiKeys: "API Keys", active: "Active",
      todayReqs: "Today Requests", total: "Total",
      todayCost: "Today Cost",
      todayTokens: "Today Tokens", totalTokens: "Total Tokens",
      performance: "Performance", avgResponse: "Avg Response", avgTime: "Average time",
      timeRange: "Time Range", refresh: "Refresh", granularity: "Granularity",
      day: "Day", hour: "Hour",
      last7: "Last 7 Days", last15: "Last 15 Days", last30: "Last 30 Days",
      modelDist: "Model Distribution", tokenTrend: "Token Usage Trend",
      noData: "No data yet",
      recentUsage: "Recent Usage", last7days: "Last 7 days",
      noUsage: "No usage yet. Create an API key and start making requests.",
      quickActions: "Quick Actions", loggedAs: "Logged in as",
      createKey: "Create API Key", createKeySub: "Generate a new API key",
      viewUsage: "View Usage", viewUsageSub: "Check detailed usage logs",
      recharge: "Recharge", rechargeSub: "Top up your balance",
      reqs: "reqs", tokens: "tokens", input: "Input", output: "Output",
    },
    // API Keys page
    keys: {
      title: "API Keys", subtitle: "Manage your API keys and access tokens",
      create: "+ Create API Key", search: "Search name or key...",
      allStatus: "All Status", allGroups: "All Groups",
      statusActive: "Active", statusInactive: "Inactive",
      name: "Name", apiKey: "API Key", usageCol: "Usage", expires: "Expires",
      status: "Status", lastUsed: "Last Used", actions: "Actions",
      never: "Never", useKey: "Use Key", disable: "Disable", enable: "Enable", delete: "Delete",
      noKeys: "No API keys yet", noKeysSub: "Create your first key to start making API calls.",
      showingResults: "Showing 1 to",
      of: "of", results: "results",
      today: "Today", quota: "Quota",
      deleteConfirm: "Delete this API key? This action cannot be undone.",
      apiEndpoints: "API Endpoints",
    },
    // Create key modal
    createModal: {
      title: "Create API Key", name: "Name", namePlaceholder: "My API Key",
      group: "Group", groupOpt: "(optional)", groupPlaceholder: "e.g. GPT Pro, Personal, Work...",
      groupHint: "Assign this key to a group to organize and filter your keys.",
      customKey: "Custom Key", customKeyHint: "Only letters, numbers, underscores and hyphens allowed. Minimum 16 characters.",
      customKeyPlaceholder: "Enter your custom key (min 16 chars)",
      ipRestrict: "IP Restriction",
      ipWhitelist: "IP Whitelist", ipWhitelistHint: "One IP or CIDR per line. Only these IPs can use this key when set.",
      ipBlacklist: "IP Blacklist", ipBlacklistHint: "One IP or CIDR per line. These IPs will be blocked.",
      quota: "Quota Limit", quotaPlaceholder: "Enter quota limit in USD", quotaHint: "Set the maximum amount this key can spend. 0 = unlimited.",
      rateLimit: "Rate Limit", rateLimitHint: "Set the maximum spending for this key within each time window. 0 = unlimited.",
      limit5h: "5-Hour Limit (USD)", limitDaily: "Daily Limit (USD)", limit7d: "7-Day Limit (USD)",
      expiration: "Expiration", expiresDate: "Expiration Date", expiresHint: "Select when this API key should expire.",
      custom: "Custom", days: "days",
      cancel: "Cancel", creating: "Creating...", create: "Create",
    },
    // Use Key modal
    useModal: {
      title: "Use API Key — Codex CLI",
      desc: "Configure Codex CLI to route through this gateway. Follow each step in order.",
      warn: "Make sure config.toml content sits at the very top of the file. Existing entries with the same key will conflict.",
      missingKey: "Full API key was only available at creation. The server no longer stores plaintext. Replace <your-api-key> with the key you copied, or create a new key.",
      close: "Close",
      step1Title: "1. Install Codex CLI",
      step1Desc: "Skip if already installed. Requires Node.js 18+.",
      step2Title: "2. Create config directory",
      step2Desc: "Codex reads config from this folder.",
      step3Title: "3. Add config.toml",
      step3Desc: "Selects the model and points Codex at this gateway as the upstream.",
      step4Title: "4. Add auth.json",
      step4Desc: "Codex reads OPENAI_API_KEY from here. Use your gateway key (sk-gw-…), not an OpenAI key.",
      step5Title: "5. Launch Codex",
      step5Desc: "Run inside any project folder.",
      step6Title: "6. Verify",
      step6Desc: "Send a prompt. Usage will appear under Dashboard → Usage and credits will be deducted from your balance.",
      tipsTitle: "Tips",
      tip1: "Switch model by changing model = \"…\" in config.toml. See /v1/models for the full list.",
      tip2: "If you see 401, the API key is wrong or revoked. If 402, your balance/plan ran out.",
      tip3: "Streaming and tool-calling work the same as the official OpenAI API.",
    },
    // Common
    common: { save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", add: "Add", confirm: "Confirm", loading: "Loading...", copy: "Copy", copied: "Copied" },
    // Admin
    admin: {
      title: "Admin Panel", overview: "Admin Overview",
      totalUsers: "Total Users", activeKeys: "Active Keys", totalRevenue: "Total Revenue", pendingTopups: "Pending Top-ups",
      todayRevenue: "Today Revenue", todayReqs: "Today Requests",
      tabs: { dashboard: "Dashboard", users: "Users", topups: "Top-ups", redeem: "Redeem Codes", tcdmx: "Providers", pricing: "Model Pricing", plans: "Plans", payment: "Payment Config" },
      users: {
        title: "Users", addBalance: "Add Balance to User",
        selectUser: "Select user...", amount: "Amount USD",
        email: "Email", name: "Name", balance: "Balance", keys: "Keys", requests: "Requests", role: "Role", joined: "Joined",
        delete: "Delete", setRole: "Set Role", setLimit: "Set Limit",
        deleteConfirm: "Delete this user? This cannot be undone.",
      },
      topups: {
        title: "Top-ups", pending: "Pending", all: "All",
        user: "User", amount: "Amount", method: "Method", date: "Date", proof: "Proof", note: "Note",
        approve: "Approve", reject: "Reject", noTopups: "No top-ups found",
      },
      redeem: {
        title: "Redeem Codes", createNew: "Create New Codes",
        amount: "Amount (USD)", count: "Count", note: "Note (optional)",
        generating: "Generating...", generate: "Generate",
        code: "Code", usedBy: "Used By", usedAt: "Used At", created: "Created",
        unused: "Unused", used: "Used", del: "Del",
      },
      tcdmx: {
        title: "Providers", addKey: "Add Provider Key",
        keyPlaceholder: "API Key", labelPlaceholder: "Label (optional)",
        adding: "Adding...", add: "Add Key",
        totalKeys: "Total Keys", activeKeys: "Active", rateLimited: "Rate Limited", errorKeys: "Error",
        key: "Key", label: "Label", provider: "Provider", status: "Status", errors: "Errors", lastUsed: "Last Used", actions: "Actions",
        active: "Active", disabled: "Disabled", rateLim: "Rate Limited",
        reset: "Reset", enable: "Enable", disable: "Disable",
      },
      pricing: {
        title: "Model Pricing", saveAll: "Save All",
        globalSettings: "Global Settings", markup: "Price Markup (e.g. 1.3 = +30%)", concurrency: "Default Concurrency (requests)",
        addModel: "Add New Model", modelId: "Model ID (e.g. gpt-4o)", inputPer1m: "Input $/1M", outputPer1m: "Output $/1M",
        model: "Model", input: "Input $/1M", output: "Output $/1M", enabled: "Enabled", action: "Action",
      },
      plans: {
        title: "Plans", addPlan: "Add Plan", editPlan: "Edit Plan",
        planName: "Plan Name", price: "Price (USD)", duration: "Duration (days)", dailyLimit: "Daily Limit (USD/day)", description: "Description",
        features: "Features (one per line)", enabledLabel: "Enabled", sortOrder: "Sort Order",
        saving: "Saving...", save: "Save Plan", cancel: "Cancel",
        name: "Name", monthly: "Monthly", actions: "Actions", edit: "Edit", del: "Del", noPlans: "No plans yet.",
      },
      backToDash: "Back to Dashboard",
      payment: {
        title: "Payment Configuration", subtitle: "Configure payment methods shown to users",
        bankSection: "Bank Transfer", bankName: "Bank Name", bankAccount: "Account Number",
        bankHolder: "Account Holder", bankContent: "Transfer Content Prefix",
        bankContentHint: "e.g. NAPTIEN — users will append their email",
        usdtSection: "USDT (Crypto)", usdtTrc20: "TRC20 Wallet Address", usdtErc20: "ERC20 Wallet Address",
        usdtRate: "Rate (USDT per USD)", usdtRateHint: "e.g. 1 means 1 USDT = 1 USD",
        web2mSection: "Web2M", web2mInfo: "Web2M Instructions",
        save: "Save Configuration", saving: "Saving...", saved: "Saved!",
      },
    },
    // Profile
    profile: {
      title: "Profile Settings", subtitle: "Manage your account information and settings",
      balance: "Account Balance", concurrency: "Concurrency Limit", member: "Member Since",
      avatarTitle: "Profile & Avatar", avatarSub: "Update your display name and avatar.",
      avatarLabel: "Profile Avatar", avatarHint: "Initials auto-generated from email",
      uploadImage: "Upload image",
      editProfile: "Edit Profile", displayName: "Display Name", update: "Update Profile",
      signInMethods: "Connected Sign-In Methods",
      email: "Email", bound: "Bound", manageEmail: "Manage email",
      emailPrimary: "Primary email is managed in the profile form.",
      changePassword: "Change Password", currentPw: "Current Password", newPw: "New Password", confirmPw: "Confirm New Password", updatePw: "Update Password",
      dangerZone: "Danger Zone", deleteAccount: "Delete Account", deleteHint: "Once deleted, your account and all data will be permanently removed.",
      deleteBtn: "Delete My Account",
    },
    // Billing
    billing: {
      title: "Recharge", subtitle: "Add credits to your account",
      method: "Payment Method", bank: "Bank Transfer", usdt: "USDT (Crypto)",
      amount: "Amount (VND)", note: "Transfer note", bankName: "Bank", account: "Account number", holder: "Account holder",
      steps: "Transfer steps", step1: "Transfer the exact amount with the exact content",
      step2: "Credits will be added within 5–30 minutes after confirmation",
      wallet: "Wallet Address", network: "Network",
      usdtNote: "Send exactly the amount shown. Use correct network to avoid loss.",
      history: "Top-up History", pending: "Pending", completed: "Completed", failed: "Failed",
      date: "Date", method2: "Method",
    },
    // Usage
    usage: {
      title: "Usage", subtitle: "Detailed API usage history",
      filter: "Filter", allModels: "All Models", last7: "Last 7 days", last30: "Last 30 days", allTime: "All time",
      model: "Model", tokens: "Tokens", cost: "Cost", time: "Time", noData: "No usage data yet.",
      inputT: "Input", outputT: "Output",
    },
    // Redeem
    redeem: {
      title: "Redeem Code", subtitle: "Enter a redeem code to add balance",
      placeholder: "Enter redeem code...", btn: "Redeem",
      success: "Code redeemed successfully!", history: "Redeem History",
      code: "Code", amount: "Amount", date: "Date", noHistory: "No history yet.",
    },
  },

  vi: {
    nav: {
      dashboard: "Tổng quan", apiKeys: "Khóa API", usage: "Lịch sử dùng",
      docs: "Tài liệu", channels: "Trạng thái kênh", subscriptions: "Đăng ký của tôi",
      billing: "Nạp tiền / Đăng ký", orders: "Lịch sử nạp tiền", redeem: "Đổi mã",
      profile: "Hồ sơ", admin: "Quản trị", signout: "Đăng xuất",
    },
    topbar: { balance: "Số dư" },
    dash: {
      title: "Tổng quan", welcome: "Chào mừng trở lại! Đây là tổng quan tài khoản của bạn.",
      balance: "Số dư", available: "Khả dụng",
      apiKeys: "Khóa API", active: "Đang hoạt động",
      todayReqs: "Yêu cầu hôm nay", total: "Tổng",
      todayCost: "Chi phí hôm nay",
      todayTokens: "Token hôm nay", totalTokens: "Tổng Token",
      performance: "Hiệu suất", avgResponse: "Phản hồi TB", avgTime: "Thời gian trung bình",
      timeRange: "Khoảng thời gian", refresh: "Làm mới", granularity: "Độ chi tiết",
      day: "Ngày", hour: "Giờ",
      last7: "7 ngày qua", last15: "15 ngày qua", last30: "30 ngày qua",
      modelDist: "Phân bổ Model", tokenTrend: "Xu hướng sử dụng Token",
      noData: "Chưa có dữ liệu",
      recentUsage: "Sử dụng gần đây", last7days: "7 ngày qua",
      noUsage: "Chưa có lịch sử. Tạo khóa API và bắt đầu gọi lệnh.",
      quickActions: "Thao tác nhanh", loggedAs: "Đang đăng nhập với",
      createKey: "Tạo Khóa API", createKeySub: "Tạo một khóa API mới",
      viewUsage: "Xem lịch sử", viewUsageSub: "Xem chi tiết lịch sử dùng",
      recharge: "Nạp tiền", rechargeSub: "Nạp thêm số dư",
      reqs: "lượt", tokens: "token", input: "Đầu vào", output: "Đầu ra",
    },
    keys: {
      title: "Khóa API", subtitle: "Quản lý các khóa API và token truy cập",
      create: "+ Tạo Khóa API", search: "Tìm tên hoặc khóa...",
      allStatus: "Tất cả trạng thái", allGroups: "Tất cả nhóm",
      statusActive: "Hoạt động", statusInactive: "Tắt",
      name: "Tên", apiKey: "Khóa API", usageCol: "Sử dụng", expires: "Hết hạn",
      status: "Trạng thái", lastUsed: "Dùng lần cuối", actions: "Thao tác",
      never: "Chưa bao giờ", useKey: "Dùng Key", disable: "Tắt", enable: "Bật", delete: "Xóa",
      noKeys: "Chưa có khóa API nào", noKeysSub: "Tạo khóa đầu tiên để bắt đầu gọi API.",
      showingResults: "Hiển thị 1 đến",
      of: "trong", results: "kết quả",
      today: "Hôm nay", quota: "Hạn mức",
      deleteConfirm: "Xóa khóa API này? Không thể hoàn tác.",
      apiEndpoints: "Điểm cuối API",
    },
    createModal: {
      title: "Tạo Khóa API", name: "Tên", namePlaceholder: "Khóa API của tôi",
      group: "Nhóm", groupOpt: "(tùy chọn)", groupPlaceholder: "VD: GPT Pro, Cá nhân, Công việc...",
      groupHint: "Gán khóa này vào nhóm để dễ tổ chức và lọc.",
      customKey: "Key tùy chỉnh", customKeyHint: "Chỉ dùng chữ cái, số, dấu gạch dưới và gạch ngang. Tối thiểu 16 ký tự.",
      customKeyPlaceholder: "Nhập key tùy chỉnh (tối thiểu 16 ký tự)",
      ipRestrict: "Giới hạn IP",
      ipWhitelist: "Danh sách trắng IP", ipWhitelistHint: "Mỗi IP hoặc CIDR một dòng. Chỉ IP này mới dùng được.",
      ipBlacklist: "Danh sách đen IP", ipBlacklistHint: "Mỗi IP hoặc CIDR một dòng. Các IP này sẽ bị chặn.",
      quota: "Hạn mức chi tiêu", quotaPlaceholder: "Nhập hạn mức theo USD", quotaHint: "Số tiền tối đa key này được tiêu. 0 = không giới hạn.",
      rateLimit: "Giới hạn tốc độ", rateLimitHint: "Giới hạn chi tiêu trong từng khung thời gian. 0 = không giới hạn.",
      limit5h: "Giới hạn 5 giờ (USD)", limitDaily: "Giới hạn hàng ngày (USD)", limit7d: "Giới hạn 7 ngày (USD)",
      expiration: "Hết hạn", expiresDate: "Ngày hết hạn", expiresHint: "Chọn thời điểm khóa API này hết hạn.",
      custom: "Tùy chọn", days: "ngày",
      cancel: "Hủy", creating: "Đang tạo...", create: "Tạo",
    },
    useModal: {
      title: "Dùng Khóa API — Codex CLI",
      desc: "Cấu hình Codex CLI để gọi qua gateway này. Làm tuần tự theo từng bước bên dưới.",
      warn: "Đảm bảo nội dung config.toml nằm ngay đầu file. Các entry cũ trùng key sẽ gây xung đột.",
      missingKey: "Full API key chỉ hiển thị một lần khi tạo. Server không lưu plaintext nữa. Thay <your-api-key> bằng key bạn đã copy, hoặc tạo key mới.",
      close: "Đóng",
      step1Title: "1. Cài Codex CLI",
      step1Desc: "Bỏ qua nếu đã cài. Yêu cầu Node.js 18+.",
      step2Title: "2. Tạo thư mục config",
      step2Desc: "Codex đọc cấu hình từ thư mục này.",
      step3Title: "3. Thêm file config.toml",
      step3Desc: "Chọn model và trỏ Codex tới gateway này làm upstream.",
      step4Title: "4. Thêm file auth.json",
      step4Desc: "Codex đọc OPENAI_API_KEY ở đây. Dùng key gateway (sk-gw-…), không phải key OpenAI.",
      step5Title: "5. Chạy Codex",
      step5Desc: "Chạy trong thư mục dự án bất kỳ.",
      step6Title: "6. Kiểm tra",
      step6Desc: "Gửi thử một prompt. Usage sẽ hiện ở Dashboard → Lịch sử dùng và credit bị trừ vào số dư.",
      tipsTitle: "Mẹo",
      tip1: "Đổi model bằng cách sửa model = \"…\" trong config.toml. Danh sách đầy đủ ở /v1/models.",
      tip2: "Lỗi 401 → API key sai/bị thu hồi. Lỗi 402 → hết số dư hoặc gói đã dùng hết.",
      tip3: "Streaming và tool-calling hoạt động giống y như OpenAI API chính thức.",
    },
    common: { save: "Lưu", cancel: "Hủy", delete: "Xóa", edit: "Sửa", add: "Thêm", confirm: "Xác nhận", loading: "Đang tải...", copy: "Sao chép", copied: "Đã sao chép" },
    admin: {
      title: "Quản trị", overview: "Tổng quan quản trị",
      totalUsers: "Tổng người dùng", activeKeys: "Khóa hoạt động", totalRevenue: "Tổng doanh thu", pendingTopups: "Nạp tiền chờ duyệt",
      todayRevenue: "Doanh thu hôm nay", todayReqs: "Yêu cầu hôm nay",
      tabs: { dashboard: "Tổng quan", users: "Người dùng", topups: "Nạp tiền", redeem: "Mã đổi thưởng", tcdmx: "Nhà cung cấp", pricing: "Giá Model", plans: "Gói dịch vụ", payment: "Cấu hình thanh toán" },
      users: {
        title: "Người dùng", addBalance: "Thêm số dư cho người dùng",
        selectUser: "Chọn người dùng...", amount: "Số tiền USD",
        email: "Email", name: "Tên", balance: "Số dư", keys: "Khóa", requests: "Yêu cầu", role: "Vai trò", joined: "Ngày tham gia",
        delete: "Xóa", setRole: "Đặt vai trò", setLimit: "Đặt giới hạn",
        deleteConfirm: "Xóa người dùng này? Không thể hoàn tác.",
      },
      topups: {
        title: "Nạp tiền", pending: "Chờ duyệt", all: "Tất cả",
        user: "Người dùng", amount: "Số tiền", method: "Phương thức", date: "Ngày", proof: "Bằng chứng", note: "Ghi chú",
        approve: "Duyệt", reject: "Từ chối", noTopups: "Không có giao dịch nào",
      },
      redeem: {
        title: "Mã đổi thưởng", createNew: "Tạo mã mới",
        amount: "Số tiền (USD)", count: "Số lượng", note: "Ghi chú (tuỳ chọn)",
        generating: "Đang tạo...", generate: "Tạo mã",
        code: "Mã", usedBy: "Dùng bởi", usedAt: "Thời gian dùng", created: "Ngày tạo",
        unused: "Chưa dùng", used: "Đã dùng", del: "Xóa",
      },
      tcdmx: {
        title: "Nhà cung cấp", addKey: "Thêm khóa nhà cung cấp",
        keyPlaceholder: "API Key", labelPlaceholder: "Nhãn (tùy chọn)",
        adding: "Đang thêm...", add: "Thêm khóa",
        totalKeys: "Tổng khóa", activeKeys: "Đang hoạt động", rateLimited: "Bị giới hạn", errorKeys: "Lỗi",
        key: "Khóa", label: "Nhãn", provider: "Nhà cung cấp", status: "Trạng thái", errors: "Lỗi", lastUsed: "Dùng lần cuối", actions: "Thao tác",
        active: "Hoạt động", disabled: "Vô hiệu", rateLim: "Giới hạn tốc độ",
        reset: "Đặt lại", enable: "Bật", disable: "Tắt",
      },
      pricing: {
        title: "Giá Model", saveAll: "Lưu tất cả",
        globalSettings: "Cài đặt chung", markup: "Hệ số giá (VD: 1.3 = +30%)", concurrency: "Đồng thời mặc định (yêu cầu)",
        addModel: "Thêm model mới", modelId: "Model ID (VD: gpt-4o)", inputPer1m: "Đầu vào $/1M", outputPer1m: "Đầu ra $/1M",
        model: "Model", input: "Đầu vào $/1M", output: "Đầu ra $/1M", enabled: "Bật", action: "Thao tác",
      },
      plans: {
        title: "Gói dịch vụ", addPlan: "Thêm gói", editPlan: "Sửa gói",
        planName: "Tên gói", price: "Giá (USD)", duration: "Thời hạn (ngày)", dailyLimit: "Hạn mức ngày (USD/ngày)", description: "Mô tả",
        features: "Tính năng (mỗi dòng một tính năng)", enabledLabel: "Bật", sortOrder: "Thứ tự",
        saving: "Đang lưu...", save: "Lưu gói", cancel: "Hủy",
        name: "Tên", monthly: "Hàng tháng", actions: "Thao tác", edit: "Sửa", del: "Xóa", noPlans: "Chưa có gói nào.",
      },
      backToDash: "Quay lại Dashboard",
      payment: {
        title: "Cấu hình thanh toán", subtitle: "Cài đặt thông tin thanh toán hiển thị cho người dùng",
        bankSection: "Chuyển khoản ngân hàng", bankName: "Tên ngân hàng", bankAccount: "Số tài khoản",
        bankHolder: "Chủ tài khoản", bankContent: "Nội dung chuyển khoản",
        bankContentHint: "VD: NAPTIEN — người dùng sẽ thêm email của họ",
        usdtSection: "USDT (Tiền mã hóa)", usdtTrc20: "Địa chỉ ví TRC20", usdtErc20: "Địa chỉ ví ERC20",
        usdtRate: "Tỷ giá (USDT/USD)", usdtRateHint: "VD: 1 nghĩa là 1 USDT = 1 USD",
        web2mSection: "Web2M", web2mInfo: "Hướng dẫn thanh toán Web2M",
        save: "Lưu cấu hình", saving: "Đang lưu...", saved: "Đã lưu!",
      },
    },
    profile: {
      title: "Cài đặt hồ sơ", subtitle: "Quản lý thông tin tài khoản của bạn",
      balance: "Số dư tài khoản", concurrency: "Giới hạn đồng thời", member: "Thành viên từ",
      avatarTitle: "Hồ sơ & Ảnh đại diện", avatarSub: "Cập nhật tên và ảnh đại diện.",
      avatarLabel: "Ảnh đại diện", avatarHint: "Chữ cái tự động từ email",
      uploadImage: "Tải ảnh lên",
      editProfile: "Chỉnh sửa hồ sơ", displayName: "Tên hiển thị", update: "Cập nhật hồ sơ",
      signInMethods: "Phương thức đăng nhập",
      email: "Email", bound: "Đã liên kết", manageEmail: "Quản lý email",
      emailPrimary: "Email chính được quản lý trong form hồ sơ.",
      changePassword: "Đổi mật khẩu", currentPw: "Mật khẩu hiện tại", newPw: "Mật khẩu mới", confirmPw: "Xác nhận mật khẩu mới", updatePw: "Cập nhật mật khẩu",
      dangerZone: "Vùng nguy hiểm", deleteAccount: "Xóa tài khoản", deleteHint: "Sau khi xóa, tài khoản và toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.",
      deleteBtn: "Xóa tài khoản của tôi",
    },
    billing: {
      title: "Nạp tiền", subtitle: "Thêm số dư vào tài khoản",
      method: "Phương thức thanh toán", bank: "Chuyển khoản ngân hàng", usdt: "USDT (Tiền mã hóa)",
      amount: "Số tiền (VND)", note: "Nội dung chuyển khoản", bankName: "Ngân hàng", account: "Số tài khoản", holder: "Chủ tài khoản",
      steps: "Các bước chuyển khoản", step1: "Chuyển đúng số tiền với đúng nội dung",
      step2: "Số dư được cộng trong vòng 5–30 phút sau khi xác nhận",
      wallet: "Địa chỉ ví", network: "Mạng lưới",
      usdtNote: "Gửi đúng số tiền. Dùng đúng mạng để tránh mất tiền.",
      history: "Lịch sử nạp tiền", pending: "Chờ duyệt", completed: "Hoàn thành", failed: "Thất bại",
      date: "Ngày", method2: "Phương thức",
    },
    usage: {
      title: "Lịch sử dùng", subtitle: "Lịch sử chi tiết các lệnh gọi API",
      filter: "Lọc", allModels: "Tất cả model", last7: "7 ngày qua", last30: "30 ngày qua", allTime: "Toàn bộ",
      model: "Model", tokens: "Token", cost: "Chi phí", time: "Thời gian", noData: "Chưa có dữ liệu sử dụng.",
      inputT: "Đầu vào", outputT: "Đầu ra",
    },
    redeem: {
      title: "Đổi mã", subtitle: "Nhập mã để cộng số dư",
      placeholder: "Nhập mã đổi thưởng...", btn: "Đổi",
      success: "Đổi mã thành công!", history: "Lịch sử đổi mã",
      code: "Mã", amount: "Số tiền", date: "Ngày", noHistory: "Chưa có lịch sử.",
    },
  },
} as const;

export type Translations = typeof T.en;
type LangContextType = { lang: Lang; setLang: (l: Lang) => void; t: Translations };

const LangContext = createContext<LangContextType>({ lang: "vi", setLang: () => {}, t: T.vi as unknown as Translations });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "vi") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("lang", l);
  }

  return <LangContext.Provider value={{ lang, setLang, t: T[lang] as unknown as Translations }}>{children}</LangContext.Provider>;
}

export function useLang() { return useContext(LangContext); }

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex items-center bg-gray-800/60 border border-gray-700 rounded-lg p-0.5 ${className}`}>
      <button onClick={() => setLang("en")}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lang === "en" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"}`}>
        EN
      </button>
      <button onClick={() => setLang("vi")}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lang === "vi" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"}`}>
        VI
      </button>
    </div>
  );
}
