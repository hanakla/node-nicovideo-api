let NicoUserAPI;
const NicoUser = require("./NicoUser");

module.exports =
NicoUserAPI = class NicoUserAPI {
    constructor(_session) {
        this._session = _session;
        this._cache = {};
    }

    /**
     * @param {Number} userId
     * @return {Promise}
     */
    getUserInfo(userId) {
        if (this._cache[userId] != null) { return Promise.resolve(this._cache[userId]); } 
        return NicoUser.instance(userId, this._session);
    }
};
