import { createInteraction, NPCInteraction, interactionToPrompt } from "shared/interaction-prompts";
import { PathPhase, NPCGroup, roomId, userId } from "shared/types";
import { emitToUser } from "../typed-socket";
import { getAllUsersInRoom } from "../state/users";
import { aiChatService } from "./ai-chat-service";
import { AIResponse, AIResponseType } from "shared/interaction-types";

/**
 * Service for generating and sending NPC interactions to users
 */
export class InteractionService {
  // Track last interaction time per room to enforce rate limiting
  private static lastInteractionTimes: Map<roomId, number> = new Map();
  private static readonly INTERACTION_COOLDOWN = 10000; // 10 seconds
  
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
      
      this.sendInteractionToRoom(room, interaction);
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
      
      console.log(`Sending THROWN_NPC_GROUP_COLLISION interaction to room ${room}:`, {
        thrownNpc: thrownNPCGroup.faceFileName,
        emittedNpc: emittedNPCGroup.faceFileName
      });
      
      this.sendInteractionToRoom(room, interaction);
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
      
      console.log(`Sending NPC_GROUP_EMITTED interaction to room ${room}:`, {
        emittedNpc: emittedNPCGroup.faceFileName,
        liberatorNpc: liberatorNPCGroup.faceFileName
      });
      
      this.sendInteractionToRoom(room, interaction);
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
    
    console.log(`Sending NPC_GROUP_DELETED interaction to room ${room}:`, {
      npcFace: npcGroup.faceFileName,
      pathPhase
    });
    
    this.sendInteractionToRoom(room, interaction);
  }

  /**
   * Send an interaction to all users in the room via socket, with AI response
   */
  private static async sendInteractionToRoom(room: roomId, interaction: NPCInteraction): Promise<void> {
    const allUsers = getAllUsersInRoom(room);
    
    try {
      // Check rate limiting before making AI API call
      if (!this.canCreateInteraction(room)) {
        
        // Send interaction with structured rate limited response
        const rateLimitedResponse: AIResponse = {
          type: AIResponseType.RATE_LIMITED,
          message: "Rate limited - try again later",
          greeting: "Hi" // Default greeting for rate limited
        };
        
        for (const user of allUsers.values()) {
          emitToUser(room, user.id, "npc-interaction-with-response", { 
            interaction, 
            aiResponse: rateLimitedResponse
          });
        }
        return;
      }

      // Generate AI response using structured method
      const prompt = interactionToPrompt(interaction);
      
      // Get a user to determine animal type for error fallbacks
      const anyUser = Array.from(allUsers.values())[0];
      const aiResponse = await aiChatService.generateStructuredResponse(prompt, interaction, anyUser?.animal);
      
      // Send interaction + AI response to all users in the room
      for (const user of allUsers.values()) {
        emitToUser(room, user.id, "npc-interaction-with-response", { 
          interaction, 
          aiResponse 
        });
      }
    } catch (error) {
      console.error('Error generating AI response for interaction:', error);
      
      // Get a user to determine animal type for error fallbacks
      const anyUser = Array.from(allUsers.values())[0];
      const errorResponse: AIResponse = {
        type: AIResponseType.ERROR,
        message: "Error generating response",
        greeting: anyUser ? `Hi ${anyUser.animal}` : "Hi Unknown"
      };
      
      // Send interaction with structured error response as fallback
      for (const user of allUsers.values()) {
        emitToUser(room, user.id, "npc-interaction-with-response", { 
          interaction, 
          aiResponse: errorResponse
        });
      }
    }
  }

  /**
   * Check if interaction creation is allowed (rate limiting)
   */
  private static canCreateInteraction(room: roomId): boolean {
    const lastTime = this.lastInteractionTimes.get(room) || 0;
    const now = Date.now();
    
    if (now - lastTime < this.INTERACTION_COOLDOWN) {
      return false;
    }
    
    this.lastInteractionTimes.set(room, now);
    return true;
  }

  /**
   * Handle interaction when two NPC groups bounce off each other without capture
   */
  static handleNPCGroupsBounced(
    room: roomId,
    primaryNPCGroup: NPCGroup,
    secondaryNPCGroup: NPCGroup,
    primaryUserAnimal?: string
  ): void {
    if (primaryNPCGroup.faceFileName && secondaryNPCGroup.faceFileName) {
      const interaction = createInteraction.bounced(
        primaryNPCGroup.faceFileName,
        secondaryNPCGroup.faceFileName,
        primaryUserAnimal
      );
      
      console.log(`Sending NPC_GROUPS_BOUNCED interaction to room ${room}:`, {
        primaryNpc: primaryNPCGroup.faceFileName,
        secondaryNpc: secondaryNPCGroup.faceFileName
      });
      
      this.sendInteractionToRoom(room, interaction);
    }
  }

  /**
   * Handle interaction when an idle/fleeing NPC captures a thrown/returning NPC
   */
  static handleIdleNPCCapturedThrown(
    room: roomId,
    idleNPCGroup: NPCGroup,
    thrownNPCGroup: NPCGroup,
    pathPhase: PathPhase
  ): void {
    if (pathPhase !== PathPhase.THROWN && pathPhase !== PathPhase.RETURNING) {
      return; // Only for thrown/returning NPCs being captured
    }

    // Get the user who owns the idle NPC to get their animal type
    const allUsers = getAllUsersInRoom(room);
    const idleNpcOwner = Array.from(allUsers.values()).find(u => u.id === idleNPCGroup.captorId);
    
    if (idleNPCGroup.faceFileName && thrownNPCGroup.faceFileName) {
      const interaction = createInteraction.idleCapturedThrown(
        idleNPCGroup.faceFileName,
        thrownNPCGroup.faceFileName,
        idleNpcOwner?.animal
      );
      
      console.log(`Sending IDLE_NPC_CAPTURED_THROWN interaction to room ${room}:`, {
        idleNpc: idleNPCGroup.faceFileName,
        thrownNpc: thrownNPCGroup.faceFileName,
        pathPhase
      });
      
      this.sendInteractionToRoom(room, interaction);
    }
  }

  /**
   * Process client-detected interactions (e.g., from collision detection)
   */
  static async processClientDetectedInteraction(room: roomId, interaction: NPCInteraction): Promise<void> {
    
    
    // No rate limiting for client-detected interactions - rate limiting happens in sendInteractionToRoom for AI API calls
    await this.sendInteractionToRoom(room, interaction);
  }
}