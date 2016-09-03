export default class NicoException extends Error {
    constructor({message, code, response, previous}) {
        super(message);

        this.message = message;
        this.code = code;
        this.response = response;
        this.previous = previous;
    }
}
