import * as yup from "yup";

export class HttpError extends Error {
    constructor(public statusCode: number, body: Record<string, unknown> = {}) {
        super(JSON.stringify(body));
    }
}

// CORS headers are intentionally NOT set here. The Function URL config
// (see backend/scripts/deploy.sh) sets them at the AWS-gateway level
// (Allow-Origin: *, Allow-Methods: *, Allow-Headers: *). Setting them in
// the Lambda response too produced duplicate Access-Control-Allow-Origin
// headers, which browsers treat as malformed CORS and silently abort the
// fetch — surfacing as a generic "Network error" in the frontend.
export const headers: Record<string, string> = {
    "content-type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "X-XSS-Protection": "0",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Server": "Swiftrace",
};

export const handleError = (e: unknown) => {
    if (e instanceof yup.ValidationError) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                errors: e.errors,
            }),
        };
    }

    if (e instanceof SyntaxError) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: "Invalid request body format",
            }),
        };
    }

    if (e instanceof HttpError) {
        return {
            statusCode: e.statusCode,
            headers,
            body: e.message,
        };
    }

    return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
            status: 500,
            message: "Internal server error",
        }),
    };
};
