let NicoException;
module.exports =
NicoException = class NicoException extends Error {
    constructor({message, code, response, previous}) {
        {
          // Hack: trick babel into allowing this before super.
          if (false) { super(); }
          let thisFn = (() => { this; }).toString();
          let thisName = thisFn.slice(thisFn.indexOf('{') + 1, thisFn.indexOf(';')).trim();
          eval(`${thisName} = this;`);
        }
        this.message = message;
        this.code = code;
        this.response = response;
        this.previous = previous;
        super(this.message);
    }
};
