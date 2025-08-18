export class FirebaseBackupJsonError extends Error {
  error: any;
  constructor(message: string, error: any, stack?: string | undefined) {
    super(message);
    this.error = error;
    this.stack = stack;
    this.name = "FirebaseBackupJsonError";
  }
}
