import { createInteraction, NPCInteraction } from "shared/interaction-prompts";
import { PathPhase, NPCGroup, roomId, userId } from "shared/types";
import { emitToUser } from "../typed-socket";
import { getAllUsersInRoom } from "../state/users";

/**
 * Service for generating and sending NPC interactions to users
 */
export class InteractionService {
  
  /**
   * Handle interaction when a user's thrown/returning NPC captures another NPC
   */
  static handleReturningNPCRecaptured(
    room: roomId,
    captorUserId: userId,
    userNPCGroup: NPCGroup,
    capturedNPCGroup: NPCGroup,
    pathPhase: PathPhase
  ): void {
    if (pathPhase !== PathPhase.THROWN && pathPhase !== PathPhase.RETURNING) {
      return; // Only for thrown/returning NPCs
    }

    // Get user's animal type
    const allUsers = getAllUsersInRoom(room);
    const user = Array.from(allUsers.values()).find(u => u.id === captorUserId);
    if (!user) return;

    // Create interaction for the user's NPC face talking about capturing the other NPC
    if (userNPCGroup.faceFileName && capturedNPCGroup.faceFileName) {
      const interaction = createInteraction.recaptured(
        userNPCGroup.faceFileName,
        capturedNPCGroup.faceFileName,
        user.animal
      );
      
      console.log(`Sending RETURNING_NPC_GROUP_RECAPTURED interaction to user ${captorUserId}:`, {
        userNpc: userNPCGroup.faceFileName,
        capturedNpc: capturedNPCGroup.faceFileName,
        pathPhase
      });
      
      this.sendInteractionToUser(room, captorUserId, interaction);
    }
  }

  /**
   * Handle interaction when a user's thrown NPC collides with another user's captured NPC, causing emission
   */
  static handleThrownNPCCollision(
    room: roomId,
    throwerUserId: userId,
    thrownNPCGroup: NPCGroup,
    emittedNPCGroup: NPCGroup
  ): void {
    // Get thrower's animal type
    const allUsers = getAllUsersInRoom(room);
    const thrower = Array.from(allUsers.values()).find(u => u.id === throwerUserId);
    if (!thrower) return;

    // Create interaction for the thrower's NPC face talking about the collision
    if (thrownNPCGroup.faceFileName && emittedNPCGroup.faceFileName) {
      const interaction = createInteraction.thrownCollision(
        thrownNPCGroup.faceFileName,
        emittedNPCGroup.faceFileName,
        thrower.animal
      );
      
      console.log(`Sending THROWN_NPC_GROUP_COLLISION interaction to user ${throwerUserId}:`, {
        thrownNpc: thrownNPCGroup.faceFileName,
        emittedNpc: emittedNPCGroup.faceFileName
      });
      
      this.sendInteractionToUser(room, throwerUserId, interaction);
    }
  }

  /**
   * Handle interaction when a user's captured NPC gets emitted (liberated by collision)
   */
  static handleNPCGroupEmitted(
    room: roomId,
    capturedGroupOwnerUserId: userId,
    emittedNPCGroup: NPCGroup,
    liberatorNPCGroup: NPCGroup
  ): void {
    // Get captured group owner's animal type
    const allUsers = getAllUsersInRoom(room);
    const capturedGroupOwner = Array.from(allUsers.values()).find(u => u.id === capturedGroupOwnerUserId);
    if (!capturedGroupOwner) return;

    // Create interaction for the emitted NPC talking about being liberated
    if (emittedNPCGroup.faceFileName && liberatorNPCGroup.faceFileName) {
      const interaction = createInteraction.emitted(
        emittedNPCGroup.faceFileName,
        liberatorNPCGroup.faceFileName,
        capturedGroupOwner.animal
      );
      
      console.log(`Sending NPC_GROUP_EMITTED interaction to user ${capturedGroupOwnerUserId}:`, {
        emittedNpc: emittedNPCGroup.faceFileName,
        liberatorNpc: liberatorNPCGroup.faceFileName
      });
      
      this.sendInteractionToUser(room, capturedGroupOwnerUserId, interaction);
    }
  }

  /**
   * Handle interaction when a user's thrown/returning NPC gets deleted (goes up in smoke)
   */
  static handleNPCGroupDeleted(
    room: roomId,
    captorUserId: userId,
    npcGroup: NPCGroup,
    pathPhase: PathPhase
  ): void {
    if (pathPhase !== PathPhase.THROWN && pathPhase !== PathPhase.RETURNING) {
      return; // Only for thrown/returning NPCs
    }

    // Get user's animal type
    const allUsers = getAllUsersInRoom(room);
    const user = Array.from(allUsers.values()).find(u => u.id === captorUserId);
    if (!user || !npcGroup.faceFileName) return;

    const interaction = createInteraction.deleted(npcGroup.faceFileName, user.animal);
    
    console.log(`Sending NPC_GROUP_DELETED interaction to user ${captorUserId}:`, {
      npcFace: npcGroup.faceFileName,
      pathPhase
    });
    
    this.sendInteractionToUser(room, captorUserId, interaction);
  }

  /**
   * Send an interaction to a specific user via socket
   */
  private static sendInteractionToUser(room: roomId, userId: userId, interaction: NPCInteraction): void {
    emitToUser(room, userId, "npc-interaction", { interaction });
  }
}