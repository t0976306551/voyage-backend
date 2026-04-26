import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../../data-source';
import { Trip, TripRole } from '../../modules/trips/trip.entity';
import { fail } from '../types/response.types';

export function requireTripRole(...roles: TripRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tripId = req.params['tripId'] as string;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json(fail('UNAUTHORIZED', 'Not authenticated'));
      return;
    }

    const tripRepo = AppDataSource.getRepository(Trip);
    const trip = await tripRepo.findOne({ where: { id: tripId } });

    if (!trip) {
      res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
      return;
    }

    const member = trip.members.find((m) => m.userId === userId);

    if (!member || !roles.includes(member.role)) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }

    next();
  };
}
