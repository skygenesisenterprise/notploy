import pino from "pino";
import { redactObject, redactSecrets } from "../utils/security/redact";

export const logger = pino({
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
			levelFirst: false,
		},
	},
	// Both the structured context and the message can carry credentials:
	// commands are often logged as the message, while stderr/stdout land in
	// the object. Redact at the single point every log line passes through.
	formatters: {
		log: (object) => redactObject(object),
	},
	hooks: {
		logMethod(args, method) {
			const redacted = args.map((arg) =>
				typeof arg === "string" ? redactSecrets(arg) : arg,
			);
			return method.apply(this, redacted as Parameters<typeof method>);
		},
	},
});
