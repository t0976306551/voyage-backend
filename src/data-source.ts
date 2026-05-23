import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from './modules/users/user.entity';
import { Trip } from './modules/trips/trip.entity';
import { Itinerary } from './modules/itinerary/itinerary.entity';
import { Expense } from './modules/expenses/expense.entity';
import { Task } from './modules/tasks/task.entity';
import { Attachment } from './modules/attachments/attachment.entity';
import { ChecklistItem } from './modules/checklists/checklist-item.entity';
import { ChecklistAssignment } from './modules/checklists/checklist-assignment.entity';
import { TripInvitation } from './modules/invitations/invitation.entity';
import { InvitationHistory } from './modules/invitation-history/invitation-history.entity';
import { PersonalMemo } from './modules/personal/personal-memo.entity';
import { PersonalMemoItem } from './modules/personal/personal-memo-item.entity';
import { PersonalExpense } from './modules/personal/personal-expense.entity';
import { PersonalSettings } from './modules/personal/personal-settings.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'voyagestack',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Trip, Itinerary, Expense, Task, Attachment, ChecklistItem, ChecklistAssignment, TripInvitation, InvitationHistory, PersonalMemo, PersonalMemoItem, PersonalExpense, PersonalSettings],
  migrations: ['src/migrations/*.ts'],
});
