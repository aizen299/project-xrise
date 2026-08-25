import { Types } from 'mongoose';
import { User } from '../db/models';
import type { UserRole } from '../../types';

export interface AssignableAgent {
  id: string;
  name: string;
  role: UserRole;
}

export async function listAssignableAgents(): Promise<AssignableAgent[]> {
  const agents = await User.find({}, { name: 1, role: 1 })
    .sort({ name: 1 })
    .lean<{ _id: Types.ObjectId; name: string; role: UserRole }[]>();

  return agents.map((agent) => ({
    id: agent._id.toString(),
    name: agent.name,
    role: agent.role,
  }));
}
