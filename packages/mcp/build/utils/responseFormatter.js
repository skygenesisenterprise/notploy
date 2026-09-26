export class ResponseFormatter {
    static success(message, data) {
        const responseData = {
            success: true,
            message,
            ...(data !== undefined && data !== null ? { data } : {}),
        };
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(responseData, null, 2),
                },
            ],
        };
    }
    static error(message, details) {
        const errorData = {
            success: false,
            error: message,
            ...(details && { details }),
        };
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: JSON.stringify(errorData, null, 2),
                },
            ],
        };
    }
}
