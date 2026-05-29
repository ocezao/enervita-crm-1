export type AuthUser = {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  roles?: string[];
  role?: string;
  permissions: string[];
  allowedStages: string[];
};

export type LoginResponse = {
  user: AuthUser;
};
