export type MemberRole = 'owner' | 'vendedor';

export interface JwtPayload {
  sub: string; // person_id
  standId: string;
  schemaName: string;
  role: MemberRole;
  nome: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
