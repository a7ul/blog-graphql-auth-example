export const RolePermissions = {
  anonymous: {
    permissions: [],
  },
  customer: {
    permissions: ["self:customer"],
  },
  employee: {
    permissions: ["customer:read", "customer:write", "notes:read"],
  },
  "employee-readonly": {
    permissions: ["customer:read"],
  },
  "roles-editor": {
    permissions: ["iam:write"],
  },
  "invoice-manager": {
    permissions: ["invoice:read", "invoice:write"],
  },
  "profile-service": {
    permissions: ["customer:read"],
  },
};
