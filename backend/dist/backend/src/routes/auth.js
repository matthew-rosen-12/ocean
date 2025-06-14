"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const types_1 = require("shared/types");
const user_info_1 = require("../user-info");
const rooms_1 = require("../state/rooms");
const router = express_1.default.Router();
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const guestId = (0, user_info_1.generateGuestId)();
        const room = yield (0, rooms_1.findRoomInMemory)();
        // Create guest user
        const guestUser = {
            id: guestId,
            animal: (0, user_info_1.getRandomAnimal)(),
            room: room,
            position: (0, user_info_1.getPosition)(),
            direction: (0, user_info_1.getDirection)(),
            npcGroup: {
                id: guestId,
                fileNames: [],
                faceFileName: "",
                position: (0, user_info_1.getPosition)(),
                direction: (0, user_info_1.getDirection)(),
                phase: types_1.NPCPhase.IDLE,
                captorId: guestId
            },
        };
        // Generate token (base64 encoded user info)
        const token = Buffer.from(JSON.stringify(guestUser)).toString("base64");
        res.json({ user: guestUser, token });
    }
    catch (error) {
        console.error("Auth error:", error);
        res.status(500).json({ error: "Failed to authenticate" });
    }
}));
exports.default = router;
