import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from './modules/users/user.entity';
import { Trip } from './modules/trips/trip.entity';
import { Itinerary } from './modules/itinerary/itinerary.entity';
import { Expense } from './modules/expenses/expense.entity';
import { Task } from './modules/tasks/task.entity';
import { Attachment } from './modules/attachments/attachment.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Trip, Itinerary, Expense, Task, Attachment],
  migrations: ['src/migrations/*.ts'],
});
