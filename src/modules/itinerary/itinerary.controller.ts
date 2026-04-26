import { Request, Response } from 'express';
import { ItineraryService } from './itinerary.service';
import { ItineraryRepository } from './itinerary.repository';
import { ok, fail } from '../../shared/types/response.types';

const service = new ItineraryService(new ItineraryRepository());

export async function getItinerary(req: Request, res: Response): Promise<void> {
  try {
    const items = await service.getItemsByTrip(req.params['tripId'] as string);
    res.json(ok(items));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function createItem(req: Request, res: Response): Promise<void> {
  try {
    const item = await service.createItem({
      ...(req.body as Omit<Parameters<typeof service.createItem>[0], 'tripId'>),
      tripId: req.params['tripId'] as string,
    });
    res.status(201).json(ok(item));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  try {
    const item = await service.updateItem(
      req.params['itemId'] as string,
      req.body as Record<string, unknown>,
    );
    res.json(ok(item));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function deleteItem(req: Request, res: Response): Promise<void> {
  try {
    await service.deleteItem(req.params['itemId'] as string);
    res.json(ok(null));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}

export async function reorderItems(req: Request, res: Response): Promise<void> {
  try {
    const { day, items } = req.body as { day: number; items: { id: string; order: number }[] };
    await service.reorderItems(req.params['tripId'] as string, day, items);
    res.json(ok(null));
  } catch {
    res.status(500).json(fail('INTERNAL', 'Internal server error'));
  }
}
