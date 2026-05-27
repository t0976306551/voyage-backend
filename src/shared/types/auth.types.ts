import type { CollaboratorPermissions, TripRole } from '../../modules/trips/trip.entity';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tripRole?: TripRole;
      collaboratorPermissions?: CollaboratorPermissions;
    }
  }
}
