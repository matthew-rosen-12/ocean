NPC states

    on local

        IDLE
            set npc position to positionRef
            collission -> CAPTURED
                update local npc phase
                send api request with updated npc to server

        CAPTURED
            do NOT set npc position to positionRef
            spacebar -> THROWN
                update local npc position to last position Ref
                update local npc phase
                send api request with updated npc to server

        THROWN
            do NOT set npc position to positionRef
            server message -> IDLE
                update local npc to server npc

    on server

        IDLE
            client request -> CAPTURED
                update npc phase to CAPTURED
                update npc position to client npc position
                update npc group
                send message to clients with updated npc
                send message to clients with updated npc group

        CAPTURED
            client request -> THROWN
                update npc phase to THROWN
                update npc position to client npc position
                update npc group
                update throws
                send message to clients with updated npc
                send message to clients with updated npc group
                send message to client with updated throws

        THROWN
            server calculation -> IDLE
                update npc phase to IDLE
                update npc position to calculated position
                update throws
                send message to clients with updated npc
                send message to client with updated throws
