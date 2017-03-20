export default class NicoException extends Error {
    code: number
    response: any
    previous: Error

    constructor({message, code, response, previous}: {
        message: string,
        code?: number,
        response?: any,
        previous?: Error,
    }) {
        super(message)

        this.message = message;
        this.code = code;
        this.response = response;
        this.previous = previous;
    }
};
