import { randomBytes } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { User } from '../users/user.entity';
import { Trip, TripMember, CollaboratorPermissions, DEFAULT_COLLABORATOR_PERMISSIONS } from './trip.entity';
import { TripRepository, ListOpts } from './trip.repository';

function generateInviteCode(): string {
  return randomBytes(6).toString('hex').toUpperCase();
}

export interface HydratedMember extends TripMember {
  name: string;
  email: string;
  avatar: string | null;
}

export interface HydratedTrip extends Omit<Trip, 'members'> {
  members: HydratedMember[];
}

export interface TripPreview {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  ownerName: string;
  memberCount: number;
}

async function hydrateMembers(trip: Trip): Promise<HydratedTrip> {
  const ids = trip.members.map((m) => m.userId);
  if (ids.length === 0) return { ...trip, members: [] };
  const users = await AppDataSource.getRepository(User).find({
    where: { id: In(ids) },
    select: ['id', 'name', 'email', 'avatar'],
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return {
    ...trip,
    members: trip.members.map((m) => {
      const u = userMap.get(m.userId);
      return {
        ...m,
        name: u?.name || u?.email?.split('@')[0] || 'Unknown',
        email: u?.email ?? '',
        avatar: u?.avatar ?? null,
      };
    }),
  };
}

interface CreateTripDto {
  title: string;
  startDate?: string;
  endDate?: string;
  coverImage?: string;
}

interface UpdateTripDto {
  title?: string;
  startDate?: string;
  endDate?: string;
  coverImage?: string;
  collaboratorPermissions?: CollaboratorPermissions;
}

export class TripService {
  constructor(private repo: TripRepository) {}

  async createTrip(dto: CreateTripDto, userId: string): Promise<Trip> {
    return this.repo.create({
      ...dto,
      inviteCode: generateInviteCode(),
      members: [{ userId, role: 'Owner' }],
    });
  }

  async getMyTrips(userId: string): Promise<HydratedTrip[]> {
    const trips = await this.repo.findByUserId(userId);
    return Promise.all(trips.map((t) => hydrateMembers(t)));
  }

  async getMyTripsPaginated(
    userId: string,
    opts: ListOpts,
  ): Promise<{
    items: HydratedTrip[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Math.floor(opts.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(opts.pageSize) || 10));

    const [trips, total] = await this.repo.findByUserIdPaginated(userId, { ...opts, page, pageSize });
    const items = await Promise.all(trips.map((t) => hydrateMembers(t)));
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

    return { items, total, page, pageSize, totalPages };
  }

  async getTripById(tripId: string, userId: string): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const isMember = trip.members.some((m) => m.userId === userId);
    if (!isMember) throw new Error('FORBIDDEN');

    return hydrateMembers(trip);
  }

  async updateTrip(tripId: string, dto: UpdateTripDto, userId: string): Promise<HydratedTrip> {
    const trip = await this.getTripById(tripId, userId);
    const member = trip.members.find((m) => m.userId === userId);
    if (!['Owner', 'Editor'].includes(member?.role ?? '')) throw new Error('FORBIDDEN');

    const updated = await this.repo.update(tripId, dto);
    return hydrateMembers(updated);
  }

  async setEnabledModules(
    tripId: string,
    patch: Partial<{ tasks: boolean; expenses: boolean; checklists: boolean }>,
  ): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    const merged = { ...trip.enabledModules, ...patch };
    const updated = await this.repo.update(tripId, { enabledModules: merged });
    return hydrateMembers(updated);
  }

  async setCollaboratorPermissions(
    tripId: string,
    patch: Partial<CollaboratorPermissions>,
  ): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    const current = trip.collaboratorPermissions ?? DEFAULT_COLLABORATOR_PERMISSIONS;
    const merged = { ...current, ...patch };
    const updated = await this.repo.update(tripId, { collaboratorPermissions: merged });
    return hydrateMembers(updated);
  }

  async joinByInviteCode(code: string, userId: string): Promise<Trip> {
    const trip = await this.repo.findByInviteCode(code);
    if (!trip) throw new Error('NOT_FOUND');

    const alreadyMember = trip.members.some((m) => m.userId === userId);
    if (alreadyMember) return trip;

    const updatedMembers = [...trip.members, { userId, role: 'Editor' as const }];
    return this.repo.update(trip.id, { members: updatedMembers });
  }

  async removeMember(tripId: string, targetUserId: string): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const target = trip.members.find((m) => m.userId === targetUserId);
    if (!target) throw new Error('NOT_MEMBER');
    if (target.role === 'Owner') throw new Error('CANNOT_KICK_OWNER');

    const updatedMembers = trip.members.filter((m) => m.userId !== targetUserId);
    const updated = await this.repo.update(tripId, { members: updatedMembers });
    return hydrateMembers(updated);
  }

  async leaveTrip(tripId: string, userId: string): Promise<void> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const member = trip.members.find((m) => m.userId === userId);
    if (!member) throw new Error('NOT_MEMBER');
    if (member.role === 'Owner') throw new Error('CANNOT_LEAVE_AS_OWNER');

    const updatedMembers = trip.members.filter((m) => m.userId !== userId);
    await this.repo.update(tripId, { members: updatedMembers });
  }

  async getTripPreviewByCode(code: string): Promise<TripPreview> {
    const trip = await this.repo.findByInviteCode(code);
    if (!trip) throw new Error('NOT_FOUND');
    return this._buildPreview(trip);
  }

  async getTripPreviewById(tripId: string): Promise<TripPreview> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');
    return this._buildPreview(trip);
  }

  async joinByTripId(tripId: string, userId: string): Promise<HydratedTrip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const alreadyMember = trip.members.some((m) => m.userId === userId);
    if (alreadyMember) return hydrateMembers(trip);

    const updatedMembers = [...trip.members, { userId, role: 'Editor' as const }];
    const updated = await this.repo.update(tripId, { members: updatedMembers });
    return hydrateMembers(updated);
  }

  private async _buildPreview(trip: Trip): Promise<TripPreview> {
    const ownerMember = trip.members.find((m) => m.role === 'Owner');
    let ownerName = '未知';
    if (ownerMember) {
      const users = await AppDataSource.getRepository(User).find({
        where: { id: ownerMember.userId },
        select: ['name', 'email'],
      });
      const owner = users[0];
      ownerName = owner?.name || owner?.email?.split('@')[0] || '未知';
    }
    return {
      id: trip.id,
      title: trip.title,
      startDate: trip.startDate ?? undefined,
      endDate: trip.endDate ?? undefined,
      ownerName,
      memberCount: trip.members.length,
    };
  }
}
