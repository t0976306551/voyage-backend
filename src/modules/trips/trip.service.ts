import { randomBytes } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { User } from '../users/user.entity';
import { Trip, TripMember } from './trip.entity';
import { TripRepository } from './trip.repository';

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

  async joinByInviteCode(code: string, userId: string): Promise<Trip> {
    const trip = await this.repo.findByInviteCode(code);
    if (!trip) throw new Error('NOT_FOUND');

    const alreadyMember = trip.members.some((m) => m.userId === userId);
    if (alreadyMember) return trip;

    const updatedMembers = [...trip.members, { userId, role: 'Viewer' as const }];
    return this.repo.update(trip.id, { members: updatedMembers });
  }
}
