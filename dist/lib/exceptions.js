"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseBackupJsonError = void 0;
class FirebaseBackupJsonError extends Error {
    constructor(message, error, stack) {
        super(message);
        this.error = error;
        this.stack = stack;
        this.name = "FirebaseBackupJsonError";
    }
}
exports.FirebaseBackupJsonError = FirebaseBackupJsonError;
