import type { RoomState } from "../shared/types.js";

const rooms = new Map<string, RoomState>();

export function getRoom(code: string): RoomState | undefined {
  return rooms.get(code.toUpperCase());
}

export function setRoom(room: RoomState): void {
  rooms.set(room.code.toUpperCase(), room);
}

export function deleteRoom(code: string): void {
  rooms.delete(code.toUpperCase());
}

export function getAllRooms(): RoomState[] {
  return [...rooms.values()];
}

export function findRoomByCode(code: string): RoomState | undefined {
  return rooms.get(code.toUpperCase());
}
