"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serialize = serialize;
exports.deserialize = deserialize;
const superjson_1 = __importDefault(require("superjson"));
// For Redis storage
function serialize(data) {
    return superjson_1.default.stringify(data);
}
function deserialize(serialized) {
    if (!serialized)
        return null;
    return superjson_1.default.parse(serialized);
}
