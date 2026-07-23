import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '../types/jwt-payload.interface';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
