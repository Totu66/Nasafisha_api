export const ROLES = {
  CITIZEN: 'citizen',
  FIELD_CREW: 'field_crew',
  FIELD_SUPERVISOR: 'field_supervisor',
  OPERATIONS_MANAGER: 'operations_manager',
  EXECUTIVE: 'executive',
  COUNTY_ICT_ADMIN: 'county_ict_admin',
  CONTRACTOR: 'contractor',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_KEY = 'allowed_roles';
