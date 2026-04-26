import { randomBytes } from 'crypto';
import { Trip } from './trip.entity';
import { TripRepository } from './trip.repository';

function generateInviteCode(): string {
  return randomBytes(6).toString('hex').toUpperCase();
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

  async getMyTrips(userId: string): Promise<Trip[]> {
    return this.repo.findByUserId(userId);
  }

  async getTripById(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) throw new Error('NOT_FOUND');

    const isMember = trip.members.some((m) => m.userId === userId);
    if (!isMember) throw new Error('FORBIDDEN');

    return trip;
  }

  async updateTrip(tripId: string, dto: UpdateTripDto, userId: string): Promise<Trip> {
    const trip = await this.getTripById(tripId, userId);
    const member = trip.members.find((m) => m.userId === userId);
    if (!['Owner', 'Editor'].includes(member?.role ?? '')) throw new Error('FORBIDDEN');

    return this.repo.update(tripId, dto);
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
