import { DioramaPoint, MiniRailSidingBay } from './MiniRailDioramaLayouts';

export interface VehicleParkingSlotState {
  vehicleId: number;
  bayId: string;
  slotIndex: number;
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  isAdvancing: boolean;
  advanceProgress: number; // 0.0 to 1.0
  advanceDurationMs: number;
}

/**
 * MiniRailParkingController
 * Manages physical parking slot assignments, FIFO queue order, and smooth visual
 * advance animations between slots. Decoupled from simulation logic.
 */
export class MiniRailParkingController {
  private bays: Map<string, MiniRailSidingBay> = new Map();
  private vehicleSlots: Map<number, VehicleParkingSlotState> = new Map();
  private departureOrigins: Map<number, DioramaPoint> = new Map();
  private advanceDurationMs: number;

  constructor(sidingBays: MiniRailSidingBay[], options?: { advanceDurationMs?: number }) {
    for (const bay of sidingBays) {
      this.bays.set(bay.id, bay);
    }
    this.advanceDurationMs = options?.advanceDurationMs ?? 400; // 400ms smooth visual slide
  }

  /**
   * Assigns a vehicle to the next free slot in the specified siding bay.
   * If vehicle is already assigned, returns existing state.
   */
  public parkVehicle(vehicleId: number, bayId: string): VehicleParkingSlotState {
    const existing = this.vehicleSlots.get(vehicleId);
    if (existing && existing.bayId === bayId) {
      return existing;
    }

    const bay = this.bays.get(bayId);
    if (!bay) {
      throw new Error(`[MiniRailParkingController] Siding bay '${bayId}' not found.`);
    }

    // Determine occupied slot indices in this bay
    const occupiedSlots = new Set<number>();
    for (const state of this.vehicleSlots.values()) {
      if (state.bayId === bayId) {
        occupiedSlots.add(state.slotIndex);
      }
    }

    // Find lowest available slot index
    let slotIndex = 0;
    while (occupiedSlots.has(slotIndex) && slotIndex < bay.capacity) {
      slotIndex++;
    }

    if (slotIndex >= bay.capacity) {
      throw new Error(
        `[MiniRailParkingController] Siding bay '${bayId}' capacity exceeded (capacity: ${bay.capacity}). Cannot park vehicle ${vehicleId}.`
      );
    }

    const slotPos = bay.slots[slotIndex] ?? bay.slots[0] ?? { x: bay.x, y: bay.y };
    const state: VehicleParkingSlotState = {
      vehicleId,
      bayId,
      slotIndex,
      currentX: slotPos.x,
      currentY: slotPos.y,
      startX: slotPos.x,
      startY: slotPos.y,
      targetX: slotPos.x,
      targetY: slotPos.y,
      isAdvancing: false,
      advanceProgress: 1.0,
      advanceDurationMs: this.advanceDurationMs,
    };

    this.vehicleSlots.set(vehicleId, state);
    return state;
  }

  /**
   * Checks if a vehicle is currently eligible for release from the siding.
   * Logical rule: Vehicle must be at the lead slot (slotIndex === 0) and not currently mid-advance.
   */
  public canReleaseVehicle(vehicleId: number): boolean {
    const state = this.vehicleSlots.get(vehicleId);
    if (!state) return false;
    if (state.isAdvancing) return false;
    if (state.slotIndex !== 0) return false;
    return true;
  }

  /**
   * Called when a vehicle leaves parking and transitions to MOVING.
   * Returns the exact coordinate the vehicle was visually at when departing.
   * Promotes upstream parked vehicles in the FIFO queue to smoothly advance forward.
   * Throws an error if release is attempted while advancing or not at lead slot.
   */
  public releaseVehicle(vehicleId: number): DioramaPoint | undefined {
    const state = this.vehicleSlots.get(vehicleId);
    if (!state) {
      return this.departureOrigins.get(vehicleId);
    }

    if (state.isAdvancing) {
      throw new Error(
        `[MiniRailParkingController] Vehicle ${vehicleId} cannot depart while advancing between slots (${Math.round(state.advanceProgress * 100)}% complete).`
      );
    }
    if (state.slotIndex !== 0) {
      throw new Error(
        `[MiniRailParkingController] Vehicle ${vehicleId} is at non-lead slot ${state.slotIndex}. In FIFO siding, only the lead vehicle (slot 0) can depart.`
      );
    }

    const departureOrigin: DioramaPoint = {
      x: state.currentX,
      y: state.currentY,
    };
    this.departureOrigins.set(vehicleId, departureOrigin);

    const vacatedBayId = state.bayId;
    const vacatedSlotIndex = state.slotIndex;
    this.vehicleSlots.delete(vehicleId);

    // Promote remaining vehicles in this bay that are behind the vacated slot
    const bay = this.bays.get(vacatedBayId);
    if (bay) {
      const remaining = Array.from(this.vehicleSlots.values())
        .filter((s) => s.bayId === vacatedBayId && s.slotIndex > vacatedSlotIndex)
        .sort((a, b) => a.slotIndex - b.slotIndex);

      for (const rem of remaining) {
        rem.slotIndex = rem.slotIndex - 1;
        const target = bay.slots[rem.slotIndex] ?? bay.slots[0];
        rem.startX = rem.currentX;
        rem.startY = rem.currentY;
        rem.targetX = target.x;
        rem.targetY = target.y;
        rem.isAdvancing = true;
        rem.advanceProgress = 0.0;
      }
    }

    return departureOrigin;
  }

  /**
   * Updates smooth visual transitions for vehicles advancing between slots.
   * Strictly visual: does not affect simulation or gameplay logic.
   */
  public update(deltaMs: number): void {
    if (deltaMs <= 0) return;

    for (const state of this.vehicleSlots.values()) {
      if (state.isAdvancing) {
        state.advanceProgress += deltaMs / state.advanceDurationMs;
        if (state.advanceProgress >= 1.0) {
          state.advanceProgress = 1.0;
          state.isAdvancing = false;
          state.currentX = state.targetX;
          state.currentY = state.targetY;
        } else {
          // Smooth ease-out quad
          const t = state.advanceProgress;
          const ease = t * (2 - t);
          state.currentX = state.startX + (state.targetX - state.startX) * ease;
          state.currentY = state.startY + (state.targetY - state.startY) * ease;
        }
      }
    }
  }

  /**
   * Gets the current visual coordinates of a parked vehicle.
   */
  public getVehiclePosition(vehicleId: number): DioramaPoint | undefined {
    const state = this.vehicleSlots.get(vehicleId);
    if (state) {
      return { x: state.currentX, y: state.currentY };
    }
    return this.departureOrigins.get(vehicleId);
  }

  /**
   * Gets the departure origin of a vehicle that is currently MOVING away from parking.
   */
  public getDepartureOrigin(vehicleId: number): DioramaPoint | undefined {
    return this.departureOrigins.get(vehicleId);
  }

  /**
   * Clears departure origin once vehicle finishes moving or arrives at next node.
   */
  public clearDepartureOrigin(vehicleId: number): void {
    this.departureOrigins.delete(vehicleId);
  }

  /**
   * Gets the slot index currently assigned to a vehicle.
   */
  public getVehicleSlotIndex(vehicleId: number): number | undefined {
    return this.vehicleSlots.get(vehicleId)?.slotIndex;
  }

  /**
   * Resets all parking slot allocations and departures.
   */
  public reset(): void {
    this.vehicleSlots.clear();
    this.departureOrigins.clear();
  }
}
