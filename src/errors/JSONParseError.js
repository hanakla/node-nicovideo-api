import NicoException from './NicoException';

export default class JSONParseError extends NicoException {
    constructor({tryToParse}) {
        super(...arguments);
        this.tryToParse = tryToParse;
    }
}
